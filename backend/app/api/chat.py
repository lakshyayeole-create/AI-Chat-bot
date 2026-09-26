"""Chat API endpoint.

Provides the single public chatbot endpoint: POST /api/chat
"""
from fastapi import APIRouter, HTTPException

from app.core.logging_config import get_logger
from app.models.chat import ChatRequest, ChatResponse, SourceInfo
from app.rag.pipeline import process_chat

logger = get_logger(__name__)

router = APIRouter(prefix="/api", tags=["Chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    """Process a user's question and return a grounded answer.

    This is the single public chatbot endpoint. It runs the full RAG
    pipeline: embed query → retrieve chunks → build context → LLM → response.

    Args:
        request: ChatRequest with the user's message.

    Returns:
        ChatResponse with the answer and source metadata.
    """
    logger.info("Chat request received: '%s'", request.message[:80])

    try:
        result = await process_chat(request.message)

        sources = [
            SourceInfo(
                event_id=s.get("event_id", ""),
                event_name=s.get("event_name", ""),
                source_file=s.get("source_file", ""),
            )
            for s in result.get("sources", [])
        ]

        return ChatResponse(
            answer=result["answer"],
            sources=sources,
        )

    except RuntimeError as e:
        logger.error("Chat pipeline error: %s", str(e))
        raise HTTPException(
            status_code=503,
            detail=str(e),
        )
    except Exception as e:
        logger.error("Unexpected error in chat endpoint: %s", str(e))
        raise HTTPException(
            status_code=500,
            detail=str(e),
        )
