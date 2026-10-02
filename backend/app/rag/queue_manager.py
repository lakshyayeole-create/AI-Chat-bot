"""In-process request queue and worker pool for cache misses.

Manages asynchronous worker tasks distributing jobs across Gemini API keys,
enforces duplicate query deduplication, and coordinates retrieval, LLM generation,
and semantic cache saving.
"""
import asyncio
from dataclasses import dataclass, field
import time
import uuid
import numpy as np

from app.core.config import get_settings
from app.core.logging_config import get_logger
from app.rag.retriever import (
    retrieve,
    retrieve_multi_event,
    QueryIntent,
)
from app.rag.pipeline import build_context, build_comparison_context, extract_sources
from app.llm import client as llm_client
from app.rag.semantic_cache import (
    save_cached_response,
    compute_cosine_similarity,
)

logger = get_logger(__name__)


@dataclass
class ChatJob:
    """Represents a queued chat processing job."""
    job_id: str
    message: str
    clean_query: str
    query_vector: np.ndarray
    intent: QueryIntent
    event_ids: list[str]
    session_id: str | None = None
    user_id: str | None = None
    status: str = "queued"  # "queued", "processing", "completed", "failed"
    created_at: float = field(default_factory=time.time)
    result: dict | None = None
    error: str | None = None
    completed_event: asyncio.Event = field(default_factory=asyncio.Event)


class QueueManager:
    """Manages the in-process job queue, worker pool, and in-flight deduplication."""

    def __init__(self):
        self._queue: asyncio.Queue[ChatJob] = asyncio.Queue()
        self._jobs: dict[str, ChatJob] = {}
        self._in_flight: list[ChatJob] = []
        self._workers: list[asyncio.Task] = []
        self._lock = asyncio.Lock()
        self._is_running = False

    def is_running(self) -> bool:
        return self._is_running

    def get_job(self, job_id: str) -> ChatJob | None:
        """Retrieve job status by job_id."""
        return self._jobs.get(job_id)

    async def enqueue_job(
        self,
        message: str,
        clean_query: str,
        query_vector: np.ndarray,
        intent: QueryIntent,
        event_ids: list[str],
        session_id: str | None = None,
        user_id: str | None = None,
    ) -> ChatJob:
        """Enqueue a chat job or attach to an existing in-flight matching job.

        Addresses Duplicate Request Handling (Section 11): If two users ask
        semantically equivalent questions around the same time before the first
        is cached, they share the in-flight job without duplicate Gemini calls.

        Args:
            message: User raw message.
            clean_query: Normalized query.
            query_vector: Precomputed query embedding vector.
            intent: Query intent.
            event_ids: Detected canonical event IDs.
            session_id: Optional client session token.
            user_id: Optional user identifier.

        Returns:
            The queued ChatJob (either newly created or existing in-flight).
        """
        settings = get_settings()
        threshold = settings.semantic_cache_threshold

        async with self._lock:
            # Check for in-flight jobs that match event context and query similarity
            for inflight_job in self._in_flight:
                if inflight_job.status in ("queued", "processing"):
                    if set(inflight_job.event_ids) == set(event_ids):
                        sim = compute_cosine_similarity(query_vector, inflight_job.query_vector)
                        if sim >= threshold:
                            logger.info(
                                "Duplicate in-flight query detected! Reusing job %s (sim=%.4f >= %.4f) "
                                "for query '%s'",
                                inflight_job.job_id,
                                sim,
                                threshold,
                                message[:60],
                            )
                            return inflight_job

            # Create new job
            job_id = str(uuid.uuid4())
            job = ChatJob(
                job_id=job_id,
                message=message,
                clean_query=clean_query,
                query_vector=query_vector,
                intent=intent,
                event_ids=event_ids,
                session_id=session_id,
                user_id=user_id,
                status="queued",
            )
            self._jobs[job_id] = job
            self._in_flight.append(job)
            await self._queue.put(job)
            logger.info("Enqueued new chat job %s (queue size=%d)", job_id, self._queue.qsize())
            return job

    async def _worker_loop(self, worker_id: int):
        """Worker task processing jobs from the queue with dedicated primary Gemini key."""
        logger.info("Worker [%d] started", worker_id)
        while self._is_running:
            try:
                # Wait for next job
                job = await self._queue.get()
            except asyncio.CancelledError:
                break

            try:
                job.status = "processing"
                logger.info("Worker [%d] processing job %s: '%s'", worker_id, job.job_id, job.message[:60])

                # Process job: Qdrant retrieval + grounded context + Gemini + save cache
                result = await self._process_job(job, worker_id)

                job.result = result
                job.status = "completed"
                logger.info("Worker [%d] completed job %s successfully", worker_id, job.job_id)

                # Persist completed chat interaction to MongoDB
                try:
                    from app.db.chat_logger import log_chat_interaction
                    asyncio.create_task(
                        log_chat_interaction(
                            question=job.message,
                            answer=result.get("answer", "") if result else "",
                            session_id=job.session_id,
                            intent=job.intent.value if hasattr(job.intent, "value") else str(job.intent),
                            event_ids=job.event_ids,
                            sources=result.get("sources", []) if result else [],
                            cached=False,
                            user_id=job.user_id,
                        )
                    )
                except Exception as log_err:
                    logger.warning("Could not persist worker chat interaction to MongoDB: %s", log_err)

            except Exception as e:
                logger.error("Worker [%d] failed processing job %s: %s", worker_id, job.job_id, e, exc_info=True)
                job.status = "failed"
                job.error = "Our event assistant encountered an issue processing your question. Please try again."


            finally:
                job.completed_event.set()
                async with self._lock:
                    if job in self._in_flight:
                        self._in_flight.remove(job)
                self._queue.task_done()

        logger.info("Worker [%d] stopped", worker_id)

    async def _process_job(self, job: ChatJob, worker_id: int) -> dict:
        """Run the Qdrant retrieval, grounded context build, Gemini call, and cache save."""
        # Step 1: Qdrant retrieval (reusing the precomputed query_vector!)
        if job.intent == QueryIntent.MULTI_EVENT:
            results = retrieve_multi_event(
                query=job.message,
                event_ids=job.event_ids,
                query_vector=job.query_vector,
            )
            context = build_comparison_context(results, job.event_ids)
        else:
            results = retrieve(
                query=job.message,
                query_vector=job.query_vector,
            )
            context = build_context(results)

        # Step 2: Extract sources
        sources = extract_sources(results)

        # Step 3: Call Gemini API using worker_id as preferred key index
        answer = await llm_client.generate_answer(
            question=job.message,
            context=context,
            preferred_key_index=worker_id,
        )

        # Step 4: Extract metadata for cache
        chunk_ids = [r.metadata.get("chunk_id", "") for r in results if r.metadata.get("chunk_id")]
        event_names = list({r.metadata.get("event_name", "") for r in results if r.metadata.get("event_name")})

        # Step 5: Save successful grounded response to cache
        try:
            await save_cached_response(
                query=job.message,
                query_embedding=job.query_vector,
                answer=answer,
                sources=sources,
                event_ids=job.event_ids,
                event_names=event_names,
                retrieved_chunk_ids=chunk_ids,
            )
        except Exception as e:
            logger.error("Failed to save response to cache (non-fatal): %s", e)

        return {
            "answer": answer,
            "sources": sources,
        }

    def start_workers(self, num_workers: int | None = None) -> None:
        """Start background worker pool."""
        if self._is_running:
            return

        settings = get_settings()
        if num_workers is None:
            num_workers = settings.num_workers

        self._is_running = True
        self._workers = []
        for i in range(num_workers):
            task = asyncio.create_task(self._worker_loop(worker_id=i))
            self._workers.append(task)
        logger.info("Started %d queue workers", num_workers)

    async def stop_workers(self) -> None:
        """Stop background worker pool."""
        self._is_running = False
        for task in self._workers:
            task.cancel()
        if self._workers:
            await asyncio.gather(*self._workers, return_exceptions=True)
        self._workers = []
        logger.info("All queue workers stopped")


# Module-level singleton
_queue_manager: QueueManager | None = None


def get_queue_manager() -> QueueManager:
    """Get or initialize the global QueueManager."""
    global _queue_manager
    if _queue_manager is None:
        _queue_manager = QueueManager()
    return _queue_manager


def set_queue_manager(qm: QueueManager) -> None:
    """Override the global QueueManager (e.g. for testing)."""
    global _queue_manager
    _queue_manager = qm
