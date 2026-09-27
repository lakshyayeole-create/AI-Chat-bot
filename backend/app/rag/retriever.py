"""Query intent detection and retrieval for the Anantya chatbot.

Supports three query intents:
- GENERAL: no specific event mentioned (e.g. "What events are there?")
- SINGLE_EVENT: exactly one event identified (e.g. "What is the prize of IoThrone?")
- MULTI_EVENT: two or more events identified, typically comparison queries
  (e.g. "What is the difference between DecentraHACK and SHE SOLVES?")

For MULTI_EVENT queries, chunks are retrieved separately per event and then
combined so that the LLM receives clearly labelled context from every
requested event.
"""
import re
from enum import Enum
from dataclasses import dataclass

from app.core.config import get_settings
from app.core.logging_config import get_logger
from app.rag import embeddings, qdrant_store

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Data classes & enums
# ---------------------------------------------------------------------------

class QueryIntent(str, Enum):
    """Classification of a user query's intent."""
    GENERAL = "GENERAL"
    SINGLE_EVENT = "SINGLE_EVENT"
    MULTI_EVENT = "MULTI_EVENT"


@dataclass
class RetrievalResult:
    """A single retrieval result with chunk text, metadata, and score."""
    text: str
    metadata: dict
    score: float


# ---------------------------------------------------------------------------
# Event keyword map  (keyword → canonical ANANTYA-xxx id)
# ---------------------------------------------------------------------------

EVENT_KEYWORD_MAP = {
    "she solves": "ANANTYA-002",
    "shesolves": "ANANTYA-002",
    "make a doodle": "ANANTYA-006",
    "doodle": "ANANTYA-006",
    "iothrone": "ANANTYA-004",
    "iotthrone": "ANANTYA-004",
    "codigo": "ANANTYA-007",
    "byteme": "ANANTYA-003",
    "byte me": "ANANTYA-003",
    "ctf": "ANANTYA-003",
    "decentrahack": "ANANTYA-001",
    "decentra": "ANANTYA-001",
    "masterchef": "ANANTYA-005",
}

# Patterns that signal comparison / multi-event intent
_COMPARISON_PATTERNS = [
    r"\bdifference\s+between\b",
    r"\bcompare\b",
    r"\bcomparison\b",
    r"\bvs\.?\b",
    r"\bversus\b",
    r"\bdiffer(?:s|ent|ence)?\s+from\b",
    r"\bhow\s+(?:does|do|is|are)\b.+\b(?:differ|compare)\b",
]
_COMPARISON_RE = re.compile("|".join(_COMPARISON_PATTERNS), re.IGNORECASE)


# ---------------------------------------------------------------------------
# Event detection helpers
# ---------------------------------------------------------------------------

def detect_event_id(query: str) -> str | None:
    """Detect if the user is asking about a specific event.

    Returns the *first* matching event_id, or None.
    Kept for backward-compatibility with existing callers.

    Args:
        query: Raw user query string.

    Returns:
        The detected event_id, or None if no clear event is found.
    """
    q_lower = query.lower()
    for keyword, event_id in EVENT_KEYWORD_MAP.items():
        if keyword in q_lower:
            return event_id

    # Also check if event ID is mentioned directly (e.g. ANANTYA-003)
    match = re.search(r"anantya-\d{3}", q_lower)
    if match:
        return match.group(0).upper()

    return None


def detect_all_event_ids(query: str) -> list[str]:
    """Detect *all* event IDs mentioned in a query.

    Returns a de-duplicated list preserving first-occurrence order.

    Args:
        query: Raw user query string.

    Returns:
        Ordered list of unique event_ids found in the query.
    """
    q_lower = query.lower()
    seen: set[str] = set()
    result: list[str] = []

    # If the user explicitly asks for all events, return all unique event IDs
    if re.search(r"\b(?:all|every|each)\s+(?:the\s+)?events?\b", q_lower):
        return sorted(list(set(EVENT_KEYWORD_MAP.values())))

    # Check keyword map — longer keywords first to avoid partial matches
    # e.g. "she solves" should match before "solves"
    sorted_keywords = sorted(EVENT_KEYWORD_MAP.keys(), key=len, reverse=True)
    for keyword in sorted_keywords:
        if keyword in q_lower:
            eid = EVENT_KEYWORD_MAP[keyword]
            if eid not in seen:
                seen.add(eid)
                result.append(eid)

    # Direct ANANTYA-xxx mentions
    for m in re.finditer(r"anantya-\d{3}", q_lower):
        eid = m.group(0).upper()
        if eid not in seen:
            seen.add(eid)
            result.append(eid)

    return result


# ---------------------------------------------------------------------------
# Intent classification
# ---------------------------------------------------------------------------

def classify_intent(query: str) -> tuple[QueryIntent, list[str]]:
    """Classify a user query into GENERAL / SINGLE_EVENT / MULTI_EVENT.

    Args:
        query: Raw user query.

    Returns:
        A (QueryIntent, event_ids) tuple.
        - GENERAL:      event_ids is empty.
        - SINGLE_EVENT: event_ids has exactly one element.
        - MULTI_EVENT:  event_ids has two or more elements, or it is a comparison query.
    """
    event_ids = detect_all_event_ids(query)
    is_comparison = bool(_COMPARISON_RE.search(query))

    if len(event_ids) == 0:
        return QueryIntent.GENERAL, []

    if len(event_ids) == 1 and not is_comparison:
        return QueryIntent.SINGLE_EVENT, event_ids

    # Two or more events, or 1 event + comparison query (e.g. asking for difference with an unknown event).
    return QueryIntent.MULTI_EVENT, event_ids


# ---------------------------------------------------------------------------
# Query normalisation
# ---------------------------------------------------------------------------

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
        (r"\bbyte me\b", "BYTEME CTF '26"),
        (r"\bctf\b", "BYTEME CTF '26"),
        (r"\bdecentrahack\b", "DecentraHACK"),
        (r"\bdecentra\b", "DecentraHACK"),
        (r"\bmasterchef\b", "MasterChef UI 2026"),
        (r"\biothrone\b", "IoThrone 2026"),
        (r"\biotthrone\b", "IoThrone 2026"),
        (r"\bdoodle\b", "Make a Doodle"),
        (r"\bare their\b", "are there"),
        # Strip filler phrases that dilute semantic search for all-event queries
        (r"\b(?:for\s+)?(?:all|every|each)\s+(?:the\s+)?events?\b", ""),
    ]

    for pattern, replacement in replacements:
        q = re.sub(pattern, replacement, q, flags=re.IGNORECASE)

    # Clean up any leftover double spaces or trailing punctuation
    q = re.sub(r"\s+", " ", q).strip()
    q = re.sub(r"\s+\?$", "?", q)

    return q


# ---------------------------------------------------------------------------
# Core retrieval helpers
# ---------------------------------------------------------------------------

def _filter_by_threshold(
    raw_results: list[tuple[dict, float]],
    similarity_threshold: float,
) -> list[RetrievalResult]:
    """Convert raw Qdrant results into RetrievalResult objects, filtering
    out anything below *similarity_threshold*.
    """
    results: list[RetrievalResult] = []
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
    return results


# ---------------------------------------------------------------------------
# Public retrieval functions
# ---------------------------------------------------------------------------

def retrieve(
    query: str,
    top_k: int | None = None,
    similarity_threshold: float | None = None,
) -> list[RetrievalResult]:
    """Retrieve relevant chunks for a user query using Qdrant.

    Uses normalized query embedding, Qdrant cosine similarity search, and
    an adaptive similarity filter to ensure high precision while preventing
    empty results on valid short queries.

    For backward-compatibility this function performs *single-event*
    filtering when exactly one event is detected.  For multi-event
    retrieval use :func:`retrieve_multi_event`.

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
        event_id_filter=event_id_filter,
    )

    # Filter by similarity threshold
    results = _filter_by_threshold(raw_results, similarity_threshold)

    logger.info(
        "Retrieved %d chunks for query: '%s' (top_k=%d, threshold=%.2f)",
        len(results),
        query[:80],
        top_k,
        similarity_threshold,
    )

    return results


def retrieve_multi_event(
    query: str,
    event_ids: list[str],
    per_event_k: int | None = None,
    similarity_threshold: float | None = None,
) -> list[RetrievalResult]:
    """Retrieve chunks for a multi-event / comparison query.

    Runs a *separate* filtered search for each event so that every
    requested event is represented in the final context, then merges
    the results together sorted by score.

    Args:
        query: User's original question.
        event_ids: List of ANANTYA-xxx event IDs to retrieve for.
        per_event_k: Number of top chunks to fetch *per event*.
            If None, uses ``settings.top_k``.
        similarity_threshold: Minimum similarity score.
            If None, uses settings.

    Returns:
        Combined list of RetrievalResult objects from all events,
        sorted by descending score.
    """
    settings = get_settings()
    if per_event_k is None:
        per_event_k = settings.top_k
    if similarity_threshold is None:
        # Default to a very lenient threshold since we are strictly filtering
        # by event ID anyway. High thresholds fail on comparison queries.
        similarity_threshold = 0.1

    # Normalize & embed once
    clean_query = normalize_query(query)
    logger.debug("Multi-event normalized query: '%s' -> '%s'", query, clean_query)
    query_vector = embeddings.embed_text(clean_query)

    all_results: list[RetrievalResult] = []

    for eid in event_ids:
        logger.info("Multi-event retrieval for event: %s", eid)
        raw = qdrant_store.search(
            query_vector,
            top_k=per_event_k,
            event_id_filter=eid,
        )
        filtered = _filter_by_threshold(raw, similarity_threshold)
        all_results.extend(filtered)
        logger.info(
            "  -> %d chunks above threshold for %s",
            len(filtered),
            eid,
        )

    # Sort combined results by score (descending)
    all_results.sort(key=lambda r: r.score, reverse=True)

    logger.info(
        "Multi-event retrieval total: %d chunks for %d events, query: '%s'",
        len(all_results),
        len(event_ids),
        query[:80],
    )

    return all_results
