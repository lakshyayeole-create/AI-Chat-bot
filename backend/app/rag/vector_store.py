"""FAISS vector store for semantic search.

Provides functions to build, save, load, and search a FAISS index.
Chunk text and metadata are stored separately in metadata.json,
aligned by index position with the FAISS vectors.
"""
import json
from pathlib import Path

import faiss
import numpy as np

from app.core.config import get_settings
from app.core.logging_config import get_logger

logger = get_logger(__name__)

# Module-level cache for the loaded index and metadata
_index: faiss.Index | None = None
_metadata: list[dict] | None = None


def build_index(vectors: np.ndarray) -> faiss.Index:
    """Build a FAISS index from embedding vectors.

    Uses IndexFlatIP (inner product) since embeddings are L2-normalized,
    making inner product equivalent to cosine similarity.

    Args:
        vectors: Numpy array of shape (n_vectors, embedding_dim).

    Returns:
        Built FAISS index.
    """
    dimension = vectors.shape[1]
    index = faiss.IndexFlatIP(dimension)
    index.add(vectors)
    logger.info(
        "FAISS index built: %d vectors, dimension=%d", index.ntotal, dimension
    )
    return index


def save_index(
    index: faiss.Index,
    metadata: list[dict],
    store_dir: Path | None = None,
) -> None:
    """Save FAISS index and metadata to disk.

    Args:
        index: FAISS index to save.
        metadata: List of chunk metadata dicts, aligned with index positions.
        store_dir: Directory to save to. If None, uses configured path.
    """
    if store_dir is None:
        settings = get_settings()
        store_dir = settings.vector_store_path

    store_dir = Path(store_dir)
    store_dir.mkdir(parents=True, exist_ok=True)

    index_path = store_dir / "index.faiss"
    metadata_path = store_dir / "metadata.json"

    faiss.write_index(index, str(index_path))
    logger.info("FAISS index saved: %s", index_path)

    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)
    logger.info("Metadata saved: %s (%d entries)", metadata_path, len(metadata))


def load_index(store_dir: Path | None = None) -> tuple[faiss.Index, list[dict]]:
    """Load FAISS index and metadata from disk.

    Results are cached in module-level variables for reuse.

    Args:
        store_dir: Directory to load from. If None, uses configured path.

    Returns:
        Tuple of (FAISS index, metadata list).

    Raises:
        FileNotFoundError: If the index or metadata files don't exist.
    """
    global _index, _metadata

    if _index is not None and _metadata is not None:
        return _index, _metadata

    if store_dir is None:
        settings = get_settings()
        store_dir = settings.vector_store_path

    store_dir = Path(store_dir)
    index_path = store_dir / "index.faiss"
    metadata_path = store_dir / "metadata.json"

    if not index_path.exists():
        raise FileNotFoundError(
            f"FAISS index not found at {index_path}. "
            "Run: python scripts/ingest.py"
        )

    if not metadata_path.exists():
        raise FileNotFoundError(
            f"Metadata file not found at {metadata_path}. "
            "Run: python scripts/ingest.py"
        )

    _index = faiss.read_index(str(index_path))
    logger.info("FAISS index loaded: %d vectors", _index.ntotal)

    with open(metadata_path, "r", encoding="utf-8") as f:
        _metadata = json.load(f)
    logger.info("Metadata loaded: %d entries", len(_metadata))

    # Verify alignment
    if _index.ntotal != len(_metadata):
        logger.error(
            "FAISS index (%d) and metadata (%d) are misaligned!",
            _index.ntotal,
            len(_metadata),
        )
        raise ValueError("FAISS index and metadata are misaligned.")

    return _index, _metadata


def search(
    query_vector: np.ndarray, top_k: int | None = None
) -> list[tuple[int, float]]:
    """Search the FAISS index for the most similar vectors.

    Args:
        query_vector: Query embedding vector (1D or 2D array).
        top_k: Number of top results to return. If None, uses settings.

    Returns:
        List of (index_position, similarity_score) tuples, sorted by
        descending similarity.

    Raises:
        RuntimeError: If the vector store has not been loaded.
    """
    if _index is None:
        raise RuntimeError(
            "Vector store not loaded. Call load_index() first."
        )

    if top_k is None:
        settings = get_settings()
        top_k = settings.top_k

    # Ensure query_vector is 2D
    if query_vector.ndim == 1:
        query_vector = query_vector.reshape(1, -1)

    distances, indices = _index.search(query_vector, top_k)

    results = []
    for idx, score in zip(indices[0], distances[0]):
        if idx != -1:  # FAISS returns -1 for empty slots
            results.append((int(idx), float(score)))

    return results


def get_metadata_by_index(idx: int) -> dict | None:
    """Get metadata for a specific index position.

    Args:
        idx: Index position in the FAISS index.

    Returns:
        Metadata dict for the chunk, or None if out of range.
    """
    if _metadata is None:
        return None
    if 0 <= idx < len(_metadata):
        return _metadata[idx]
    return None


def reset_cache() -> None:
    """Reset the cached index and metadata. Useful for testing."""
    global _index, _metadata
    _index = None
    _metadata = None
