"""Document loader for event knowledge files.

Loads .txt files from the knowledge directory and extracts metadata
(event ID, event name, source file) from the file content.
"""
import re
from pathlib import Path
from dataclasses import dataclass, field

from app.core.config import get_settings
from app.core.logging_config import get_logger

logger = get_logger(__name__)


@dataclass
class Document:
    """A loaded document with its content and metadata."""
    text: str
    metadata: dict = field(default_factory=dict)


def _extract_event_id(text: str) -> str:
    """Extract Event ID from the document text.

    Looks for patterns like 'Event ID: ANT-001'.

    Args:
        text: Full document text.

    Returns:
        Extracted event ID, or empty string if not found.
    """
    match = re.search(r"Event\s+ID:\s*(\S+)", text, re.IGNORECASE)
    return match.group(1).strip() if match else ""


def _extract_event_name(text: str) -> str:
    """Extract Event Name from the document text.

    Looks for patterns like 'Event Name: She Solves 3.0'.

    Args:
        text: Full document text.

    Returns:
        Extracted event name, or empty string if not found.
    """
    match = re.search(r"Event\s+Name:\s*(.+)", text, re.IGNORECASE)
    return match.group(1).strip() if match else ""


def load_documents(knowledge_dir: Path | None = None) -> list[Document]:
    """Load all .txt files from the knowledge directory.

    Args:
        knowledge_dir: Path to the knowledge directory. If None, uses the
            configured KNOWLEDGE_DIR from settings.

    Returns:
        List of Document objects with text content and metadata.

    Raises:
        FileNotFoundError: If the knowledge directory does not exist.
    """
    if knowledge_dir is None:
        settings = get_settings()
        knowledge_dir = settings.knowledge_path

    knowledge_dir = Path(knowledge_dir)

    if not knowledge_dir.exists():
        raise FileNotFoundError(
            f"Knowledge directory not found: {knowledge_dir}"
        )

    txt_files = sorted(knowledge_dir.glob("*.txt"))

    if not txt_files:
        logger.warning("No .txt files found in %s", knowledge_dir)
        return []

    documents = []
    for file_path in txt_files:
        logger.info("Loading: %s", file_path.name)

        text = file_path.read_text(encoding="utf-8")

        # Extract metadata from file content
        event_id = _extract_event_id(text)
        event_name = _extract_event_name(text)

        # Fallback to filename if metadata can't be parsed
        if not event_id:
            event_id = file_path.stem.upper()
        if not event_name:
            event_name = file_path.stem.replace("_", " ").title()

        metadata = {
            "event_id": event_id,
            "event_name": event_name,
            "source_file": file_path.name,
        }

        documents.append(Document(text=text, metadata=metadata))
        logger.info(
            "Loaded: %s (event_id=%s, event_name=%s)",
            file_path.name,
            event_id,
            event_name,
        )

    logger.info("Total documents loaded: %d", len(documents))
    return documents
