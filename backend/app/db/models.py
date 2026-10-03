"""Pydantic schemas and database models for MongoDB collections."""
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator


# ============================================================================
# 1. Chatbot Questions & Conversations Schema
# ============================================================================
class ChatMessageRecord(BaseModel):
    """Schema for persisting chatbot user queries and responses in MongoDB."""
    question: str = Field(..., description="User's query or message")
    answer: str = Field(..., description="Chatbot's response text")
    session_id: Optional[str] = Field(None, description="Client or browser session ID")
    intent: Optional[str] = Field(None, description="Detected intent class")
    event_ids: List[str] = Field(default_factory=list, description="Referenced event IDs")
    sources: List[Dict[str, Any]] = Field(default_factory=list, description="Retrieved RAG source chunks")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    user_id: Optional[str] = Field(None, description="Optional registered user identifier")
    cached: bool = Field(False, description="Whether answer was served from semantic cache")


# ============================================================================
# 2. Contact Page Queries Schema
# ============================================================================
class ContactFormRequest(BaseModel):
    """Schema for incoming contact form submission."""
    name: str = Field(..., min_length=1, max_length=150, description="Full name")
    email: str = Field(..., min_length=3, max_length=150, description="Email address")
    subject: Optional[str] = Field("General Inquiry", max_length=200, description="Message subject")
    message: str = Field(..., min_length=1, max_length=4000, description="Message body")

    @field_validator("name", "message")
    @classmethod
    def clean_required_strings(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Field cannot be empty.")
        return s

    @field_validator("email")
    @classmethod
    def clean_email(cls, v: str) -> str:
        s = v.strip().lower()
        if "@" not in s or len(s) < 3:
            raise ValueError("Please provide a valid email address.")
        return s

    @field_validator("subject")
    @classmethod
    def clean_subject(cls, v: Optional[str]) -> str:
        if not v or not v.strip():
            return "General Inquiry"
        return v.strip()



class ContactFormResponse(BaseModel):
    """Schema for contact form submission response."""
    status: str = "success"
    message: str
    reference_code: str
    created_at: datetime


# ============================================================================
# 3. Visitor Tracking & Telemetry Schema
# ============================================================================
class VisitorTrackRequest(BaseModel):
    """Schema for frontend visitor ping."""
    visitor_id: str = Field(..., min_length=8, max_length=128, description="Unique client session/visitor hash")
    user_agent: Optional[str] = Field(None, max_length=300)
    screen_resolution: Optional[str] = Field(None, max_length=50)


class VisitorTrackResponse(BaseModel):
    """Schema for visitor count response."""
    status: str = "ok"
    total_visitors: int
    is_new_visitor: bool


# ============================================================================
# 4. User Information Schema (Future & Auth extensible)
# ============================================================================
class UserRecord(BaseModel):
    """Schema for user profile records in MongoDB."""
    user_id: str
    name: str
    email: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    role: str = "visitor"
    metadata: Dict[str, Any] = Field(default_factory=dict)


# ============================================================================
# 5. Semantic Cache Schema (Stored in MongoDB Atlas)
# ============================================================================
class SemanticCacheRecord(BaseModel):
    """Schema for semantic cache records stored in MongoDB."""
    cache_id: str = Field(..., description="Unique UUID for cache entry")
    query: str = Field(..., description="Normalized user query text")
    query_embedding: List[float] = Field(..., description="1D embedding vector for query")
    answer: str = Field(..., description="Grounded chatbot answer text")
    sources: List[Dict[str, Any]] = Field(default_factory=list, description="Grounded source metadata")
    event_ids: List[str] = Field(default_factory=list, description="Matched event IDs")
    event_names: List[str] = Field(default_factory=list, description="Matched event names")
    retrieved_chunk_ids: List[str] = Field(default_factory=list, description="Qdrant chunk IDs")
    knowledge_version: str = Field(..., description="Canonical event knowledge hash version")
    created_at: str = Field(..., description="ISO timestamp of creation")
    created_at_ts: float = Field(..., description="Epoch timestamp for TTL checking")

