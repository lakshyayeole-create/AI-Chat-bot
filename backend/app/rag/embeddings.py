"""Embedding generation using FastEmbed (ONNX Runtime).

Provides a clean interface for generating text embeddings using lightweight ONNX Runtime.
Loads sentence-transformers/all-MiniLM-L6-v2 without PyTorch, reducing RAM usage by ~90%
(from ~450MB down to ~35MB) to ensure rock-solid stability on Render's 512MB limit.
"""
import numpy as np
from fastembed import TextEmbedding

from app.core.config import get_settings
from app.core.logging_config import get_logger

logger = get_logger(__name__)

# Module-level cache for the FastEmbed model
_model: TextEmbedding | None = None


def _get_model() -> TextEmbedding:
    """Load and cache the FastEmbed model.

    Returns:
        Loaded TextEmbedding model instance.
    """
    global _model
    if _model is None:
        settings = get_settings()
        # FastEmbed model identifier format: 'sentence-transformers/all-MiniLM-L6-v2'
        model_name = settings.embedding_model
        if not model_name.startswith("sentence-transformers/") and "MiniLM" in model_name:
            model_name = f"sentence-transformers/{model_name}"

        logger.info("Loading FastEmbed ONNX model: %s", model_name)
        _model = TextEmbedding(model_name=model_name)
        logger.info("FastEmbed model loaded successfully on CPU (ONNX Runtime, 384 dimensions).")
    return _model


def embed_text(text: str) -> np.ndarray:
    """Generate an embedding for a single text string.

    Args:
        text: Input text to embed.

    Returns:
        Numpy array of the embedding vector, L2-normalized.
    """
    model = _get_model()
    # FastEmbed embed returns an iterable of numpy arrays (L2-normalized)
    embeddings = list(model.embed([text]))
    return np.array(embeddings[0], dtype=np.float32)


def embed_texts(texts: list[str]) -> np.ndarray:
    """Generate embeddings for multiple text strings.

    Args:
        texts: List of input texts to embed.

    Returns:
        Numpy array of shape (n_texts, embedding_dim), L2-normalized.
    """
    model = _get_model()
    embeddings = list(model.embed(texts))
    return np.array(embeddings, dtype=np.float32)


def get_embedding_dimension() -> int:
    """Get the dimensionality of the embedding model.

    Returns:
        Integer dimension of the embedding vectors (384 for all-MiniLM-L6-v2).
    """
    return 384
