"""Automated tests for Text-to-Speech (TTS) module."""
import pytest
import asyncio
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from app.main import app
from app.tts.cache import compute_cache_key, normalize_text_for_tts, AudioCache
from app.tts.concurrency import TTSCoalescingLimiter, TTSBusyException
from app.tts.elevenlabs_client import TTSProviderException


def test_normalize_text():
    raw = "   Welcome   to \n\n  Anantya   2026!  "
    assert normalize_text_for_tts(raw) == "Welcome to Anantya 2026!"


def test_cache_key_deterministic():
    key1 = compute_cache_key("Hello world", "voice_1", "model_1")
    key2 = compute_cache_key("   Hello   world  ", "voice_1", "model_1")
    key3 = compute_cache_key("Hello world!", "voice_1", "model_1")

    assert key1 == key2
    assert key1 != key3


def test_audio_cache_put_get(tmp_path):
    cache = AudioCache(cache_dir=str(tmp_path), ttl_seconds=100)
    key = "test_key_123"
    fake_audio = b"FAKE_MP3_DATA_BYTES"

    assert cache.get(key) is None
    cache.put(key, fake_audio)
    assert cache.get(key) == fake_audio


@pytest.mark.asyncio
async def test_concurrency_limiter_coalesces_duplicate():
    limiter = TTSCoalescingLimiter(max_concurrent=2, queue_max_size=5)
    call_count = 0

    async def mock_generator():
        nonlocal call_count
        call_count += 1
        await asyncio.sleep(0.05)
        return b"AUDIO_RESULT"

    # Launch two simultaneous requests with the same key
    res1, res2 = await asyncio.gather(
        limiter.execute_coalesced("key_same", mock_generator),
        limiter.execute_coalesced("key_same", mock_generator),
    )

    assert res1 == b"AUDIO_RESULT"
    assert res2 == b"AUDIO_RESULT"
    # Even though two callers requested it, generator was called only once!
    assert call_count == 1


def test_tts_api_validation_empty_text():
    client = TestClient(app)
    response = client.post("/api/tts", json={"text": "   ", "mode": "chatbot"})
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "INVALID_INPUT"


def test_tts_api_validation_text_too_long():
    client = TestClient(app)
    huge_text = "A" * 2500
    response = client.post("/api/tts", json={"text": huge_text, "mode": "chatbot"})
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == "TEXT_TOO_LONG"


def test_tts_api_status_endpoint():
    client = TestClient(app)
    response = client.get("/api/tts/status")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "provider" in data
    assert "voice_id" in data


def test_tts_api_unconfigured_provider_error():
    """When ElevenLabs API key is empty, the endpoint returns 503 PROVIDER_UNAVAILABLE so frontend falls back to Web Speech API."""
    client = TestClient(app)
    with patch("app.tts.elevenlabs_client.get_settings") as mock_settings:
        mock_settings.return_value.elevenlabs_api_key = ""
        mock_settings.return_value.elevenlabs_voice_id = "test_voice"
        mock_settings.return_value.elevenlabs_model_id = "test_model"
        mock_settings.return_value.tts_max_text_length = 2000
        mock_settings.return_value.tts_cache_ttl_seconds = 604800
        mock_settings.return_value.tts_audio_cache_dir = "data/audio_cache"

        response = client.post("/api/tts", json={"text": "Test speech fallback"})
        assert response.status_code == 503
        data = response.json()
        assert data["error"]["code"] == "PROVIDER_UNAVAILABLE"


def test_tts_api_cache_hit(tmp_path):
    """When audio is already cached, returns 200 audio/mpeg directly with X-Audio-Cache: HIT."""
    from app.tts.cache import get_audio_cache, compute_cache_key
    cache = get_audio_cache()
    key = compute_cache_key("Cached answer text", "pNInz6obpgDQGcFmaJgB", "eleven_turbo_v2_5")
    cache.put(key, b"CACHED_BYTES_123")

    client = TestClient(app)
    response = client.post("/api/tts", json={"text": "Cached answer text"})
    assert response.status_code == 200
    assert response.content == b"CACHED_BYTES_123"
    assert response.headers.get("x-audio-cache") == "HIT"
    assert response.headers.get("content-type") == "audio/mpeg"


def test_tts_api_dynamic_does_not_save_to_disk(tmp_path):
    """Dynamic TTS generation must return audio directly without persisting to backend disk cache."""
    from app.tts.cache import get_audio_cache, compute_cache_key
    cache = get_audio_cache()
    unique_text = "Dynamic on-the-fly speech answer that should not be saved"
    key = compute_cache_key(unique_text, "pNInz6obpgDQGcFmaJgB", "eleven_turbo_v2_5")

    # Ensure not in cache before test
    assert cache.get(key) is None

    client = TestClient(app)
    with patch("app.tts.elevenlabs_client.ElevenLabsClient.generate_speech", new_callable=AsyncMock) as mock_gen:
        mock_gen.return_value = b"MOCK_DYNAMIC_AUDIO_STREAM_BYTES"

        response = client.post("/api/tts", json={"text": unique_text})
        assert response.status_code == 200
        assert response.content == b"MOCK_DYNAMIC_AUDIO_STREAM_BYTES"
        assert response.headers.get("x-audio-cache") == "MISS"

        # Crucial check: audio must NOT be in disk cache!
        assert cache.get(key) is None

