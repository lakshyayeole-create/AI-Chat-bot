"""Semantic retriever for the RAG pipeline.

Embeds a user query, searches the FAISS index, and returns
relevant chunks filtered by a similarity threshold.
"""
from dataclasses import dataclass

from app.core.config import get_settings
from app.core.logging_config import get_logger
from app.rag import embeddings, vector_store

logger = get_logger(__name__)


@dataclass
class RetrievalResult:
    """A single retrieval result with chunk text, metadata, and score."""
    text: str
    metadata: dict
    score: float


def retrieve(
    query: str,
    top_k: int | None = None,
    similarity_threshold: float | None = None,
) -> list[RetrievalResult]:
    """Retrieve relevant chunks for a user query.

    Args:
        query: User's question text.
        top_k: Number of top results to fetch. If None, uses settings.
        similarity_threshold: Minimum similarity score to include.
            If None, uses settings.

    Returns:
        List of RetrievalResult objects, sorted by descending similarity.
    """
    settings = get_settings()
    if top_k is None:
        top_k = settings.top_k
    if similarity_threshold is None:
        similarity_threshold = settings.similarity_threshold

    # Embed the query using the same model as ingestion
    query_vector = embeddings.embed_text(query)

    # Search FAISS
    raw_results = vector_store.search(query_vector, top_k=top_k)

    # Filter by similarity threshold and attach metadata/text
    results = []
    for idx, score in raw_results:
        if score < similarity_threshold:
            logger.debug(
                "Skipping chunk %d (score=%.4f < threshold=%.4f)",
                idx,
                score,
                similarity_threshold,
            )
            continue

        meta = vector_store.get_metadata_by_index(idx)
        if meta is None:
            logger.warning("No metadata found for index %d", idx)
            continue

        results.append(
            RetrievalResult(
                text=meta.get("chunk_text", ""),
                metadata={
                    "event_id": meta.get("event_id", ""),
                    "event_name": meta.get("event_name", ""),
                    "source_file": meta.get("source_file", ""),
                    "section": meta.get("section", ""),
                    "chunk_id": meta.get("chunk_id", ""),
                },
                score=score,
            )
        )

    logger.info(
        "Retrieved %d chunks for query: '%s' (top_k=%d, threshold=%.2f)",
        len(results),
        query[:80],
        top_k,
        similarity_threshold,
    )

    return results
