"""Embedding generation using sentence-transformers.

Provides a clean interface for generating text embeddings.
The embedding model is loaded once and reused for both ingestion and querying.
"""
import numpy as np
from sentence_transformers import SentenceTransformer

from app.core.config import get_settings
from app.core.logging_config import get_logger

logger = get_logger(__name__)

# Module-level cache for the embedding model
_model: SentenceTransformer | None = None


def _get_model() -> SentenceTransformer:
    """Load and cache the sentence-transformers model.

    Returns:
        Loaded SentenceTransformer model instance.
    """
    global _model
    if _model is None:
        settings = get_settings()
        logger.info("Loading embedding model: %s", settings.embedding_model)
        _model = SentenceTransformer(settings.embedding_model)
        logger.info(
            "Embedding model loaded. Dimension: %d",
            _model.get_sentence_embedding_dimension(),
        )
    return _model


def embed_text(text: str) -> np.ndarray:
    """Generate an embedding for a single text string.

    Args:
        text: Input text to embed.

    Returns:
        Numpy array of the embedding vector, L2-normalized.
    """
    model = _get_model()
    embedding = model.encode(text, normalize_embeddings=True)
    return np.array(embedding, dtype=np.float32)


def embed_texts(texts: list[str]) -> np.ndarray:
    """Generate embeddings for multiple text strings.

    Args:
        texts: List of input texts to embed.

    Returns:
        Numpy array of shape (n_texts, embedding_dim), L2-normalized.
    """
    model = _get_model()
    embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=True)
    return np.array(embeddings, dtype=np.float32)


def get_embedding_dimension() -> int:
    """Get the dimensionality of the embedding model.

    Returns:
        Integer dimension of the embedding vectors.
    """
    model = _get_model()
    return model.get_sentence_embedding_dimension()
