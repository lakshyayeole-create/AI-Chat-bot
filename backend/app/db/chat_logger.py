"""Helper service to persist chatbot user interactions in MongoDB."""
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from app.core.logging_config import get_logger
from app.db.mongodb import get_chat_collection

logger = get_logger(__name__)


async def log_chat_interaction(
    question: str,
    answer: str,
    session_id: Optional[str] = None,
    intent: Optional[str] = None,
    event_ids: Optional[List[str]] = None,
    sources: Optional[List[Dict[str, Any]]] = None,
    cached: bool = False,
    user_id: Optional[str] = None,
) -> None:
    """Asynchronously insert chat interaction record into MongoDB."""
    chat_col = get_chat_collection()
    if chat_col is None:
        logger.debug("MongoDB not connected; skipping chat interaction log.")
        return

    try:
        clean_sources = []
        if sources:
            for s in sources:
                if isinstance(s, dict):
                    clean_sources.append({
                        "event_id": s.get("event_id", ""),
                        "event_name": s.get("event_name", ""),
                        "source_file": s.get("source_file", ""),
                    })
                elif hasattr(s, "model_dump"):
                    clean_sources.append(s.model_dump())

        doc = {
            "question": question,
            "answer": answer,
            "session_id": session_id or "anonymous",
            "intent": intent or "general",
            "event_ids": event_ids or [],
            "sources": clean_sources,
            "cached": cached,
            "user_id": user_id,
            "created_at": datetime.now(timezone.utc),
        }
        await chat_col.insert_one(doc)
        logger.info("Persisted chat interaction to MongoDB (cached=%s)", cached)
    except Exception as e:
        logger.warning("Could not persist chat interaction to MongoDB: %s", str(e))
