"""Automated tests for Semantic Cache (JSON & MongoDB implementations)."""
import pytest
import numpy as np
from unittest.mock import AsyncMock, MagicMock, patch

from app.rag.semantic_cache import (
    JSONSemanticCache,
    MongoDBSemanticCache,
    compute_cosine_similarity,
    is_cacheable_response,
    get_semantic_cache,
    set_semantic_cache,
)


def test_cosine_similarity_identical():
    v1 = np.array([1.0, 0.0, 0.0])
    v2 = np.array([1.0, 0.0, 0.0])
    assert abs(compute_cosine_similarity(v1, v2) - 1.0) < 1e-5


def test_cosine_similarity_orthogonal():
    v1 = np.array([1.0, 0.0, 0.0])
    v2 = np.array([0.0, 1.0, 0.0])
    assert abs(compute_cosine_similarity(v1, v2) - 0.0) < 1e-5


def test_is_cacheable_response_valid():
    sources = [{"event_id": "ANANTYA-001", "source_file": "decentrahack.md"}]
    assert is_cacheable_response("DecentraHack prize pool is 15,000 INR.", sources) is True


def test_is_cacheable_response_unavailable():
    sources = [{"event_id": "ANANTYA-001", "source_file": "decentrahack.md"}]
    assert is_cacheable_response("Information is not available in the provided context.", sources) is False


def test_is_cacheable_response_empty_or_no_sources():
    assert is_cacheable_response("", [{"event_id": "A", "source_file": "B"}]) is False
    assert is_cacheable_response("Valid answer", []) is False


@pytest.mark.asyncio
async def test_json_semantic_cache_lifecycle(tmp_path):
    cache_file = tmp_path / "cache.json"
    cache = JSONSemanticCache(file_path=cache_file)

    query_vec = np.array([0.5, 0.5, 0.5])
    sources = [{"event_id": "ANANTYA-001", "source_file": "decentrahack.md"}]

    # Initially empty
    hit = await cache.get_cached_response("What is DecentraHack?", query_vec, ["ANANTYA-001"])
    assert hit is None

    # Save entry
    saved = await cache.save_cached_response(
        query="What is DecentraHack?",
        query_embedding=query_vec,
        answer="It is a 3-round Web3 and AI hackathon.",
        sources=sources,
        event_ids=["ANANTYA-001"],
    )
    assert saved is not None

    # Retrieve with identical vector
    hit = await cache.get_cached_response("What is DecentraHack?", query_vec, ["ANANTYA-001"])
    assert hit is not None
    assert hit["answer"] == "It is a 3-round Web3 and AI hackathon."

    # Invalidate
    deleted = await cache.invalidate_cache("ANANTYA-001")
    assert deleted == 1
    hit_after = await cache.get_cached_response("What is DecentraHack?", query_vec, ["ANANTYA-001"])
    assert hit_after is None


@pytest.mark.asyncio
async def test_mongodb_semantic_cache_fallback_when_disconnected(tmp_path):
    """When MongoDB is not connected, MongoDBSemanticCache delegates safely to fallback."""
    fallback = JSONSemanticCache(file_path=tmp_path / "cache.json")
    cache = MongoDBSemanticCache(fallback_cache=fallback)

    with patch("app.db.mongodb.get_semantic_cache_collection", return_value=None):
        query_vec = np.array([1.0, 0.0, 0.0])
        sources = [{"event_id": "ANANTYA-002", "source_file": "shesolves.md"}]

        # Save via fallback
        saved = await cache.save_cached_response(
            query="Tell me about She Solves",
            query_embedding=query_vec,
            answer="She Solves is a women-oriented hackathon.",
            sources=sources,
            event_ids=["ANANTYA-002"],
        )
        assert saved is not None

        # Lookup via fallback
        hit = await cache.get_cached_response("Tell me about She Solves", query_vec, ["ANANTYA-002"])
        assert hit is not None
        assert "She Solves" in hit["answer"]


@pytest.mark.asyncio
async def test_mongodb_semantic_cache_with_mocked_collection():
    """Verify MongoDBSemanticCache saves to and reads from MongoDB collection."""
    mock_col = MagicMock()
    mock_col.replace_one = AsyncMock()
    mock_cursor = MagicMock()
    mock_cursor.sort.return_value = mock_cursor
    mock_cursor.limit.return_value = mock_cursor

    stored_doc = {
        "_id": "mock_id_123",
        "cache_id": "mock_id_123",
        "query": "Who can participate?",
        "query_embedding": [1.0, 0.0, 0.0],
        "answer": "All engineering students can participate.",
        "sources": [{"event_id": "ANANTYA-001", "source_file": "info.md"}],
        "event_ids": ["ANANTYA-001"],
        "knowledge_version": "v_test",
        "created_at_ts": 9999999999.0,
    }
    mock_cursor.to_list = AsyncMock(return_value=[stored_doc])
    mock_col.find.return_value = mock_cursor
    mock_col.delete_many = AsyncMock(return_value=MagicMock(deleted_count=1))

    cache = MongoDBSemanticCache()

    with patch("app.db.mongodb.get_semantic_cache_collection", return_value=mock_col):
        with patch("app.rag.semantic_cache.compute_knowledge_version", return_value="v_test"):
            query_vec = np.array([1.0, 0.0, 0.0])

            # 1. Lookup
            hit = await cache.get_cached_response("Who can participate?", query_vec, ["ANANTYA-001"])
            assert hit is not None
            assert hit["answer"] == "All engineering students can participate."

            # 2. Save
            await cache.save_cached_response(
                query="Who can participate?",
                query_embedding=query_vec,
                answer="All engineering students can participate.",
                sources=[{"event_id": "ANANTYA-001", "source_file": "info.md"}],
                event_ids=["ANANTYA-001"],
            )
            mock_col.replace_one.assert_called_once()

            # 3. Invalidate
            deleted = await cache.invalidate_cache("ANANTYA-001")
            assert deleted == 1
