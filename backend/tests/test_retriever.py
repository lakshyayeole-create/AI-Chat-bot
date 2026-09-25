"""Tests for the retrieval pipeline.

Uses the She Solves event file as the test knowledge base.
Tests the 12 example questions from the spec.
"""
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

import pytest
from app.rag.loader import load_documents
from app.rag.chunker import chunk_documents
from app.rag.embeddings import embed_texts, embed_text
from app.rag.vector_store import (
    build_index,
    save_index,
    load_index,
    search,
    get_metadata_by_index,
    reset_cache,
)
from app.rag.retriever import retrieve


@pytest.fixture(scope="module", autouse=True)
def setup_test_index():
    """Build a test FAISS index from the She Solves event file."""
    event_info_dir = backend_dir.parent / "event_info"

    if not event_info_dir.exists() or not list(event_info_dir.glob("*.txt")):
        pytest.skip("Event files not found — cannot test retrieval")

    # Reset any cached state
    reset_cache()

    # Build index specifically from the She Solves event file as designed in spec
    all_docs = load_documents(event_info_dir)
    docs = [d for d in all_docs if "she_solves" in d.metadata["source_file"].lower()]
    if not docs:
        docs = all_docs
    chunks = chunk_documents(docs)
    texts = [c.text for c in chunks]
    metadata = [{**c.metadata, "chunk_text": c.text} for c in chunks]
    vectors = embed_texts(texts)

    # Save to a dedicated test location so production vector_store is never overwritten
    test_store = backend_dir / "vector_store_test"
    test_store.mkdir(parents=True, exist_ok=True)
    index = build_index(vectors)
    save_index(index, metadata, test_store)

    # Load it for retrieval
    reset_cache()
    load_index(test_store)

    yield

    # Cleanup test store and restore main index
    reset_cache()
    if test_store.exists():
        import shutil
        shutil.rmtree(test_store, ignore_errors=True)
    main_store = backend_dir / "vector_store"
    if main_store.exists():
        load_index(main_store)


class TestRetrieval:
    """Test the 12 example questions from the spec."""

    def _assert_retrieval_has_content(self, query: str, expected_keywords: list[str]):
        """Helper: retrieve for a query and check keywords appear in results."""
        results = retrieve(query, top_k=5, similarity_threshold=0.1)
        assert len(results) > 0, f"No results for: {query}"

        all_text = " ".join(r.text.lower() for r in results)
        for keyword in expected_keywords:
            assert keyword.lower() in all_text, (
                f"Expected '{keyword}' in retrieval results for: {query}"
            )

    def test_01_what_is_she_solves(self):
        """Q: What is She Solves 3.0?"""
        self._assert_retrieval_has_content(
            "What is She Solves 3.0?",
            ["she solves", "hackathon"],
        )

    def test_02_who_can_participate(self):
        """Q: Who can participate?"""
        self._assert_retrieval_has_content(
            "Who can participate?",
            ["female"],
        )

    def test_03_team_size(self):
        """Q: What is the team size?"""
        self._assert_retrieval_has_content(
            "What is the team size?",
            ["2 to 4"],
        )

    def test_04_when_is_round_2(self):
        """Q: When is Round 2?"""
        self._assert_retrieval_has_content(
            "When is Round 2?",
            ["5 october"],
        )

    def test_05_where_is_round_3(self):
        """Q: Where is Round 3?"""
        self._assert_retrieval_has_content(
            "Where is Round 3?",
            ["pimpri chinchwad"],
        )

    def test_06_registration_fee(self):
        """Q: What is the registration fee?"""
        self._assert_retrieval_has_content(
            "What is the registration fee?",
            ["₹0", "₹100"],
        )

    def test_07_registration_link(self):
        """Q: Give me the registration link."""
        results = retrieve("Give me the registration link.", top_k=5, similarity_threshold=0.1)
        assert len(results) > 0
        all_text = " ".join(r.text for r in results)
        # Should contain actual URLs
        assert "https://" in all_text

    def test_08_rulebook(self):
        """Q: Give me the rulebook."""
        results = retrieve("Give me the rulebook.", top_k=5, similarity_threshold=0.1)
        assert len(results) > 0
        all_text = " ".join(r.text for r in results)
        assert "drive.google.com" in all_text

    def test_09_ppt_template(self):
        """Q: Is there a PPT template?"""
        self._assert_retrieval_has_content(
            "Is there a PPT template?",
            ["ppt"],
        )

    def test_10_domains(self):
        """Q: What domains can participants choose?"""
        self._assert_retrieval_has_content(
            "What domains can participants choose?",
            ["health"],
        )

    def test_11_round_2_demo_duration(self):
        """Q: How long is the Round 2 demo?"""
        self._assert_retrieval_has_content(
            "How long is the Round 2 demo?",
            ["10 minutes"],
        )

    def test_12_prize_pool(self):
        """Q: What is the prize pool?"""
        self._assert_retrieval_has_content(
            "What is the prize pool?",
            ["16,000"],
        )


class TestRetrievalMetadata:
    """Verify retrieval results include proper metadata."""

    def test_results_have_event_id(self):
        """Verify retrieval results include event_id."""
        results = retrieve("What is She Solves?", top_k=3, similarity_threshold=0.1)
        for r in results:
            assert r.metadata.get("event_id"), "Missing event_id in metadata"

    def test_results_have_scores(self):
        """Verify retrieval results include similarity scores."""
        results = retrieve("What is She Solves?", top_k=3, similarity_threshold=0.1)
        for r in results:
            assert r.score > 0, "Score should be positive"

    def test_results_are_sorted_by_score(self):
        """Verify results are returned in descending score order."""
        results = retrieve("registration fee", top_k=5, similarity_threshold=0.1)
        scores = [r.score for r in results]
        assert scores == sorted(scores, reverse=True)
