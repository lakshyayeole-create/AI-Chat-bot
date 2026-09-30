"""RAG pipeline orchestrator.

Coordinates the full flow:
embed query ONCE → semantic cache check → retrieve from Qdrant → build context → call Gemini → cache save.
Designed to be transport-independent (reusable for future voice endpoint).
"""
import re
import numpy as np
from app.core.logging_config import get_logger
from app.rag.retriever import (
    retrieve,
    retrieve_multi_event,
    classify_intent,
    normalize_query,
    QueryIntent,
    RetrievalResult,
)
from app.rag import embeddings
from app.rag.semantic_cache import get_cached_response, save_cached_response
from app.llm.client import generate_answer

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# Context builders
# ---------------------------------------------------------------------------

def _clean_context_text(text: str) -> str:
    """Clean internal technical markers and database IDs from chunk text."""
    text = re.sub(r"\(Anantya\s+'?26,\s*ID:\s*ANANTYA-\d{3}\)", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\(ID:\s*ANANTYA-\d{3}\)", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\bEVENT[_ ]ID:\s*ANANTYA-\d{3}\b", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\bEVENT_000_ANANTYA_OVERALL_INFO\b", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*\|\s*Section:", " | Section:", text)
    return text.strip()


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
        context_parts.append(f"{header}\n{_clean_context_text(result.text)}")

    return "CONTEXT:\n\n" + "\n\n---\n\n".join(context_parts)


def build_comparison_context(
    results: list[RetrievalResult],
    event_ids: list[str],
) -> str:
    """Build a context block optimised for comparison / multi-event queries.

    Chunks are grouped by event so the LLM can clearly see which facts
    belong to which event. Events that had zero matching chunks are
    flagged explicitly so the LLM can state that information is missing
    rather than hallucinating.

    Args:
        results: Combined RetrievalResult list from retrieve_multi_event.
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
        event_header = f"=== EVENT: {event_name} ==="
        chunk_texts = []
        for c in chunks:
            section = c.metadata.get("section", "General")
            chunk_texts.append(f"[Section: {section}]\n{_clean_context_text(c.text)}")

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
# Synchronous / Direct processing pipeline
# ---------------------------------------------------------------------------

async def process_chat(message: str) -> dict:
    """Process a chat message with single query embedding and semantic cache.

    Steps:
    1. Normalize query and classify intent.
    2. Generate query embedding ONCE.
    3. Check semantic cache BEFORE Qdrant / queue.
       - If HIT: return cached response immediately.
    4. If MISS:
       - Retrieve from Qdrant using the same query_vector.
       - Build grounded context.
       - Call Gemini.
       - Save to semantic cache.
       - Return response.

    Args:
        message: User's question text (already validated).

    Returns:
        Dict with 'answer' and 'sources' keys.
    """
    logger.info("Processing chat: '%s'", message[:80])

    # Step 1: Normalize query and classify intent
    clean_query = normalize_query(message)
    intent, event_ids = classify_intent(message)
    logger.info("Query intent: %s, events: %s", intent.value, event_ids)

    # Step 2: Generate query embedding ONCE
    query_vector = embeddings.embed_text(clean_query)

    # Step 3: Semantic Cache lookup
    cached = await get_cached_response(
        query=message,
        query_embedding=query_vector,
        event_ids=event_ids,
    )
    if cached is not None:
        logger.info("Returning cached response directly (cache hit)")
        return {
            "answer": cached["answer"],
            "sources": cached["sources"],
            "cache_hit": True,
        }

    # Step 4: Qdrant retrieval reusing query_vector
    if intent == QueryIntent.MULTI_EVENT:
        results = retrieve_multi_event(
            query=message,
            event_ids=event_ids,
            query_vector=query_vector,
        )
        context = build_comparison_context(results, event_ids)
    else:
        results = retrieve(
            query=message,
            query_vector=query_vector,
        )
        context = build_context(results)

    logger.info("Context built from %d chunks (intent=%s)", len(results), intent.value)

    # Step 5: Extract source metadata
    sources = extract_sources(results)

    # Step 6: Generate answer using LLM
    answer = await generate_answer(question=message, context=context)

    # Step 7: Cache the successful response
    chunk_ids = [r.metadata.get("chunk_id", "") for r in results if r.metadata.get("chunk_id")]
    event_names = list({r.metadata.get("event_name", "") for r in results if r.metadata.get("event_name")})

    try:
        await save_cached_response(
            query=message,
            query_embedding=query_vector,
            answer=answer,
            sources=sources,
            event_ids=event_ids,
            event_names=event_names,
            retrieved_chunk_ids=chunk_ids,
        )
    except Exception as e:
        logger.error("Failed to save response to cache (non-fatal): %s", e)

    return {
        "answer": answer,
        "sources": sources,
        "cache_hit": False,
    }
