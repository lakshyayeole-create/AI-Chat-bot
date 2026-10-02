"""Pydantic models for the Chat API request and response."""
from pydantic import BaseModel, field_validator


class ChatRequest(BaseModel):
    """Request body for POST /api/chat.

    Attributes:
        message: User's question text. Must be non-empty and within
            the configured maximum length.
    """
    message: str
    session_id: str | None = None
    user_id: str | None = None

    @field_validator("message")
    @classmethod
    def message_must_not_be_empty(cls, v: str) -> str:
        """Validate that the message is not empty or whitespace-only."""
        stripped = v.strip()
        if not stripped:
            raise ValueError("Message must not be empty or whitespace-only.")
        if len(stripped) > 1000:
            raise ValueError(
                f"Message is too long ({len(stripped)} chars). "
                "Maximum allowed is 1000 characters."
            )
        return stripped


class SourceInfo(BaseModel):
    """Source metadata for a retrieved event.

    Attributes:
        event_id: Unique event identifier (e.g., ANT-001).
        event_name: Human-readable event name.
        source_file: Filename of the source knowledge file.
    """
    event_id: str
    event_name: str
    source_file: str


class ChatResponse(BaseModel):
    """Response body for POST /api/chat.

    Supports both immediate cache hits and queued cache misses.

    Attributes:
        status: Status string ("completed", "queued", "processing", "failed").
        job_id: Unique job ID if queued.
        answer: LLM-generated answer grounded in event context (if completed).
        sources: List of source events used to generate the answer.
        error: Error message if failed.
    """
    status: str | None = None
    job_id: str | None = None
    answer: str | None = None
    sources: list[SourceInfo] = []
    error: str | None = None


class JobStatusResponse(BaseModel):
    """Response body for GET /api/chat/status/{job_id}.

    Attributes:
        status: "queued", "processing", "completed", or "failed".
        job_id: Unique job identifier.
        answer: Completed answer if available.
        sources: Sources used if available.
        error: Error description if failed.
    """
    status: str
    job_id: str
    answer: str | None = None
    sources: list[SourceInfo] = []
    error: str | None = None
