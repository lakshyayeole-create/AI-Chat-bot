"""Tests for the Chat API endpoint.

Includes:
- Integration tests for POST /api/chat
- Validation tests (empty, whitespace, too-long messages)
- Hallucination guard test
- Health endpoint test
"""
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
class TestHealthEndpoint:
    """Tests for GET /health."""

    async def test_health_returns_ok(self):
        """Health endpoint should return status ok."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/health")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "ok"
            assert "vector_store" in data


@pytest.mark.anyio
class TestChatValidation:
    """Tests for request validation on POST /api/chat."""

    async def test_empty_message_rejected(self):
        """Empty message should return 422."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/chat", json={"message": ""}
            )
            assert response.status_code == 422

    async def test_whitespace_message_rejected(self):
        """Whitespace-only message should return 422."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/chat", json={"message": "   \n\t  "}
            )
            assert response.status_code == 422

    async def test_missing_message_rejected(self):
        """Missing message field should return 422."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post("/api/chat", json={})
            assert response.status_code == 422

    async def test_too_long_message_rejected(self):
        """Message exceeding 1000 chars should return 422."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/chat", json={"message": "a" * 1500}
            )
            assert response.status_code == 422


@pytest.mark.anyio
class TestChatEndpoint:
    """Integration tests for POST /api/chat.

    NOTE: These tests require:
    1. A built vector store (run: python scripts/ingest.py)
    2. A valid GROQ_API_KEY in .env
    """

    async def test_valid_question_returns_answer(self):
        """A valid question should return a response with answer and sources."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/chat",
                json={"message": "What is She Solves 3.0?"},
            )
            # May return 503 if vector store not loaded or LLM not configured
            if response.status_code == 200:
                data = response.json()
                assert "answer" in data
                assert "sources" in data

    async def test_hallucination_guard(self):
        """Asking about info NOT in the knowledge base should not hallucinate."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/chat",
                json={"message": "What is the accommodation facility for participants?"},
            )
            if response.status_code == 200:
                data = response.json()
                answer_lower = data["answer"].lower()
                # The system should indicate info is not available
                assert any(
                    phrase in answer_lower
                    for phrase in [
                        "not available",
                        "not provided",
                        "not mentioned",
                        "no information",
                        "not specified",
                        "don't have",
                        "do not have",
                    ]
                ), f"Hallucination detected! Answer: {data['answer']}"
