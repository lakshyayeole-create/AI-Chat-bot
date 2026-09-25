import re
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


def normalize_query(query: str) -> str:
    """Normalize user query to improve embedding match quality.

    Expands common abbreviations, fixes compound terms, and normalizes
    event names for Anantya '26.

    Args:
        query: Raw user query string.

    Returns:
        Normalized query string.
    """
    q = query.strip()

    # Normalization map for common abbreviations and informal event names
    replacements = [
        (r"\bshesolves\b", "She Solves 3.0"),
        (r"\bshe solves\b", "She Solves 3.0"),
        (r"\bcodigo\b", "Codigo 2026"),
        (r"\bbyteme\b", "BYTEME CTF '26"),
        (r"\bctf\b", "BYTEME CTF '26"),
        (r"\bdecentrahack\b", "DecentraHACK"),
        (r"\bdecentra\b", "DecentraHACK"),
        (r"\bmasterchef\b", "MasterChef UI 2026"),
        (r"\biothrone\b", "IoThrone 2026"),
        (r"\bdoodle\b", "Make a Doodle"),
        (r"\bare their\b", "are there"),
    ]

    for pattern, replacement in replacements:
        q = re.sub(pattern, replacement, q, flags=re.IGNORECASE)

    return q


def retrieve(
    query: str,
    top_k: int | None = None,
    similarity_threshold: float | None = None,
) -> list[RetrievalResult]:
    """Retrieve relevant chunks for a user query.

    Uses normalized query embedding, FAISS inner-product search, and
    an adaptive similarity filter to ensure high precision while preventing
    empty results on valid short queries.

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

    # Normalize query for enhanced semantic matching
    clean_query = normalize_query(query)
    logger.debug("Normalized query: '%s' -> '%s'", query, clean_query)

    # Embed normalized query
    query_vector = embeddings.embed_text(clean_query)

    # Search FAISS index
    raw_results = vector_store.search(query_vector, top_k=top_k)

    # Also search with raw query if it differs substantially and merge
    if clean_query.lower() != query.lower():
        raw_query_vector = embeddings.embed_text(query)
        extra_results = vector_store.search(raw_query_vector, top_k=top_k)
        # Merge results, keeping the higher score for any duplicate chunk index
        score_dict: dict[int, float] = {}
        for idx, score in raw_results + extra_results:
            if idx not in score_dict or score > score_dict[idx]:
                score_dict[idx] = score
        raw_results = sorted(score_dict.items(), key=lambda x: x[1], reverse=True)[:top_k]

    # Filter by similarity threshold
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

    # Adaptive fallback: if no chunks passed the threshold but top result is strong enough (>= 0.20)
    # and not complete noise, include the top result(s)
    if not results and raw_results:
        best_idx, best_score = raw_results[0]
        if best_score >= 0.20:
            meta = vector_store.get_metadata_by_index(best_idx)
            if meta is not None:
                logger.info(
                    "Adaptive fallback: rescuing top chunk %d (score=%.4f)",
                    best_idx,
                    best_score,
                )
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
                        score=best_score,
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
