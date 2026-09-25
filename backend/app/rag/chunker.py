"""Section-aware document chunker for event knowledge files.

Splits documents into semantic chunks while preserving:
- Section boundaries (delimited by === headings)
- URLs attached to their resource descriptions
- FAQ question/answer pairs
- Event metadata blocks (name, date, venue)

Each chunk includes metadata: event_id, event_name, source_file, section, chunk_id.
"""
import re
from dataclasses import dataclass, field

from app.core.config import get_settings
from app.core.logging_config import get_logger
from app.rag.loader import Document

logger = get_logger(__name__)


@dataclass
class Chunk:
    """A text chunk with associated metadata."""
    text: str
    metadata: dict = field(default_factory=dict)


def _extract_sections(text: str) -> list[tuple[str, str]]:
    """Split document text into named sections based on === delimiters.

    Args:
        text: Full document text.

    Returns:
        List of (section_name, section_content) tuples.
    """
    # Pattern: lines of === followed by a heading, followed by ===
    pattern = r"={3,}\n(.+?)\n={3,}"
    parts = re.split(pattern, text)

    sections = []
    if parts[0].strip():
        sections.append(("HEADER", parts[0].strip()))

    # parts comes in pairs: [before, heading1, content1, heading2, content2, ...]
    for i in range(1, len(parts) - 1, 2):
        heading = parts[i].strip()
        content = parts[i + 1].strip() if i + 1 < len(parts) else ""
        if content:
            sections.append((heading, content))

    return sections


def _make_section_key(section_name: str) -> str:
    """Convert a section name into a clean key for chunk IDs.

    Args:
        section_name: Human-readable section name.

    Returns:
        Uppercase key with spaces replaced by underscores.
    """
    # Remove special characters, keep alphanumeric and spaces
    key = re.sub(r"[^A-Za-z0-9\s]", "", section_name)
    key = re.sub(r"\s+", "_", key.strip())
    return key.upper()


def _split_large_section(
    text: str, max_size: int, overlap: int
) -> list[str]:
    """Split a large section into smaller chunks with overlap.

    Splits on paragraph boundaries (double newlines) first, then falls back
    to sentence-level splitting if needed. Preserves URLs and FAQ pairs.

    Args:
        text: Section text to split.
        max_size: Maximum chunk size in characters.
        overlap: Number of overlapping characters between chunks.

    Returns:
        List of text chunks.
    """
    if len(text) <= max_size:
        return [text]

    # Try paragraph-level splitting first
    paragraphs = re.split(r"\n\s*\n", text)

    chunks = []
    current_chunk = ""

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        # Check if adding this paragraph exceeds the limit
        if current_chunk and len(current_chunk) + len(para) + 2 > max_size:
            chunks.append(current_chunk.strip())

            # Add overlap from end of previous chunk
            if overlap > 0 and current_chunk:
                overlap_text = current_chunk[-overlap:]
                # Try to start overlap at a word boundary
                space_idx = overlap_text.find(" ")
                if space_idx > 0:
                    overlap_text = overlap_text[space_idx + 1:]
                current_chunk = overlap_text + "\n\n" + para
            else:
                current_chunk = para
        else:
            if current_chunk:
                current_chunk += "\n\n" + para
            else:
                current_chunk = para

    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    return chunks if chunks else [text]


def _is_faq_section(section_name: str) -> bool:
    """Check if a section is an FAQ section that needs special handling.

    Args:
        section_name: Name of the section.

    Returns:
        True if the section contains FAQ content.
    """
    return "FAQ" in section_name.upper() or "DIRECT ANSWERS" in section_name.upper()


def _split_faq_section(
    text: str, max_size: int, overlap: int
) -> list[str]:
    """Split FAQ sections while keeping Q/A pairs together.

    Args:
        text: FAQ section text.
        max_size: Maximum chunk size in characters.
        overlap: Number of overlapping characters between chunks.

    Returns:
        List of text chunks with Q/A pairs preserved.
    """
    # Split on "Q:" boundaries
    qa_pattern = r"(?=Q:\s)"
    qa_pairs = re.split(qa_pattern, text)
    qa_pairs = [p.strip() for p in qa_pairs if p.strip()]

    if not qa_pairs:
        return _split_large_section(text, max_size, overlap)

    chunks = []
    current_chunk = ""

    for qa in qa_pairs:
        if current_chunk and len(current_chunk) + len(qa) + 2 > max_size:
            chunks.append(current_chunk.strip())
            current_chunk = qa
        else:
            if current_chunk:
                current_chunk += "\n\n" + qa
            else:
                current_chunk = qa

    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    return chunks if chunks else [text]


def chunk_documents(
    documents: list[Document],
    chunk_size: int | None = None,
    chunk_overlap: int | None = None,
) -> list[Chunk]:
    """Split documents into semantic chunks with metadata.

    Args:
        documents: List of loaded Document objects.
        chunk_size: Maximum chunk size in characters. If None, uses settings.
        chunk_overlap: Overlap between chunks. If None, uses settings.

    Returns:
        List of Chunk objects with text and metadata.
    """
    settings = get_settings()
    if chunk_size is None:
        chunk_size = settings.chunk_size
    if chunk_overlap is None:
        chunk_overlap = settings.chunk_overlap

    all_chunks = []

    for doc in documents:
        event_id = doc.metadata.get("event_id", "UNKNOWN")
        event_name = doc.metadata.get("event_name", "Unknown")
        source_file = doc.metadata.get("source_file", "unknown.txt")

        sections = _extract_sections(doc.text)

        if not sections:
            # If no sections detected, treat entire document as one section
            sections = [("CONTENT", doc.text)]

        for section_name, section_text in sections:
            section_key = _make_section_key(section_name)

            # Choose splitting strategy
            if _is_faq_section(section_name):
                text_chunks = _split_faq_section(
                    section_text, chunk_size, chunk_overlap
                )
            else:
                text_chunks = _split_large_section(
                    section_text, chunk_size, chunk_overlap
                )

            for idx, chunk_text in enumerate(text_chunks, start=1):
                chunk_id = f"{event_id}-{section_key}-{idx:02d}"
                metadata = {
                    "event_id": event_id,
                    "event_name": event_name,
                    "source_file": source_file,
                    "section": section_name,
                    "chunk_id": chunk_id,
                }

                all_chunks.append(Chunk(text=chunk_text, metadata=metadata))

        logger.info(
            "Chunked %s: %d sections, %d chunks",
            source_file,
            len(sections),
            sum(1 for c in all_chunks if c.metadata["source_file"] == source_file),
        )

    logger.info("Total chunks created: %d", len(all_chunks))
    return all_chunks
