"""Disk-backed audio cache for Text-to-Speech (TTS)."""
import hashlib
import time
from pathlib import Path
from typing import Optional

from app.core.config import get_settings
from app.core.logging_config import get_logger

logger = get_logger(__name__)

CACHE_SCHEMA_VERSION = "v1"


def normalize_text_for_tts(text: str) -> str:
    """Normalize text for consistent caching while preserving punctuation for speech cadence."""
    # Collapse multiple whitespace/newlines to single space, strip leading/trailing
    lines = text.strip().split()
    return " ".join(lines).strip()


def compute_cache_key(
    text: str,
    voice_id: str,
    model_id: str,
    output_format: str = "mp3",
    version: str = CACHE_SCHEMA_VERSION,
) -> str:
    """Compute a deterministic SHA256 key for a TTS generation."""
    normalized = normalize_text_for_tts(text)
    payload = f"{version}|{model_id}|{voice_id}|{output_format}|{normalized}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class AudioCache:
    """Manages cached TTS audio files on disk with TTL."""

    def __init__(self, cache_dir: Optional[str] = None, ttl_seconds: Optional[int] = None):
        settings = get_settings()
        backend_dir = Path(__file__).resolve().parent.parent.parent
        self.cache_dir = backend_dir / (cache_dir or settings.tts_audio_cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.ttl = ttl_seconds or settings.tts_cache_ttl_seconds

    def _file_path(self, cache_key: str) -> Path:
        return self.cache_dir / f"{cache_key}.mp3"

    def get(self, cache_key: str) -> Optional[bytes]:
        """Retrieve audio bytes if file exists and has not expired."""
        path = self._file_path(cache_key)
        if not path.is_file():
            return None

        # Check TTL
        try:
            mtime = path.stat().st_mtime
            if (time.time() - mtime) > self.ttl:
                logger.info("Audio cache expired for key %s, removing.", cache_key)
                path.unlink(missing_ok=True)
                return None

            return path.read_bytes()
        except Exception as e:
            logger.warning("Error reading audio cache for %s: %s", cache_key, str(e))
            return None

    def put(self, cache_key: str, audio_bytes: bytes) -> None:
        """Save audio bytes to disk cache."""
        path = self._file_path(cache_key)
        try:
            path.write_bytes(audio_bytes)
            logger.debug("Saved %d bytes to audio cache (%s)", len(audio_bytes), cache_key)
        except Exception as e:
            logger.error("Failed to write audio cache for %s: %s", cache_key, str(e))

    def clear(self) -> int:
        """Remove all files from the audio cache directory."""
        count = 0
        for f in self.cache_dir.glob("*.mp3"):
            try:
                f.unlink(missing_ok=True)
                count += 1
            except Exception:
                pass
        return count


# Singleton instance
_audio_cache: Optional[AudioCache] = None


def get_audio_cache() -> AudioCache:
    global _audio_cache
    if _audio_cache is None:
        _audio_cache = AudioCache()
    return _audio_cache
