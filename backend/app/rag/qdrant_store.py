"""Qdrant vector store for semantic search.

Provides functions to build, connect, and search a Qdrant collection.
Chunk text and metadata are stored directly in the Qdrant payload.
"""
import uuid
from pathlib import Path
import numpy as np
from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue

from app.core.config import get_settings
from app.core.logging_config import get_logger

logger = get_logger(__name__)

# Module-level cache for the client
_client: QdrantClient | None = None


def get_client() -> QdrantClient:
    """Get or initialize the Qdrant client."""
    global _client
    if _client is None:
        settings = get_settings()
        
        url = settings.qdrant_url
        if not url or url.strip() == "" or url.strip().lower() == "local":
            qdrant_path = str(Path(__file__).resolve().parent.parent.parent / "qdrant_data")
            logger.info(f"Connecting to Qdrant (local mode) at {qdrant_path}")
            _client = QdrantClient(path=qdrant_path)
        else:
            logger.info(f"Connecting to Qdrant at {url}")
            _client = QdrantClient(
                url=url,
                api_key=settings.qdrant_api_key,
            )
    return _client


def init_collection(dimension: int) -> None:
    """Initialize the Qdrant collection, recreating it if it exists.
    
    Args:
        dimension: The dimensionality of the embedding vectors.
    """
    client = get_client()
    settings = get_settings()
    collection_name = settings.qdrant_collection_name
    
    if client.collection_exists(collection_name):
        logger.info(f"Collection '{collection_name}' exists. Recreating it.")
        client.delete_collection(collection_name)
    
    client.create_collection(
        collection_name=collection_name,
        vectors_config=VectorParams(size=dimension, distance=Distance.COSINE),
    )
    client.create_payload_index(
        collection_name=collection_name,
        field_name="event_id",
        field_schema="keyword",
    )
    logger.info(f"Created Qdrant collection '{collection_name}' with dimension {dimension} and COSINE distance.")


def upload_points(vectors: np.ndarray, metadata: list[dict]) -> None:
    """Upload vectors and metadata to Qdrant.
    
    Args:
        vectors: Numpy array of shape (n_vectors, embedding_dim).
        metadata: List of chunk metadata dicts (must contain text).
    """
    client = get_client()
    settings = get_settings()
    collection_name = settings.qdrant_collection_name
    
    points = []
    for i, (vec, meta) in enumerate(zip(vectors, metadata)):
        point_id = str(uuid.uuid4())
        points.append(
            PointStruct(
                id=point_id,
                vector=vec.tolist(),
                payload=meta
            )
        )
        
    client.upsert(
        collection_name=collection_name,
        points=points
    )
    logger.info(f"Uploaded {len(points)} points to Qdrant collection '{collection_name}'.")


def search(
    query_vector: np.ndarray, 
    top_k: int | None = None,
    event_id_filter: str | None = None,
) -> list[tuple[dict, float]]:
    """Search the Qdrant collection using cosine similarity.

    Args:
        query_vector: Query embedding vector (1D array).
        top_k: Number of top results to return. If None, uses settings.
        event_id_filter: Optional event_id to filter results by.

    Returns:
        List of (payload, similarity_score) tuples, sorted by
        descending similarity.

    Raises:
        RuntimeError: If Qdrant is unreachable or collection doesn't exist.
    """
    client = get_client()
    settings = get_settings()
    collection_name = settings.qdrant_collection_name
    
    if top_k is None:
        top_k = settings.top_k
        
    if not client.collection_exists(collection_name):
        raise RuntimeError(f"Qdrant collection '{collection_name}' does not exist. Run: python scripts/ingest.py")

    query_filter = None
    if event_id_filter:
        query_filter = Filter(
            must=[
                FieldCondition(
                    key="event_id",
                    match=MatchValue(value=event_id_filter)
                )
            ]
        )

    # Ensure query_vector is 1D for Qdrant client
    if query_vector.ndim == 2:
        query_vector = query_vector.flatten()

    results = client.search(
        collection_name=collection_name,
        query_vector=query_vector.tolist(),
        query_filter=query_filter,
        limit=top_k
    )

    return [(res.payload, res.score) for res in results if res.payload is not None]


def check_connection() -> bool:
    """Check if Qdrant is available and the collection exists."""
    try:
        client = get_client()
        settings = get_settings()
        return client.collection_exists(settings.qdrant_collection_name)
    except Exception as e:
        logger.error(f"Qdrant connection check failed: {str(e)}")
        return False
