"""ElevenLabs Text-to-Speech API Client with error mapping."""
import httpx
from typing import Optional, Dict, Any

from app.core.config import get_settings
from app.core.logging_config import get_logger

logger = get_logger(__name__)


class TTSProviderException(Exception):
    """Structured exception for TTS provider errors."""

    def __init__(self, code: str, message: str, http_status: int = 503):
        super().__init__(message)
        self.code = code
        self.message = message
        self.http_status = http_status


class ElevenLabsClient:
    """Server-side client for ElevenLabs neural text-to-speech API."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        timeout_seconds: Optional[float] = None,
    ):
        settings = get_settings()
        self.api_key = api_key if api_key is not None else settings.elevenlabs_api_key
        self.timeout = timeout_seconds or (settings.tts_provider_timeout_ms / 1000.0)

    async def generate_speech(
        self,
        text: str,
        voice_id: Optional[str] = None,
        model_id: Optional[str] = None,
        voice_settings: Optional[Dict[str, Any]] = None,
    ) -> bytes:
        """Call ElevenLabs API to generate MP3 audio bytes from text."""
        settings = get_settings()
        active_voice = voice_id or settings.elevenlabs_voice_id
        active_model = model_id or settings.elevenlabs_model_id

        # Check if API key is present
        if not self.api_key or not self.api_key.strip():
            logger.warning("ElevenLabs API key is not set in backend environment.")
            raise TTSProviderException(
                code="PROVIDER_UNAVAILABLE",
                message="ElevenLabs API key is not configured on the server.",
                http_status=503,
            )

        url = f"https://api.elevenlabs.io/v1/text-to-speech/{active_voice}"
        headers = {
            "xi-api-key": self.api_key.strip(),
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        }

        payload = {
            "text": text,
            "model_id": active_model,
            "voice_settings": voice_settings or {
                "stability": 0.65,
                "similarity_boost": 0.80,
                "style": 0.05,
                "use_speaker_boost": True,
            },
        }

        logger.info(
            "Calling ElevenLabs TTS: voice=%s, model=%s, text_len=%d",
            active_voice,
            active_model,
            len(text),
        )

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(url, json=payload, headers=headers)

            if response.status_code == 200:
                audio_bytes = response.content
                if not audio_bytes:
                    raise TTSProviderException(
                        code="AUDIO_GENERATION_FAILED",
                        message="Provider returned empty audio stream.",
                        http_status=502,
                    )
                logger.info("ElevenLabs generated %d bytes of audio.", len(audio_bytes))
                return audio_bytes

            # Map status codes to structured error responses
            status = response.status_code
            err_text = response.text

            if status == 401:
                logger.error("ElevenLabs authentication error (401)")
                raise TTSProviderException(
                    code="INVALID_API_KEY",
                    message="ElevenLabs API key is invalid or unauthorized.",
                    http_status=503,
                )
            elif status == 429:
                logger.warning("ElevenLabs rate limit / concurrency hit (429)")
                raise TTSProviderException(
                    code="RATE_LIMITED",
                    message="ElevenLabs rate limit exceeded. Falling back to browser speech.",
                    http_status=429,
                )
            elif status == 400 and any(w in err_text.lower() for w in ["quota", "credit", "character limit"]):
                logger.warning("ElevenLabs quota exceeded: %s", err_text[:100])
                raise TTSProviderException(
                    code="PROVIDER_QUOTA_EXCEEDED",
                    message="ElevenLabs account quota exceeded. Falling back to browser speech.",
                    http_status=429,
                )
            else:
                logger.error("ElevenLabs error status %d: %s", status, err_text[:150])
                raise TTSProviderException(
                    code="PROVIDER_UNAVAILABLE",
                    message=f"ElevenLabs service returned status {status}.",
                    http_status=503,
                )

        except httpx.TimeoutException:
            logger.warning("ElevenLabs request timed out after %.1fs", self.timeout)
            raise TTSProviderException(
                code="PROVIDER_TIMEOUT",
                message="ElevenLabs request timed out.",
                http_status=504,
            )
        except TTSProviderException:
            raise
        except Exception as e:
            logger.error("Unexpected error contacting ElevenLabs: %s", str(e))
            raise TTSProviderException(
                code="AUDIO_GENERATION_FAILED",
                message=f"Failed to generate audio: {str(e)}",
                http_status=500,
            )


# Global client instance
_client: Optional[ElevenLabsClient] = None


def get_elevenlabs_client() -> ElevenLabsClient:
    global _client
    if _client is None:
        _client = ElevenLabsClient()
    return _client
