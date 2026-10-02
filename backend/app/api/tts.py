"""API endpoints for Text-to-Speech (TTS)."""
from typing import Optional, Literal
from fastapi import APIRouter, Response, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.core.logging_config import get_logger
from app.tts.cache import get_audio_cache, compute_cache_key, normalize_text_for_tts
from app.tts.concurrency import get_tts_limiter, TTSBusyException
from app.tts.elevenlabs_client import get_elevenlabs_client, TTSProviderException

logger = get_logger(__name__)

router = APIRouter(prefix="/api/tts", tags=["Text-to-Speech"])


class TTSRequestBody(BaseModel):
    text: str = Field(..., description="Text content to speak")
    mode: Literal["chatbot", "page"] = Field("chatbot", description="Speech mode: chatbot answer or page text")
    voiceProfile: Optional[str] = Field(None, description="Optional voice profile name or ID override")
    format: str = Field("mp3", description="Audio format, default mp3")


@router.post("", response_class=Response)
async def generate_tts(request: TTSRequestBody):
    """Generate or retrieve cached TTS audio for chatbot answers or page chunks.
    
    Returns:
        audio/mpeg bytes on success, or structured JSON error on failure.
    """
    settings = get_settings()

    raw_text = request.text.strip()
    if not raw_text:
        return JSONResponse(
            status_code=400,
            content={"error": {"code": "INVALID_INPUT", "message": "Text content cannot be empty."}},
        )

    if len(raw_text) > settings.tts_max_text_length:
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "TEXT_TOO_LONG",
                    "message": f"Text exceeds maximum allowed length of {settings.tts_max_text_length} characters.",
                }
            },
        )

    voice_id = request.voiceProfile if (request.voiceProfile and len(request.voiceProfile) > 5) else settings.elevenlabs_voice_id
    model_id = settings.elevenlabs_model_id
    cache = get_audio_cache()
    limiter = get_tts_limiter()
    client = get_elevenlabs_client()

    cache_key = compute_cache_key(
        text=raw_text,
        voice_id=voice_id,
        model_id=model_id,
        output_format=request.format,
    )

    # 1. Check disk audio cache
    cached_audio = cache.get(cache_key)
    if cached_audio:
        logger.info("Audio cache HIT for key %s (mode=%s)", cache_key[:12], request.mode)
        return Response(
            content=cached_audio,
            media_type="audio/mpeg",
            headers={
                "X-Audio-Cache": "HIT",
                "Cache-Control": f"public, max-age={settings.tts_cache_ttl_seconds}",
            },
        )

    logger.info("Audio cache MISS for key %s (mode=%s)", cache_key[:12], request.mode)

    # 2. Generator function to be run under bounded concurrency & coalescing
    async def _generate_and_cache() -> bytes:
        audio_bytes = await client.generate_speech(
            text=normalize_text_for_tts(raw_text),
            voice_id=voice_id,
            model_id=model_id,
        )
        # Store in cache
        cache.put(cache_key, audio_bytes)
        return audio_bytes

    try:
        audio_result = await limiter.execute_coalesced(cache_key, _generate_and_cache)
        return Response(
            content=audio_result,
            media_type="audio/mpeg",
            headers={
                "X-Audio-Cache": "MISS",
                "Cache-Control": f"public, max-age={settings.tts_cache_ttl_seconds}",
            },
        )

    except TTSBusyException as e:
        return JSONResponse(
            status_code=503,
            content={"error": {"code": e.code, "message": str(e)}},
        )
    except TTSProviderException as e:
        return JSONResponse(
            status_code=e.http_status,
            content={"error": {"code": e.code, "message": e.message}},
        )
    except Exception as e:
        logger.error("Unhandled error in TTS endpoint: %s", str(e))
        return JSONResponse(
            status_code=500,
            content={"error": {"code": "AUDIO_GENERATION_FAILED", "message": str(e)}},
        )


@router.get("/status")
async def tts_status():
    """Operational status of the TTS service (does not expose keys or secrets)."""
    settings = get_settings()
    limiter = get_tts_limiter()
    has_key = bool(settings.elevenlabs_api_key and settings.elevenlabs_api_key.strip())

    return {
        "status": "ready" if has_key else "fallback_only",
        "provider": "elevenlabs" if has_key else "browser_speech_synthesis",
        "voice_id": settings.elevenlabs_voice_id,
        "model_id": settings.elevenlabs_model_id,
        "max_concurrent": settings.tts_max_concurrent_requests,
        "active_queue": limiter.queue_size,
    }
