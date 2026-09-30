"""Deterministic knowledge version computation.

Generates a deterministic hash representing the canonical event information state.
When any canonical event file is added, modified, or removed, the version string changes,
automatically invalidating stale cached responses without requiring manual cache flushing.
"""
import hashlib
from pathlib import Path

from app.core.config import get_settings
from app.core.logging_config import get_logger

logger = get_logger(__name__)

# Cached knowledge version to prevent reading disk on every single cache check
_cached_version: str | None = None
_cached_mtimes: dict[str, float] = {}


def compute_knowledge_version(knowledge_path: Path | None = None) -> str:
    """Compute a deterministic hash of canonical event files.

    Hashes the sorted filename, size, and content of all .txt files in the
    canonical knowledge directory.

    Args:
        knowledge_path: Optional path to event files directory.

    Returns:
        Version string, e.g. "kv_a1b2c3d4e5f60718"
    """
    global _cached_version, _cached_mtimes

    if knowledge_path is None:
        knowledge_path = get_settings().knowledge_path

    if not knowledge_path.exists():
        return "kv_uninitialized"

    txt_files = sorted(knowledge_path.glob("*.txt"))
    if not txt_files:
        return "kv_empty"

    # Fast path: check file modification times
    current_mtimes = {f.name: f.stat().st_mtime for f in txt_files}
    if _cached_version is not None and current_mtimes == _cached_mtimes:
        return _cached_version

    hasher = hashlib.sha256()
    for file_path in txt_files:
        hasher.update(file_path.name.encode("utf-8"))
        try:
            content = file_path.read_bytes()
            hasher.update(content)
        except Exception as e:
            logger.warning("Could not read %s for knowledge version: %s", file_path, e)

    version = f"kv_{hasher.hexdigest()[:16]}"
    _cached_version = version
    _cached_mtimes = current_mtimes
    logger.debug("Computed knowledge version: %s", version)
    return version
