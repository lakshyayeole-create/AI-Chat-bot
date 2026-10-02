"""Chat API router with Semantic Cache and Queue System.

Endpoints:
- POST /api/chat:
    Generates query embedding ONCE.
    Checks semantic cache first:
      - CACHE HIT: Returns grounded answer immediately.
      - CACHE MISS: Adds request to in-process queue and returns job_id for frontend polling.
- GET /api/chat/status/{job_id}:
    Polls queue job status and returns completed answer and source metadata.
"""
from fastapi import APIRouter, HTTPException, Query

from app.core.logging_config import get_logger
from app.models.chat import (
    ChatRequest,
    ChatResponse,
    JobStatusResponse,
    SourceInfo,
)
from app.rag import embeddings
from app.rag.retriever import (
    classify_intent,
    normalize_query,
)
from app.rag.semantic_cache import get_cached_response
from app.rag.queue_manager import get_queue_manager

logger = get_logger(__name__)

router = APIRouter(prefix="/api", tags=["Chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, wait: bool = Query(False, description="Wait for completion synchronously")) -> ChatResponse:
    """Process a user's question with Semantic Cache lookup and request queue.

    Request Pipeline:
    1. Normalize query and detect intent / event IDs.
    2. Generate query embedding ONCE.
    3. Semantic Cache lookup:
       - CACHE HIT: Return cached response immediately.
       - CACHE MISS: Add request to queue, worker processes with Qdrant + Gemini.
         Returns status 'queued' and job_id (or waits if wait=True).
    """
    logger.info("Chat request received: '%s' (wait=%s)", request.message[:80], wait)

    try:
        # Step 1: Normalize query and classify intent
        clean_query = normalize_query(request.message)
        intent, event_ids = classify_intent(request.message)

        # Step 2: Generate query embedding ONCE
        query_vector = embeddings.embed_text(clean_query)

        # Step 3: Semantic Cache lookup BEFORE queue
        cached = await get_cached_response(
            query=request.message,
            query_embedding=query_vector,
            event_ids=event_ids,
        )

        if cached is not None:
            logger.info("Semantic Cache HIT for '%s'", request.message[:60])
            sources = [
                SourceInfo(
                    event_id=s.get("event_id", ""),
                    event_name=s.get("event_name", ""),
                    source_file=s.get("source_file", ""),
                )
                for s in cached.get("sources", [])
            ]

            # Persist cache-hit interaction to MongoDB
            try:
                import asyncio
                from app.db.chat_logger import log_chat_interaction
                asyncio.create_task(
                    log_chat_interaction(
                        question=request.message,
                        answer=cached["answer"],
                        session_id=request.session_id,
                        intent=intent.value if hasattr(intent, "value") else str(intent),
                        event_ids=event_ids,
                        sources=cached.get("sources", []),
                        cached=True,
                        user_id=request.user_id,
                    )
                )
            except Exception as log_err:
                logger.warning("Could not persist cache-hit chat to MongoDB: %s", log_err)

            return ChatResponse(
                status="completed",
                answer=cached["answer"],
                sources=sources,
            )

        # Step 4: CACHE MISS -> Enqueue job for background worker
        logger.info("Semantic Cache MISS for '%s' -> Enqueueing job", request.message[:60])
        queue_mgr = get_queue_manager()
        if not queue_mgr._workers:
            logger.info("Starting queue manager workers on-demand")
            await queue_mgr.start_workers()

        job = await queue_mgr.enqueue_job(
            message=request.message,
            clean_query=clean_query,
            query_vector=query_vector,
            intent=intent,
            event_ids=event_ids,
            session_id=request.session_id,
            user_id=request.user_id,
        )


        # If synchronous wait is requested (e.g. legacy/testing)
        if wait:
            import asyncio
            try:
                await asyncio.wait_for(job.completed_event.wait(), timeout=30.0)
            except asyncio.TimeoutError:
                raise HTTPException(
                    status_code=504,
                    detail="Job processing timed out after 30 seconds",
                )
            if job.status == "completed" and job.result:
                sources = [
                    SourceInfo(
                        event_id=s.get("event_id", ""),
                        event_name=s.get("event_name", ""),
                        source_file=s.get("source_file", ""),
                    )
                    for s in job.result.get("sources", [])
                ]
                return ChatResponse(
                    status="completed",
                    job_id=job.job_id,
                    answer=job.result["answer"],
                    sources=sources,
                )
            else:
                raise HTTPException(
                    status_code=503,
                    detail=job.error or "Job failed to process",
                )

        # Default asynchronous behavior for frontend polling
        return ChatResponse(
            status="queued",
            job_id=job.job_id,
        )

    except HTTPException:
        raise
    except RuntimeError as e:
        logger.error("Runtime error in chat endpoint: %s", str(e))
        raise HTTPException(
            status_code=503,
            detail=str(e),
        )
    except Exception as e:
        logger.error("Unexpected error in chat endpoint: %s", str(e), exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An internal server error occurred while processing your message.",
        )


@router.get("/chat/status/{job_id}", response_model=JobStatusResponse)
async def get_chat_status(job_id: str) -> JobStatusResponse:
    """Poll the status of a queued chat processing job.

    Returns:
        JobStatusResponse with 'queued', 'processing', 'completed', or 'failed'.
    """
    queue_mgr = get_queue_manager()
    job = queue_mgr.get_job(job_id)

    if job is None:
        raise HTTPException(
            status_code=404,
            detail=f"Job '{job_id}' not found.",
        )

    if job.status == "completed" and job.result:
        sources = [
            SourceInfo(
                event_id=s.get("event_id", ""),
                event_name=s.get("event_name", ""),
                source_file=s.get("source_file", ""),
            )
            for s in job.result.get("sources", [])
        ]
        return JobStatusResponse(
            status="completed",
            job_id=job.job_id,
            answer=job.result["answer"],
            sources=sources,
        )

    if job.status == "failed":
        return JobStatusResponse(
            status="failed",
            job_id=job.job_id,
            error=job.error or "Error processing question",
        )

    return JobStatusResponse(
        status=job.status,
        job_id=job.job_id,
    )
