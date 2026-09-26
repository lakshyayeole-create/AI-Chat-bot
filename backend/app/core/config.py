"""Core configuration module."""
from pathlib import Path
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # --- LLM ---
    groq_api_key: str = ""
    llm_model: str = "qwen/qwen3.8-27b"

    # --- Embeddings ---
    embedding_model: str = "all-MiniLM-L6-v2"

    # --- RAG ---
    chunk_size: int = 800
    chunk_overlap: int = 120
    top_k: int = 6
    similarity_threshold: float = 0.22

    # --- Paths ---
    knowledge_dir: str = "../event_info"
    vector_store_dir: str = "./vector_store"

    # --- CORS ---
    frontend_origin: str = "http://localhost:3000"

    # --- Server ---
    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "info"

    # --- Message Limits ---
    max_message_length: int = 1000

    model_config = {
        "env_file": str(Path(__file__).resolve().parent.parent.parent / ".env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }

    @property
    def knowledge_path(self) -> Path:
        """Resolve knowledge directory relative to the backend root."""
        return Path(__file__).resolve().parent.parent.parent / self.knowledge_dir

    @property
    def vector_store_path(self) -> Path:
        """Resolve vector store directory relative to the backend root."""
        base = Path(__file__).resolve().parent.parent.parent
        return base / self.vector_store_dir


@lru_cache()
def get_settings() -> Settings:
    """Return cached application settings."""
    return Settings()
