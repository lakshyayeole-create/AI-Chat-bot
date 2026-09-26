import re
from dataclasses import dataclass

from app.core.config import get_settings
from app.core.logging_config import get_logger
from app.rag import embeddings, qdrant_store

logger = get_logger(__name__)


@dataclass
class RetrievalResult:
    """A single retrieval result with chunk text, metadata, and score."""
    text: str
    metadata: dict
    score: float


# Event detection mapping to enable event isolation in retrieval
EVENT_KEYWORD_MAP = {
    "she solves": "ANT-003",
    "shesolves": "ANT-003",
    "make a doodle": "ANT-007",
    "doodle": "ANT-007",
    "iothrone": "ANT-006",
    "codigo": "ANT-002", 
    "byteme": "ANT-001",
    "ctf": "ANT-001",
    "decentrahack": "ANT-004",
    "decentra": "ANT-004",
    "masterchef": "ANT-005",
}


def detect_event_id(query: str) -> str | None:
    """Detect if the user is asking about a specific event.

    Args:
        query: Raw user query string.

    Returns:
        The detected event_id, or None if no clear event is found.
    """
    q_lower = query.lower()
    for keyword, event_id in EVENT_KEYWORD_MAP.items():
        if keyword in q_lower:
            return event_id
    
    # Also check if event ID is mentioned directly (e.g. ANT-003)
    match = re.search(r"ant-\d{3}", q_lower)
    if match:
        return match.group(0).upper()
        
    return None


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
    """Retrieve relevant chunks for a user query using Qdrant.

    Uses normalized query embedding, Qdrant cosine similarity search, and
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
        similarity_threshold = settings.retrieval_score_threshold

    # Event detection for filtering
    event_id_filter = detect_event_id(query)
    if event_id_filter:
        logger.info(f"Detected event for filtering: {event_id_filter}")

    # Normalize query for enhanced semantic matching
    clean_query = normalize_query(query)
    logger.debug("Normalized query: '%s' -> '%s'", query, clean_query)

    # Embed normalized query
    query_vector = embeddings.embed_text(clean_query)

    # Search Qdrant collection
    raw_results = qdrant_store.search(
        query_vector, 
        top_k=top_k, 
        event_id_filter=event_id_filter
    )

    # Filter by similarity threshold
    results = []
    for meta, score in raw_results:
        if score < similarity_threshold:
            logger.debug(
                "Skipping chunk %s (score=%.4f < threshold=%.4f)",
                meta.get("chunk_id", "unknown"),
                score,
                similarity_threshold,
            )
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
