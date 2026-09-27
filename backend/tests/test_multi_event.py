"""Tests for multi-event and comparison query handling.

Covers:
- Intent classification (GENERAL / SINGLE_EVENT / MULTI_EVENT)
- Multi-event detection (detect_all_event_ids)
- Multi-event retrieval (retrieve_multi_event)
- Regression: single-event queries still work
- Regression: general / discovery queries still work
"""
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

import pytest
from app.rag.loader import load_documents
from app.rag.chunker import chunk_documents
from app.rag.embeddings import embed_texts
from app.rag.qdrant_store import (
    init_collection,
    upload_points,
)
from app.rag.retriever import (
    detect_all_event_ids,
    classify_intent,
    retrieve,
    retrieve_multi_event,
    QueryIntent,
)


# ---------------------------------------------------------------------------
# Fixture: build a Qdrant collection from ALL event files so that
# multi-event queries have data to work with.
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module", autouse=True)
def setup_full_index():
    """Build a Qdrant collection from all event files."""
    event_info_dir = backend_dir.parent / "event_info"

    if not event_info_dir.exists() or not list(event_info_dir.glob("*.txt")):
        pytest.skip("Event files not found — cannot test retrieval")

    all_docs = load_documents(event_info_dir)
    chunks = chunk_documents(all_docs)
    texts = [c.text for c in chunks]
    metadata = [{**c.metadata, "chunk_text": c.text} for c in chunks]
    vectors = embed_texts(texts)

    dimension = vectors.shape[1]
    init_collection(dimension)
    upload_points(vectors, metadata)

    yield


# =====================================================================
# 1. Unit tests for intent classification
# =====================================================================

class TestClassifyIntent:
    """Verify that classify_intent returns the right intent + event_ids."""

    def test_general_no_event(self):
        intent, eids = classify_intent("What events are at Anantya?")
        assert intent == QueryIntent.GENERAL
        assert eids == []

    def test_single_event_iothrone(self):
        intent, eids = classify_intent("What is the prize of IoThrone?")
        assert intent == QueryIntent.SINGLE_EVENT
        assert eids == ["ANANTYA-004"]

    def test_single_event_she_solves(self):
        intent, eids = classify_intent("Tell me about She Solves 3.0")
        assert intent == QueryIntent.SINGLE_EVENT
        assert eids == ["ANANTYA-002"]

    def test_multi_event_decentrahack_and_she_solves(self):
        intent, eids = classify_intent(
            "What is the difference between DecentraHACK and SHE SOLVES?"
        )
        assert intent == QueryIntent.MULTI_EVENT
        assert set(eids) == {"ANANTYA-001", "ANANTYA-002"}

    def test_multi_event_codigo_vs_byteme(self):
        intent, eids = classify_intent("Compare Codigo and BYTE ME CTF")
        assert intent == QueryIntent.MULTI_EVENT
        assert set(eids) == {"ANANTYA-007", "ANANTYA-003"}

    def test_multi_event_three_events(self):
        intent, eids = classify_intent(
            "Compare IoThrone, MasterChef, and Codigo"
        )
        assert intent == QueryIntent.MULTI_EVENT
        assert set(eids) == {"ANANTYA-004", "ANANTYA-005", "ANANTYA-007"}


# =====================================================================
# 2. Unit tests for detect_all_event_ids
# =====================================================================

class TestDetectAllEventIds:
    """Verify all events in a query are detected."""

    def test_two_events(self):
        eids = detect_all_event_ids(
            "difference between DecentraHACK and She Solves"
        )
        assert set(eids) == {"ANANTYA-001", "ANANTYA-002"}

    def test_no_events(self):
        eids = detect_all_event_ids("Hello, what events are there?")
        assert eids == []

    def test_single_event(self):
        eids = detect_all_event_ids("Tell me about Codigo")
        assert eids == ["ANANTYA-007"]

    def test_direct_event_ids(self):
        eids = detect_all_event_ids("Compare ANANTYA-001 and ANANTYA-003")
        assert set(eids) == {"ANANTYA-001", "ANANTYA-003"}


# =====================================================================
# 3. Integration tests for multi-event retrieval
# =====================================================================

class TestMultiEventRetrieval:
    """Integration tests requiring a populated Qdrant collection."""

    def test_comparison_decentrahack_vs_she_solves(self):
        """'What is the difference between DecentraHACK and SHE SOLVES?'
        must return chunks from BOTH events."""
        query = "What is the difference between DecentraHACK and SHE SOLVES?"
        _, event_ids = classify_intent(query)
        results = retrieve_multi_event(query, event_ids, similarity_threshold=0.1)

        assert len(results) > 0, "No results returned"

        event_ids_in_results = {r.metadata["event_id"] for r in results}
        assert "ANANTYA-001" in event_ids_in_results, (
            "Missing DecentraHACK chunks in comparison results"
        )
        assert "ANANTYA-002" in event_ids_in_results, (
            "Missing She Solves chunks in comparison results"
        )

    def test_comparison_codigo_vs_byteme(self):
        """'Compare Codigo and BYTE ME CTF' must return chunks from BOTH."""
        query = "Compare Codigo and BYTE ME CTF"
        _, event_ids = classify_intent(query)
        results = retrieve_multi_event(query, event_ids, similarity_threshold=0.1)

        assert len(results) > 0, "No results returned"

        event_ids_in_results = {r.metadata["event_id"] for r in results}
        assert "ANANTYA-007" in event_ids_in_results, (
            "Missing Codigo chunks in comparison results"
        )
        assert "ANANTYA-003" in event_ids_in_results, (
            "Missing BYTEME CTF chunks in comparison results"
        )


# =====================================================================
# 4. Regression: single-event queries still work
# =====================================================================

class TestSingleEventRegression:
    """Existing single-event queries must not break."""

    def test_iothrone_prize(self):
        """'What is the prize of IoThrone?' — single event."""
        results = retrieve(
            "What is the prize of IoThrone?",
            top_k=5,
            similarity_threshold=0.1,
        )
        assert len(results) > 0, "No results for IoThrone prize query"

        # All results should belong to IoThrone
        for r in results:
            assert r.metadata["event_id"] == "ANANTYA-004", (
                f"Expected ANANTYA-004, got {r.metadata['event_id']}"
            )

    def test_she_solves_team_size(self):
        """'What is the team size for She Solves?' — single event."""
        results = retrieve(
            "What is the team size for She Solves?",
            top_k=5,
            similarity_threshold=0.1,
        )
        assert len(results) > 0


# =====================================================================
# 5. General / discovery queries (no event filter)
# =====================================================================

class TestGeneralQueries:
    """General queries that should retrieve across all events."""

    def test_cybersecurity_discovery(self):
        """'What events are related to cybersecurity?' — should find
        BYTEME CTF (and possibly DecentraHACK)."""
        results = retrieve(
            "What events are related to cybersecurity?",
            top_k=10,
            similarity_threshold=0.1,
        )
        assert len(results) > 0, "No results for cybersecurity query"

        all_text = " ".join(r.text.lower() for r in results)
        assert "ctf" in all_text or "cybersecurity" in all_text, (
            "Expected cybersecurity-related content in results"
        )

    def test_general_registration_fee(self):
        """'What is the registration fee?' without event name."""
        results = retrieve(
            "What is the registration fee?",
            top_k=10,
            similarity_threshold=0.1,
        )
        assert len(results) > 0
