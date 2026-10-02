"""Query intent detection and retrieval for the Anantya chatbot.

Supports three query intents:
- GENERAL: no specific event mentioned (e.g. "What events are there?", "What is Anantya?")
- SINGLE_EVENT: exactly one event identified (e.g. "What is the prize of IoThrone?")
- MULTI_EVENT: two or more events identified, typically comparison queries
  (e.g. "What is the difference between DecentraHACK and SHE SOLVES?")

For symposium overview queries (e.g. "What and how many events are there in Anantya?"),
the retriever guarantees that the canonical list of all 7 events with domains and
organizing clubs is provided directly in context.

Internal crawler metadata chunks (SOURCE METADATA, SOURCE PRIORITY) are strictly filtered
out so that factual sections (registration links, venues, fees, eligibility, prizes)
are never crowded out of the context.
"""
import re
from enum import Enum
from dataclasses import dataclass

import numpy as np

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
    "decentrahack 2.0": "ANANTYA-001",
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

# Patterns for symposium overview / all-events inquiries
_SYMPOSIUM_OVERVIEW_PATTERNS = [
    r"\b(?:what\s+and\s+)?how\s+many\s+events\b",
    r"\bwhat\s+(?:are\s+the\s+)?events\b",
    r"\blist\s+(?:all\s+)?(?:the\s+)?events\b",
    r"\ball\s+(?:the\s+)?events\b",
    r"\bevery\s+event\b",
    r"\bevents\s+(?:in|under|at)\s+anantya\b",
    r"\bwhat\s+is\s+anantya\b",
    r"\boverview\s+of\s+anantya\b",
    r"\btell\s+me\s+about\s+anantya\b",
    r"\bdomains?\s+(?:in|of|under|at)\s+anantya\b",
    r"\bcategories\s+of\s+events\b",
]
_SYMPOSIUM_OVERVIEW_RE = re.compile("|".join(_SYMPOSIUM_OVERVIEW_PATTERNS), re.IGNORECASE)

# Internal metadata sections to exclude from retrieval
_INTERNAL_METADATA_SECTIONS = {
    "SOURCE METADATA",
    "SOURCE PRIORITY",
    "CHATBOT INFORMATION RULES",
}


# Canonical 7 event IDs
ALL_EVENT_IDS = [
    "ANANTYA-001",
    "ANANTYA-002",
    "ANANTYA-003",
    "ANANTYA-004",
    "ANANTYA-005",
    "ANANTYA-006",
    "ANANTYA-007",
]

# Attribute keywords that require event-level details rather than just the general symposium overview
_EVENT_ATTRIBUTE_KEYWORDS = (
    "link", "links", "url", "urls", "form", "forms", "unstop", "register", "registration",
    "fee", "fees", "cost", "price", "pay",
    "venue", "venues", "location", "locations", "lab", "labs", "room", "floor", "where",
    "prize", "prizes", "award", "awards", "cash", "goodies", "pool",
    "rulebook", "rulebooks", "rule book", "drive",
    "eligib", "team size", "team sizes", "members",
    "coordinator", "coordinators", "contact",
    "deadline", "deadlines",
)


# ---------------------------------------------------------------------------
# Event detection helpers
# ---------------------------------------------------------------------------

def is_symposium_overview_query(query: str) -> bool:
    """Check if query is asking for a general symposium overview or list of events.

    If the query asks for specific event attributes (e.g. links, fees, venues, prizes),
    it is NOT a pure symposium overview query — it needs event-level details.
    """
    q_lower = query.lower()
    if any(k in q_lower for k in _EVENT_ATTRIBUTE_KEYWORDS):
        return False
    return bool(_SYMPOSIUM_OVERVIEW_RE.search(query))


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
    If the user asks across 'all events', 'every event', 'each event',
    or asks for plural event attributes ('registration links', 'fees of events')
    without naming a specific event, returns all 7 event IDs.

    Args:
        query: Raw user query string.

    Returns:
        Ordered list of unique event_ids found in the query.
    """
    q_lower = query.lower()
    seen: set[str] = set()
    result: list[str] = []

    # Check keyword map — longer keywords first to avoid partial matches
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

    # If specific events were mentioned, return them
    if result:
        # If user also said "compare with all events"
        if re.search(r"\b(?:all|every|each)\s+(?:the\s+)?events?\b", q_lower) and _COMPARISON_RE.search(q_lower):
            return list(ALL_EVENT_IDS)
        return result

    # If the user asks for all events, every event, each event:
    if re.search(r"\b(?:all|every|each|across)\s+(?:the\s+)?(?:7\s+)?events?\b", q_lower):
        return list(ALL_EVENT_IDS)

    # If the query asks for general/plural event attributes without specifying an event:
    plural_attribute_patterns = [
        r"\bregistration\s+links?\b",
        r"\bevent\s+links?\b",
        r"\ball\s+links?\b",
        r"\bforms?\s+(?:for|of)\s+events?\b",
        r"\bfees?\s+(?:for|of)\s+(?:the\s+)?events?\b",
        r"\bprizes?\s+(?:for|of)\s+(?:the\s+)?events?\b",
        r"\bvenues?\s+(?:for|of)\s+(?:the\s+)?events?\b",
        r"\brulebooks?\b",
    ]
    if any(re.search(pat, q_lower) for pat in plural_attribute_patterns):
        return list(ALL_EVENT_IDS)

    return []


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
    # If it is a pure symposium overview or count query, classify as GENERAL
    if is_symposium_overview_query(query) and not detect_event_id(query):
        return QueryIntent.GENERAL, []

    event_ids = detect_all_event_ids(query)
    is_comparison = bool(_COMPARISON_RE.search(query))

    if len(event_ids) == 0:
        return QueryIntent.GENERAL, []

    if len(event_ids) == 1 and not is_comparison:
        return QueryIntent.SINGLE_EVENT, event_ids

    # Two or more events, or comparison query
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
        (r"\bhow many event\b", "how many events"),
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

def _is_internal_metadata_chunk(meta: dict, text: str) -> bool:
    """Check if a chunk contains internal crawler instructions rather than event facts."""
    section = meta.get("section", "").strip().upper()
    chunk_id = meta.get("chunk_id", "").strip().upper()

    if section in _INTERNAL_METADATA_SECTIONS:
        return True
    if "SOURCE_METADATA" in chunk_id or "SOURCE_PRIORITY" in chunk_id:
        return True
    if "GROUNDING_INSTRUCTION:" in text or "KNOWLEDGE_SCOPE:" in text:
        return True

    return False


def _boost_score_for_query(meta: dict, text: str, query: str, base_score: float) -> float:
    """Apply section and keyword boosting to surface exact requested facts."""
    q_lower = query.lower()
    sec_lower = meta.get("section", "").lower()
    text_lower = text.lower()
    boost = 0.0

    # Links / Registration URLs / Rulebooks / Websites
    if any(k in q_lower for k in ("link", "url", "unstop", "register", "registration", "form", "website", "rulebook", "rule book", "drive", "brochure")):
        if any(s in sec_lower for s in ("registration", "rulebook", "official", "resources", "quick facts")):
            boost += 0.25
        if "http://" in text_lower or "https://" in text_lower:
            boost += 0.15
        if "drive.google.com" in text_lower:
            boost += 0.30

    # Fees / Cost / Price
    if any(k in q_lower for k in ("fee", "fees", "cost", "price", "free", "pay", "charges")):
        if any(s in sec_lower for s in ("registration", "fees", "quick facts")):
            boost += 0.25
        if "₹" in text or "free" in text_lower or "rs." in text_lower:
            boost += 0.15

    # Eligibility / Team size / Gender / Participation
    if any(k in q_lower for k in ("eligib", "who can", "team", "members", "size", "boy", "girl", "female", "participat")):
        if any(s in sec_lower for s in ("eligibility", "team size", "participation", "quick facts")):
            boost += 0.25

    # Venue / Location / Where / Lab / Room
    if any(k in q_lower for k in ("venue", "location", "where", "lab", "room", "floor", "campus", "place")):
        if any(s in sec_lower for s in ("venue", "location", "round", "quick facts")):
            boost += 0.25
        if any(w in text_lower for w in ("lab", "floor", "pccoe", "pimpri", "campus")):
            boost += 0.25

    # Prizes / Cash / Awards / Goodies
    if any(k in q_lower for k in ("prize", "prizes", "award", "cash", "goodies", "pool", "win", "worth")):
        if any(s in sec_lower for s in ("prize", "benefits", "awards", "quick facts")):
            boost += 0.25
        if "₹" in text or "lakh" in text_lower or "15k" in text_lower or "16,000" in text_lower:
            boost += 0.15

    # Dates / Schedule / Deadline / Timings / When
    if any(k in q_lower for k in ("date", "when", "time", "deadline", "timing", "schedule", "round")):
        if any(s in sec_lower for s in ("important dates", "dates", "schedule", "rounds", "quick facts")):
            boost += 0.20

    # Coordinators / Contacts
    if any(k in q_lower for k in ("contact", "coordinator", "phone", "email", "number", "organizer", "reach")):
        if any(s in sec_lower for s in ("coordinator", "contact", "organizer")):
            boost += 0.25

    # Comparison queries: boost core comparative dimensions so the LLM gets
    # fees, prizes, team size, eligibility, rounds, and domains for each event
    if _COMPARISON_RE.search(q_lower):
        if any(s in sec_lower for s in ("eligibility", "team size", "registration", "prize", "event overview", "quick facts")):
            boost += 0.20

    return base_score + boost


def _filter_and_rank_results(
    raw_results: list[tuple[dict, float]],
    query: str,
    similarity_threshold: float,
    exclude_metadata: bool = True,
) -> list[RetrievalResult]:
    """Convert raw Qdrant results into RetrievalResult objects, filtering
    out internal metadata and scores below threshold, with section boosting.
    """
    results: list[RetrievalResult] = []
    for meta, score in raw_results:
        chunk_text = meta.get("chunk_text", "")
        if exclude_metadata and _is_internal_metadata_chunk(meta, chunk_text):
            logger.debug(
                "Excluding internal metadata chunk: %s",
                meta.get("chunk_id", "unknown"),
            )
            continue

        boosted_score = _boost_score_for_query(meta, chunk_text, query, score)

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
                text=chunk_text,
                metadata={
                    "event_id": meta.get("event_id", ""),
                    "event_name": meta.get("event_name", ""),
                    "source_file": meta.get("source_file", ""),
                    "section": meta.get("section", ""),
                    "chunk_id": meta.get("chunk_id", ""),
                },
                score=boosted_score,
            )
        )

    # Sort descending by boosted score
    results.sort(key=lambda r: r.score, reverse=True)
    return results


# ---------------------------------------------------------------------------
# Dedicated Symposium Overview Retrieval
# ---------------------------------------------------------------------------

def retrieve_symposium_overview(
    query: str,
    query_vector: np.ndarray | None = None,
) -> list[RetrievalResult]:
    """Retrieve comprehensive symposium overview chunks for Anantya '26.

    Guarantees that the canonical list of all 7 events (TOTAL EVENTS,
    QUICK EVENT DIRECTORY, OVERVIEW, and EVENTS BY DOMAIN) is included
    at the very top of context so the LLM never omits any event.
    """
    if query_vector is None:
        clean_query = normalize_query(query)
        query_vector = embeddings.embed_text(clean_query)

    # Search specifically in EVENT_000_ANANTYA_OVERALL_INFO
    raw_results = qdrant_store.search(
        query_vector,
        top_k=20,
        event_id_filter="EVENT_000_ANANTYA_OVERALL_INFO",
    )

    # Convert to RetrievalResult objects excluding internal metadata
    all_chunks = _filter_and_rank_results(
        raw_results,
        query=query,
        similarity_threshold=0.15,
        exclude_metadata=True,
    )

    # Priority sections that MUST be present at the top
    priority_order = [
        "TOTAL EVENTS",
        "QUICK EVENT DIRECTORY",
        "OVERVIEW",
        "EVENTS BY DOMAIN",
    ]

    priority_chunks = []
    other_chunks = []

    for chunk in all_chunks:
        sec = chunk.metadata.get("section", "").strip().upper()
        if any(p in sec for p in priority_order):
            priority_chunks.append(chunk)
        else:
            other_chunks.append(chunk)

    # Sort priority chunks according to priority_order
    def priority_sort_key(c: RetrievalResult) -> int:
        sec = c.metadata.get("section", "").strip().upper()
        for idx, p in enumerate(priority_order):
            if p in sec:
                return idx
        return 99

    priority_chunks.sort(key=priority_sort_key)

    # Combine: priority chunks first, then top relevant other chunks (e.g. FAQ, Schedule, Venue)
    combined = priority_chunks + other_chunks[:6]
    logger.info("Symposium overview retrieval returning %d chunks", len(combined))
    return combined


# ---------------------------------------------------------------------------
# Public retrieval functions
# ---------------------------------------------------------------------------

def retrieve(
    query: str,
    top_k: int | None = None,
    similarity_threshold: float | None = None,
    query_vector: np.ndarray | None = None,
) -> list[RetrievalResult]:
    """Retrieve relevant chunks for a user query using Qdrant.

    Uses normalized query embedding, Qdrant cosine similarity search, and
    an adaptive similarity filter to ensure high precision while preventing
    empty results on valid short queries.

    For symposium overview inquiries ("how many events", "what events", etc.),
    retrieves key overview chunks guaranteeing all 7 events are present.

    For single-event queries, searches with expanded top_k and applies section
    boosting for fees, links, eligibility, dates, and venues.

    Args:
        query: User's question text.
        top_k: Number of top results to fetch. If None, uses settings.
        similarity_threshold: Minimum similarity score to include.
            If None, uses settings.
        query_vector: Optional precomputed query embedding vector to avoid
            duplicate embedding generation.

    Returns:
        List of RetrievalResult objects, sorted by descending similarity.
    """
    settings = get_settings()
    if top_k is None:
        top_k = settings.top_k
    if similarity_threshold is None:
        similarity_threshold = settings.retrieval_score_threshold

    # Check for symposium overview / all-events query
    event_id_filter = detect_event_id(query)
    if not event_id_filter and is_symposium_overview_query(query):
        logger.info("Detected symposium overview query: '%s'", query[:80])
        return retrieve_symposium_overview(query, query_vector=query_vector)

    if event_id_filter:
        logger.info(f"Detected event for filtering: {event_id_filter}")
        # When an event is specified, expand top_k to 10-12 so all key sections
        # (registration links, eligibility, fees, venues, dates) are in context
        top_k = max(top_k, 12)
        if similarity_threshold > 0.25:
            similarity_threshold = 0.25

    # Normalize query for enhanced semantic matching
    clean_query = normalize_query(query)
    logger.debug("Normalized query: '%s' -> '%s'", query, clean_query)

    # Embed normalized query if not provided
    if query_vector is None:
        query_vector = embeddings.embed_text(clean_query)

    # Search Qdrant collection with candidate buffer to allow re-ranking & boosting
    candidate_k = max(top_k * 5, 50)
    raw_results = qdrant_store.search(
        query_vector,
        top_k=candidate_k,
        event_id_filter=event_id_filter,
    )

    # Filter and rank by boosted score, excluding internal metadata
    results = _filter_and_rank_results(
        raw_results,
        query=query,
        similarity_threshold=similarity_threshold,
        exclude_metadata=True,
    )

    # Fallback: if all results were filtered out or empty, retry without strict threshold
    if not results and raw_results:
        results = _filter_and_rank_results(
            raw_results,
            query=query,
            similarity_threshold=0.1,
            exclude_metadata=False,
        )

    final_results = results[:top_k]

    logger.info(
        "Retrieved %d chunks for query: '%s' (top_k=%d, threshold=%.2f)",
        len(final_results),
        query[:80],
        top_k,
        similarity_threshold,
    )

    return final_results


def retrieve_multi_event(
    query: str,
    event_ids: list[str],
    per_event_k: int | None = None,
    similarity_threshold: float | None = None,
    query_vector: np.ndarray | None = None,
) -> list[RetrievalResult]:
    """Retrieve chunks for a multi-event / comparison query.

    Runs a *separate* filtered search for each event so that every
    requested event is represented in the final context, then merges
    the results together sorted by score.

    Args:
        query: User's original question.
        event_ids: List of ANANTYA-xxx event IDs to retrieve for.
        per_event_k: Number of top chunks to fetch *per event*.
            If None, defaults to 6 per event.
        similarity_threshold: Minimum similarity score.
            If None, uses settings.
        query_vector: Optional precomputed query embedding vector to avoid
            duplicate embedding generation.

    Returns:
        Combined list of RetrievalResult objects from all events,
        sorted by descending score.
    """
    settings = get_settings()
    is_comp = bool(_COMPARISON_RE.search(query))
    if per_event_k is None:
        if len(event_ids) >= 7:
            per_event_k = 3
        elif len(event_ids) == 2:
            per_event_k = 10 if is_comp else 6
        else:
            per_event_k = 4
    if similarity_threshold is None:
        similarity_threshold = 0.1

    # Normalize & embed once if not provided
    clean_query = normalize_query(query)
    logger.debug("Multi-event normalized query: '%s' -> '%s'", query, clean_query)
    if query_vector is None:
        query_vector = embeddings.embed_text(clean_query)

    all_results: list[RetrievalResult] = []

    for eid in event_ids:
        logger.info("Multi-event retrieval for event: %s", eid)
        raw = qdrant_store.search(
            query_vector,
            top_k=per_event_k + 6,  # Request extra to account for metadata exclusions
            event_id_filter=eid,
        )
        filtered = _filter_and_rank_results(
            raw,
            query=query,
            similarity_threshold=similarity_threshold,
            exclude_metadata=True,
        )
        all_results.extend(filtered[:per_event_k])
        logger.info(
            "  -> %d chunks above threshold for %s",
            len(filtered[:per_event_k]),
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
