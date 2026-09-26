"""RAG pipeline orchestrator.

Coordinates the full flow: retrieve → build context → call LLM → format response.
Designed to be transport-independent (reusable for future voice endpoint).
"""
from app.core.logging_config import get_logger
from app.rag.retriever import retrieve, RetrievalResult
from app.llm.client import generate_answer

logger = get_logger(__name__)


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


async def process_chat(message: str) -> dict:
    """Process a chat message through the full RAG pipeline.

    This is the main entry point for the chatbot — used by the API layer.
    Designed to be transport-independent for future voice support.

    Args:
        message: User's question text (already validated).

    Returns:
        Dict with 'answer' and 'sources' keys.
    """
    logger.info("Processing chat: '%s'", message[:80])

    # Step 1: Retrieve relevant chunks
    results = retrieve(message)

    # Step 2: Build grounded context
    context = build_context(results)
    logger.info("Context built from %d chunks", len(results))

    # Step 3: Extract source metadata
    sources = extract_sources(results)

    # Step 4: Generate answer using LLM
    answer = await generate_answer(question=message, context=context)

    logger.info("Answer generated. Sources: %s", [s["event_id"] for s in sources])

    return {
        "answer": answer,
        "sources": sources,
    }
