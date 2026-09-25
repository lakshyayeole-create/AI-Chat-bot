"""Tests for the document chunker."""
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

import pytest
from app.rag.loader import load_documents, Document
from app.rag.chunker import chunk_documents, _extract_sections


# --- Test Data ---

SAMPLE_EVENT_TEXT = """==================================================
EVENT INFORMATION
==================================================

Event ID: ANT-TEST
Event Name: Test Event

==================================================
REGISTRATION
==================================================

Registration Fee:
PCCOE Students: ₹0
Non-PCCOE Students: ₹100

Registration Link:
https://forms.gle/TestFormLink123

==================================================
FAQ / DIRECT ANSWERS
==================================================

Q: What is the registration fee?
A: PCCOE students pay ₹0 and non-PCCOE students pay ₹100.

Q: Where is the event?
A: The event is held at PCCOE, Pune.
"""


class TestSectionExtraction:
    """Tests for section extraction from document text."""

    def test_sections_are_extracted(self):
        """Verify that sections delimited by === are correctly extracted."""
        sections = _extract_sections(SAMPLE_EVENT_TEXT)
        section_names = [name for name, _ in sections]
        assert "EVENT INFORMATION" in section_names
        assert "REGISTRATION" in section_names
        assert "FAQ / DIRECT ANSWERS" in section_names

    def test_section_count(self):
        """Verify correct number of sections are found."""
        sections = _extract_sections(SAMPLE_EVENT_TEXT)
        assert len(sections) == 3


class TestChunking:
    """Tests for the document chunking pipeline."""

    def test_chunks_have_metadata(self):
        """Verify every chunk has required metadata fields."""
        doc = Document(
            text=SAMPLE_EVENT_TEXT,
            metadata={
                "event_id": "ANT-TEST",
                "event_name": "Test Event",
                "source_file": "test.txt",
            },
        )
        chunks = chunk_documents([doc])

        for chunk in chunks:
            assert "event_id" in chunk.metadata
            assert "event_name" in chunk.metadata
            assert "source_file" in chunk.metadata
            assert "section" in chunk.metadata
            assert "chunk_id" in chunk.metadata

    def test_urls_survive_chunking(self):
        """Verify URLs are preserved in chunks."""
        doc = Document(
            text=SAMPLE_EVENT_TEXT,
            metadata={
                "event_id": "ANT-TEST",
                "event_name": "Test Event",
                "source_file": "test.txt",
            },
        )
        chunks = chunk_documents([doc])
        all_text = " ".join(c.text for c in chunks)
        assert "https://forms.gle/TestFormLink123" in all_text

    def test_faq_pairs_stay_together(self):
        """Verify FAQ Q/A pairs are not split apart."""
        doc = Document(
            text=SAMPLE_EVENT_TEXT,
            metadata={
                "event_id": "ANT-TEST",
                "event_name": "Test Event",
                "source_file": "test.txt",
            },
        )
        chunks = chunk_documents([doc])

        # Find chunks from FAQ section
        faq_chunks = [c for c in chunks if "FAQ" in c.metadata.get("section", "")]

        for chunk in faq_chunks:
            # If a Q: appears, its A: should be in the same chunk
            lines = chunk.text.split("\n")
            for i, line in enumerate(lines):
                if line.strip().startswith("Q:"):
                    # There should be an A: line somewhere after it in the same chunk
                    remaining = "\n".join(lines[i:])
                    assert "A:" in remaining, (
                        f"FAQ question without answer in chunk: {chunk.text[:100]}"
                    )

    def test_chunk_ids_are_unique(self):
        """Verify all chunk IDs are unique."""
        doc = Document(
            text=SAMPLE_EVENT_TEXT,
            metadata={
                "event_id": "ANT-TEST",
                "event_name": "Test Event",
                "source_file": "test.txt",
            },
        )
        chunks = chunk_documents([doc])
        chunk_ids = [c.metadata["chunk_id"] for c in chunks]
        assert len(chunk_ids) == len(set(chunk_ids))


class TestRealEventFile:
    """Tests using the actual She Solves event file if available."""

    @pytest.fixture
    def she_solves_path(self):
        """Path to the She Solves event file."""
        path = backend_dir.parent / "event_info" / "event_001_she_solves_3_0.txt"
        if not path.exists():
            pytest.skip("She Solves event file not found")
        return path

    def test_load_real_file(self, she_solves_path):
        """Verify the real event file loads successfully."""
        docs = load_documents(she_solves_path.parent)
        assert len(docs) >= 1
        event_names = [d.metadata["event_name"] for d in docs]
        assert any("She Solves" in name for name in event_names)

    def test_chunk_real_file(self, she_solves_path):
        """Verify chunking the real event file produces valid chunks."""
        docs = load_documents(she_solves_path.parent)
        chunks = chunk_documents(docs)
        assert len(chunks) > 0

        # Check URLs are preserved
        all_text = " ".join(c.text for c in chunks)
        assert "https://drive.google.com" in all_text
        assert "https://forms.gle" in all_text

    def test_real_file_has_all_sections(self, she_solves_path):
        """Verify key sections are extracted from the real file."""
        docs = load_documents(she_solves_path.parent)
        chunks = chunk_documents(docs)
        sections = set(c.metadata["section"] for c in chunks)

        # These sections should exist in the She Solves file
        expected = {"EVENT INFORMATION", "REGISTRATION", "DATE & TIME"}
        for section in expected:
            assert section in sections, f"Missing section: {section}"
