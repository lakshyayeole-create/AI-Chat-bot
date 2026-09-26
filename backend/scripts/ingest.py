"""Document ingestion script for the Anantya chatbot.

Usage:
    python scripts/ingest.py

This script:
1. Loads all .txt files from the knowledge directory (event_info/)
2. Splits them into semantic chunks with metadata
3. Generates embeddings using sentence-transformers
4. Builds a Qdrant collection
5. Saves the points and metadata to Qdrant

Safe to re-run — recreates the collection each time.
"""
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.config import get_settings
from app.core.logging_config import setup_logging, get_logger
from app.rag.loader import load_documents
from app.rag.chunker import chunk_documents
from app.rag.embeddings import embed_texts, get_embedding_dimension
from app.rag.qdrant_store import init_collection, upload_points

logger = get_logger(__name__)


def main():
    """Run the full ingestion pipeline."""
    settings = get_settings()
    setup_logging(settings.log_level)

    print("=" * 60)
    print("Anantya Chatbot — Document Ingestion")
    print("=" * 60)
    print()

    # Step 1: Load documents
    print("[1/6] Loading documents...")
    try:
        documents = load_documents()
    except FileNotFoundError as e:
        print(f"ERROR: {e}")
        sys.exit(1)

    if not documents:
        print("ERROR: No .txt files found in the knowledge directory.")
        print(f"  Path: {settings.knowledge_path}")
        sys.exit(1)

    print(f"  Loaded documents: {len(documents)}")
    for doc in documents:
        print(f"    - {doc.metadata['source_file']} ({doc.metadata['event_name']})")
    print()

    # Step 2: Chunk documents
    print("[2/6] Chunking documents...")
    chunks = chunk_documents(documents)
    print(f"  Total chunks: {len(chunks)}")
    print(f"  Chunk size: {settings.chunk_size}")
    print(f"  Chunk overlap: {settings.chunk_overlap}")
    print()

    # Step 3: Prepare texts and metadata
    print("[3/6] Preparing chunk texts and metadata...")
    texts = [chunk.text for chunk in chunks]
    metadata = []
    for chunk in chunks:
        entry = {**chunk.metadata, "chunk_text": chunk.text}
        metadata.append(entry)
    print(f"  Prepared {len(texts)} texts for embedding")
    print()

    # Step 4: Generate embeddings
    print("[4/6] Generating embeddings...")
    print(f"  Embedding model: {settings.embedding_model}")
    vectors = embed_texts(texts)
    dimension = get_embedding_dimension()
    print(f"  Vector dimension: {dimension}")
    print(f"  Vectors generated: {vectors.shape[0]}")
    print()

    # Step 5: Build Qdrant collection
    print("[5/6] Building Qdrant collection...")
    init_collection(dimension)
    print(f"  Qdrant collection initialized.")
    print()

    # Step 6: Upload points
    print("[6/6] Uploading vectors and metadata to Qdrant...")
    upload_points(vectors, metadata)
    print()

    # Summary
    print("=" * 60)
    print("INGESTION SUMMARY")
    print("=" * 60)
    print(f"  Loaded documents: {len(documents)}")
    print(f"  Total chunks: {len(chunks)}")
    print(f"  Embedding model: {settings.embedding_model}")
    print(f"  Vector dimension: {dimension}")
    print(f"  Qdrant ingestion: complete")
    print("=" * 60)
    print()
    print("Ingestion complete! You can now start the server:")
    print("  uvicorn app.main:app --reload")
    print()


if __name__ == "__main__":
    main()
