"""Core configuration module."""
from pathlib import Path
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # --- Gemini LLM (3 API Keys) ---
    gemini_api_key_1: str = ""
    gemini_api_key_2: str = ""
    gemini_api_key_3: str = ""
    gemini_api_key: str = ""  # Optional single-key fallback
    gemini_model: str = "gemini-2.5-flash"

    # --- Optional Legacy LLM ---
    groq_api_key: str = ""
    llm_model: str = "qwen/qwen3.8-27b"

    # --- Semantic Cache ---
    semantic_cache_enabled: bool = True
    semantic_cache_threshold: float = 0.92
    semantic_cache_ttl: int = 3600
    cache_file_path: str = "data/cache.json"

    # --- Workers & Queue ---
    num_workers: int = 3

    # --- Embeddings ---
    embedding_model: str = "all-MiniLM-L6-v2"

    # --- RAG ---
    chunk_size: int = 800
    chunk_overlap: int = 120
    top_k: int = 5
    retrieval_score_threshold: float = 0.35

    # --- Qdrant ---
    qdrant_url: str = ""
    qdrant_api_key: str | None = None
    qdrant_collection_name: str = "anantya_events"

    # --- Paths ---
    knowledge_dir: str = "../event_info"

    # --- CORS ---
    frontend_origin: str = "http://localhost:3000"

    # --- Server ---
    host: str = "0.0.0.0"
    port: int = 8001
    log_level: str = "info"

    # --- Message Limits ---
    max_message_length: int = 1000

    # --- ElevenLabs TTS Configuration ---
    elevenlabs_api_key: str = ""
    elevenlabs_voice_id: str = "pNInz6obpgDQGcFmaJgB"  # Adam / Calm Assistant default
    elevenlabs_model_id: str = "eleven_turbo_v2_5"
    tts_max_concurrent_requests: int = 2
    tts_queue_max_size: int = 10
    tts_queue_timeout_ms: int = 8000
    tts_provider_timeout_ms: int = 12000
    tts_cache_ttl_seconds: int = 604800  # 7 days
    tts_audio_cache_dir: str = "data/audio_cache"
    tts_max_text_length: int = 2000

    model_config = {
        "env_file": str(Path(__file__).resolve().parent.parent.parent / ".env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }

    @property
    def knowledge_path(self) -> Path:
        """Resolve knowledge directory relative to the backend root."""
        backend_root = Path(__file__).resolve().parent.parent.parent
        primary = backend_root / self.knowledge_dir
        if primary.exists():
            return primary
        fallback = backend_root / "event_info"
        if fallback.exists():
            return fallback
        return primary

    @property
    def resolved_cache_path(self) -> Path:
        """Resolve cache file path relative to the backend root."""
        return Path(__file__).resolve().parent.parent.parent / self.cache_file_path


@lru_cache()
def get_settings() -> Settings:
    """Return cached application settings."""
    return Settings()
