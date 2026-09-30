"""Semantic cache abstraction and JSON implementation.

Provides an isolated caching layer that stores semantically-indexed responses.
Supports pluggable storage backends (Local JSON now, MongoDB in the future)
behind an abstract interface so that the chat pipeline does not depend on the
underlying storage engine.
"""
from abc import ABC, abstractmethod
import asyncio
import json
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
import numpy as np
from filelock import FileLock

from app.core.config import get_settings
from app.core.logging_config import get_logger
from app.rag.knowledge_version import compute_knowledge_version

logger = get_logger(__name__)

# Phrases that indicate unavailable / unknown information that must NOT be cached
_UNAVAILABLE_PHRASES = (
    "not available in the provided",
    "is not available in the provided",
    "information is not available",
    "information is not provided",
    "not mentioned in the",
    "no information",
    "not specified",
    "don't have information",
    "do not have information",
    "only have information about",
    "unable to find",
    "not provided in the",
    "not explicitly mentioned",
)


def is_cacheable_response(answer: str, sources: list[dict]) -> bool:
    """Validate whether an LLM answer is safe and grounded to be cached.

    Rejects hallucinated, unknown/unavailable, error, or ungrounded responses.

    Args:
        answer: Generated LLM response text.
        sources: List of source metadata dicts.

    Returns:
        True if safe to cache, False otherwise.
    """
    if not answer or not answer.strip():
        logger.debug("Rejecting empty answer from cache")
        return False

    # Must have valid grounding sources
    if not sources:
        logger.debug("Rejecting answer with no sources from cache")
        return False

    # Check for valid source structure
    for s in sources:
        if not isinstance(s, dict) or not s.get("event_id") or not s.get("source_file"):
            logger.debug("Rejecting answer with invalid source structure from cache")
            return False

    ans_lower = answer.lower()

    # Reject responses stating information is unavailable or missing
    if any(phrase in ans_lower for phrase in _UNAVAILABLE_PHRASES):
        logger.info("Answer states information is unavailable; skipping cache save")
        return False

    # Reject obvious error messages
    if ans_lower.startswith("transmission failed") or "llm request failed" in ans_lower:
        logger.warning("Rejecting error answer from cache")
        return False

    return True


def compute_cosine_similarity(vec1: np.ndarray, vec2: np.ndarray) -> float:
    """Compute cosine similarity between two 1D embedding vectors.

    Args:
        vec1: First vector.
        vec2: Second vector.

    Returns:
        Cosine similarity float in [-1.0, 1.0].
    """
    v1 = np.asarray(vec1, dtype=np.float32).flatten()
    v2 = np.asarray(vec2, dtype=np.float32).flatten()
    norm1 = np.linalg.norm(v1)
    norm2 = np.linalg.norm(v2)
    if norm1 == 0.0 or norm2 == 0.0:
        return 0.0
    return float(np.dot(v1, v2) / (norm1 * norm2))


# ---------------------------------------------------------------------------
# Base Interface (for JSON now, MongoDB in future)
# ---------------------------------------------------------------------------

class BaseSemanticCache(ABC):
    """Abstract interface for semantic response caching."""

    @abstractmethod
    async def get_cached_response(
        self,
        query: str,
        query_embedding: np.ndarray,
        event_ids: list[str],
    ) -> dict | None:
        """Lookup cached response semantically matching query and event identity."""
        pass

    @abstractmethod
    async def save_cached_response(
        self,
        query: str,
        query_embedding: np.ndarray,
        answer: str,
        sources: list[dict],
        event_ids: list[str],
        event_names: list[str] | None = None,
        retrieved_chunk_ids: list[str] | None = None,
    ) -> dict | None:
        """Save a validated grounded response to the cache."""
        pass

    @abstractmethod
    async def invalidate_cache(self, event_id: str | None = None) -> int:
        """Invalidate entries matching an event_id or all entries if None."""
        pass

    @abstractmethod
    async def clear_cache(self) -> None:
        """Flush the entire cache."""
        pass


# ---------------------------------------------------------------------------
# JSON File Implementation with Safe Concurrency
# ---------------------------------------------------------------------------

class JSONSemanticCache(BaseSemanticCache):
    """Local JSON-file based semantic cache implementation.

    Thread-safe and process-safe using filelock.
    """

    def __init__(self, file_path: Path | None = None):
        settings = get_settings()
        self.file_path = file_path or settings.resolved_cache_path
        self.lock_path = Path(str(self.file_path) + ".lock")
        self._async_lock = asyncio.Lock()
        self._ensure_file_exists()

    def _ensure_file_exists(self) -> None:
        """Ensure parent directory and cache JSON file exist."""
        try:
            self.file_path.parent.mkdir(parents=True, exist_ok=True)
            if not self.file_path.exists():
                with FileLock(str(self.lock_path), timeout=5):
                    if not self.file_path.exists():
                        self.file_path.write_text("[]", encoding="utf-8")
        except Exception as e:
            logger.error("Failed to initialize cache file at %s: %s", self.file_path, e)

    def _read_entries_sync(self) -> list[dict]:
        """Read all entries from the JSON file safely under filelock."""
        with FileLock(str(self.lock_path), timeout=10):
            if not self.file_path.exists():
                return []
            content = self.file_path.read_text(encoding="utf-8").strip()
            if not content:
                return []
            try:
                data = json.loads(content)
                return data if isinstance(data, list) else []
            except json.JSONDecodeError:
                logger.warning("Cache file %s was malformed; resetting to empty list", self.file_path)
                return []

    def _write_entries_sync(self, entries: list[dict]) -> None:
        """Write all entries to the JSON file safely under filelock."""
        with FileLock(str(self.lock_path), timeout=10):
            temp_path = self.file_path.with_suffix(".tmp")
            temp_path.write_text(json.dumps(entries, indent=2, ensure_ascii=False), encoding="utf-8")
            temp_path.replace(self.file_path)

    async def get_cached_response(
        self,
        query: str,
        query_embedding: np.ndarray,
        event_ids: list[str],
    ) -> dict | None:
        """Lookup semantically similar, unexpired, version-compatible cache entry.

        Args:
            query: Raw user query.
            query_embedding: Computed 1D embedding for query.
            event_ids: Detected event IDs for the query (e.g. ['ANANTYA-001']).

        Returns:
            Dict with 'answer' and 'sources' if hit, else None.
        """
        settings = get_settings()
        if not settings.semantic_cache_enabled:
            return None

        current_kv = compute_knowledge_version()
        now = time.time()
        threshold = settings.semantic_cache_threshold
        ttl = settings.semantic_cache_ttl

        query_event_set = set(event_ids)

        async with self._async_lock:
            entries = await asyncio.to_thread(self._read_entries_sync)

        best_entry: dict | None = None
        best_similarity = -1.0

        for entry in entries:
            # 1. Knowledge version check: must match current canonical event data
            if entry.get("knowledge_version") != current_kv:
                continue

            # 2. TTL expiration check
            created_at_ts = entry.get("created_at_ts", 0)
            if ttl > 0 and (now - created_at_ts) > ttl:
                continue

            # 3. Event identity compatibility check
            entry_events = set(entry.get("event_ids", []))
            if entry_events != query_event_set:
                # If query is about DecentraHACK, must not match SHE SOLVES or other events
                continue

            # 4. Sources validation
            if not entry.get("sources"):
                continue

            # 5. Semantic similarity
            stored_emb = entry.get("query_embedding")
            if not stored_emb:
                continue

            sim = compute_cosine_similarity(query_embedding, np.array(stored_emb, dtype=np.float32))
            if sim >= threshold and sim > best_similarity:
                best_similarity = sim
                best_entry = entry

        if best_entry is not None:
            logger.info(
                "Semantic Cache HIT! query='%s' matched='%s' (score=%.4f >= %.4f)",
                query[:60],
                best_entry.get("query", "")[:60],
                best_similarity,
                threshold,
            )
            return {
                "answer": best_entry["answer"],
                "sources": best_entry["sources"],
                "cache_id": best_entry.get("cache_id"),
                "similarity": best_similarity,
            }

        logger.debug("Semantic Cache MISS for query: '%s'", query[:60])
        return None

    async def save_cached_response(
        self,
        query: str,
        query_embedding: np.ndarray,
        answer: str,
        sources: list[dict],
        event_ids: list[str],
        event_names: list[str] | None = None,
        retrieved_chunk_ids: list[str] | None = None,
    ) -> dict | None:
        """Save a successful grounded response to the cache.

        Args:
            query: Raw user question.
            query_embedding: Computed embedding vector.
            answer: LLM response.
            sources: List of source metadata dicts.
            event_ids: Associated canonical event IDs.
            event_names: Associated event names.
            retrieved_chunk_ids: IDs of chunks retrieved from Qdrant.

        Returns:
            The created cache entry dict, or None if not cacheable.
        """
        settings = get_settings()
        if not settings.semantic_cache_enabled:
            return None

        # Validate answer safety and quality
        if not is_cacheable_response(answer, sources):
            logger.info("Response did not pass cache safety check; not caching")
            return None

        now = time.time()
        created_at_iso = datetime.now(timezone.utc).isoformat()
        current_kv = compute_knowledge_version()

        # Extract event names from sources if not provided
        if event_names is None:
            event_names = list({s.get("event_name", "") for s in sources if s.get("event_name")})

        entry = {
            "cache_id": str(uuid.uuid4()),
            "query": query,
            "query_embedding": query_embedding.tolist() if isinstance(query_embedding, np.ndarray) else list(query_embedding),
            "answer": answer,
            "sources": sources,
            "event_ids": event_ids,
            "event_names": event_names,
            "retrieved_chunk_ids": retrieved_chunk_ids or [],
            "knowledge_version": current_kv,
            "created_at": created_at_iso,
            "created_at_ts": now,
        }

        async with self._async_lock:
            entries = await asyncio.to_thread(self._read_entries_sync)
            # Remove any identical query duplicate if existing
            entries = [e for e in entries if e.get("query") != query]
            entries.append(entry)
            await asyncio.to_thread(self._write_entries_sync, entries)

        logger.info(
            "Saved response to Semantic Cache: cache_id=%s, query='%s', events=%s, version=%s",
            entry["cache_id"],
            query[:60],
            event_ids,
            current_kv,
        )
        return entry

    async def invalidate_cache(self, event_id: str | None = None) -> int:
        """Invalidate entries by event_id or all if event_id is None."""
        async with self._async_lock:
            entries = await asyncio.to_thread(self._read_entries_sync)
            orig_len = len(entries)
            if event_id is None:
                new_entries = []
            else:
                new_entries = [e for e in entries if event_id not in e.get("event_ids", [])]
            await asyncio.to_thread(self._write_entries_sync, new_entries)
            deleted_count = orig_len - len(new_entries)
            logger.info("Invalidated %d entries from cache (filter=%s)", deleted_count, event_id)
            return deleted_count

    async def clear_cache(self) -> None:
        """Completely clear cache file."""
        await self.invalidate_cache(event_id=None)


# ---------------------------------------------------------------------------
# Module-level Singleton and Convenience Functions
# ---------------------------------------------------------------------------

_cache_instance: BaseSemanticCache | None = None


def get_semantic_cache() -> BaseSemanticCache:
    """Get the active semantic cache instance."""
    global _cache_instance
    if _cache_instance is None:
        _cache_instance = JSONSemanticCache()
    return _cache_instance


def set_semantic_cache(cache: BaseSemanticCache) -> None:
    """Override the active semantic cache instance (e.g. for tests or MongoDB)."""
    global _cache_instance
    _cache_instance = cache


async def get_cached_response(
    query: str,
    query_embedding: np.ndarray,
    event_ids: list[str],
) -> dict | None:
    """Lookup cached response using active semantic cache."""
    return await get_semantic_cache().get_cached_response(query, query_embedding, event_ids)


async def save_cached_response(
    query: str,
    query_embedding: np.ndarray,
    answer: str,
    sources: list[dict],
    event_ids: list[str],
    event_names: list[str] | None = None,
    retrieved_chunk_ids: list[str] | None = None,
) -> dict | None:
    """Save response using active semantic cache."""
    return await get_semantic_cache().save_cached_response(
        query=query,
        query_embedding=query_embedding,
        answer=answer,
        sources=sources,
        event_ids=event_ids,
        event_names=event_names,
        retrieved_chunk_ids=retrieved_chunk_ids,
    )


async def invalidate_cache(event_id: str | None = None) -> int:
    """Invalidate cache entries using active semantic cache."""
    return await get_semantic_cache().invalidate_cache(event_id)


async def clear_cache() -> None:
    """Clear all cache entries using active semantic cache."""
    await get_semantic_cache().clear_cache()
