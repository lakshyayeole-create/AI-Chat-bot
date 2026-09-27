"""RAG pipeline orchestrator.

Coordinates the full flow: retrieve → build context → call LLM → format response.
Designed to be transport-independent (reusable for future voice endpoint).

Supports three query intents:
- GENERAL:      no specific event → unfiltered retrieval.
- SINGLE_EVENT: one event detected → filtered retrieval (original behaviour).
- MULTI_EVENT:  two+ events detected (comparison) → per-event retrieval,
                clearly labelled context, and a comparison-aware LLM hint.
"""
from app.core.logging_config import get_logger
from app.rag.retriever import (
    retrieve,
    retrieve_multi_event,
    classify_intent,
    QueryIntent,
    RetrievalResult,
)
from app.llm.client import generate_answer

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Context builders
# ---------------------------------------------------------------------------

def build_context(results: list[RetrievalResult]) -> str:
    """Build a clean, labeled context block from retrieved chunks.

    Each chunk is labeled with its event name and section for clarity.
    Multiple events are clearly separated.

    Args:
        results: List of RetrievalResult objects from the retriever.

    Returns:
        Formatted context string for the LLM prompt.
    """
    if not results:
        return "No relevant event information was found for this question."

    context_parts = []
    for result in results:
        event_name = result.metadata.get("event_name", "Unknown Event")
        section = result.metadata.get("section", "General")
        source_file = result.metadata.get("source_file", "unknown source")

        header = f"[Event: {event_name}]\n[Section: {section}]\n[Source: {source_file}]"
        context_parts.append(f"{header}\n{result.text}")

    return "CONTEXT:\n\n" + "\n\n---\n\n".join(context_parts)


def build_comparison_context(
    results: list[RetrievalResult],
    event_ids: list[str],
) -> str:
    """Build a context block optimised for comparison / multi-event queries.

    Chunks are grouped by event so the LLM can clearly see which facts
    belong to which event.  Events that had zero matching chunks are
    flagged explicitly so the LLM can state that information is missing
    rather than hallucinating.

    Args:
        results: Combined RetrievalResult list from
            :func:`retrieve_multi_event`.
        event_ids: The canonical ANANTYA-xxx IDs that were requested.

    Returns:
        Formatted context string for the LLM prompt.
    """
    if not results:
        return "No relevant event information was found for this question."

    # Group results by event_id
    by_event: dict[str, list[RetrievalResult]] = {}
    for r in results:
        eid = r.metadata.get("event_id", "UNKNOWN")
        by_event.setdefault(eid, []).append(r)

    parts: list[str] = []
    for eid in event_ids:
        chunks = by_event.get(eid, [])
        if not chunks:
            parts.append(
                f"=== EVENT: {eid} ===\n"
                f"No relevant information was found for this event."
            )
            continue

        event_name = chunks[0].metadata.get("event_name", eid)
        event_header = f"=== EVENT: {event_name} (ID: {eid}) ==="
        chunk_texts = []
        for c in chunks:
            section = c.metadata.get("section", "General")
            chunk_texts.append(f"[Section: {section}]\n{c.text}")

        parts.append(event_header + "\n\n" + "\n\n---\n\n".join(chunk_texts))

    return (
        "COMPARISON CONTEXT — information for each requested event is "
        "grouped below.\n\n"
        + "\n\n" + "=" * 60 + "\n\n".join(parts)
    )


# ---------------------------------------------------------------------------
# Source extraction
# ---------------------------------------------------------------------------

def extract_sources(results: list[RetrievalResult]) -> list[dict]:
    """Extract unique source information from retrieval results.

    Args:
        results: List of RetrievalResult objects.

    Returns:
        List of unique source dicts with event_id, event_name, source_file.
    """
    seen = set()
    sources = []

    for result in results:
        key = (
            result.metadata.get("event_id", ""),
            result.metadata.get("source_file", ""),
        )
        if key not in seen:
            seen.add(key)
            sources.append({
                "event_id": result.metadata.get("event_id", ""),
                "event_name": result.metadata.get("event_name", ""),
                "source_file": result.metadata.get("source_file", ""),
            })

    return sources


# ---------------------------------------------------------------------------
# Main pipeline entry point
# ---------------------------------------------------------------------------

async def process_chat(message: str) -> dict:
    """Process a chat message through the full RAG pipeline.

    This is the main entry point for the chatbot — used by the API layer.
    Designed to be transport-independent for future voice support.

    Handles three intents:
    - GENERAL:      unfiltered retrieval.
    - SINGLE_EVENT: retrieval filtered to one event.
    - MULTI_EVENT:  per-event retrieval + comparison-aware context.

    Args:
        message: User's question text (already validated).

    Returns:
        Dict with 'answer' and 'sources' keys.
    """
    logger.info("Processing chat: '%s'", message[:80])

    # Step 1: Classify intent
    intent, event_ids = classify_intent(message)
    logger.info("Query intent: %s, events: %s", intent.value, event_ids)

    # Step 2: Retrieve chunks based on intent
    if intent == QueryIntent.MULTI_EVENT:
        results = retrieve_multi_event(message, event_ids)
        context = build_comparison_context(results, event_ids)
    else:
        # GENERAL and SINGLE_EVENT both go through the original retrieve()
        # which handles event filtering internally.
        results = retrieve(message)
        context = build_context(results)

    logger.info("Context built from %d chunks (intent=%s)", len(results), intent.value)

    # Step 3: Extract source metadata
    sources = extract_sources(results)

    # Step 4: Generate answer using LLM
    answer = await generate_answer(question=message, context=context)

    logger.info("Answer generated. Sources: %s", [s["event_id"] for s in sources])

    return {
        "answer": answer,
        "sources": sources,
    }
