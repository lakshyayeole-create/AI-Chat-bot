"""Pydantic models for the Chat API request and response."""
from pydantic import BaseModel, field_validator


class ChatRequest(BaseModel):
    """Request body for POST /api/chat.

    Attributes:
        message: User's question text. Must be non-empty and within
            the configured maximum length.
    """
    message: str

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

    Attributes:
        answer: LLM-generated answer grounded in event context.
        sources: List of source events used to generate the answer.
    """
    answer: str
    sources: list[SourceInfo] = []
