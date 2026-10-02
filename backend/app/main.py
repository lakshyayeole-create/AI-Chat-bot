"""Anantya Chatbot — FastAPI Application.

Main entry point for the backend server.
Configures CORS, loads the vector store on startup, and includes
the chat API router.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.logging_config import setup_logging, get_logger
from app.api.chat import router as chat_router
from app.api.tts import router as tts_router
from app.api.assets import router as assets_router
from app.api.contact import router as contact_router
from app.api.visitors import router as visitors_router
from app.db.mongodb import mongo_manager
from app.rag import qdrant_store

from app.rag.queue_manager import get_queue_manager

# Application routers
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    settings = get_settings()

    # Setup logging
    setup_logging(settings.log_level)

    logger.info("=" * 60)
    logger.info("Anantya Chatbot Backend — Starting up")
    logger.info("=" * 60)

    # Try to connect to Qdrant
    try:
        is_connected = qdrant_store.check_connection()
        if is_connected:
            app.state.vector_store_loaded = True
            logger.info("Qdrant collection loaded successfully.")
        else:
            app.state.vector_store_loaded = False
            logger.warning("Qdrant collection not found. Run: python scripts/ingest.py")
    except Exception as e:
        app.state.vector_store_loaded = False
        logger.error("Failed to connect to Qdrant: %s", str(e))

    # Connect to MongoDB Atlas
    await mongo_manager.connect()

    # Start request queue workers
    queue_mgr = get_queue_manager()
    queue_mgr.start_workers(settings.num_workers)
    logger.info("Request queue workers initialized.")

    logger.info("Server ready on %s:%d", settings.host, settings.port)

    yield

    # Shutdown
    await queue_mgr.stop_workers()
    await mongo_manager.close()
    logger.info("Anantya Chatbot Backend — Shutting down")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application.

    Returns:
        Configured FastAPI app instance.
    """
    settings = get_settings()

    app = FastAPI(
        title="Anantya Chatbot API",
        description="Event information chatbot for Anantya '26",
        version="1.0.0",
        lifespan=lifespan,
    )

    # CORS configuration
    origins = [o.strip() for o in settings.frontend_origin.split(",") if o.strip()]
    origins.extend([
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5500",
        "http://localhost:8001",
        "http://localhost:8080",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5500",
        "http://127.0.0.1:8001",
        "http://127.0.0.1:8080",
        "null",
    ])
    origins = list(dict.fromkeys(origins))

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include routers
    app.include_router(chat_router)
    app.include_router(tts_router)
    app.include_router(assets_router)
    app.include_router(contact_router)
    app.include_router(visitors_router)

    # Health endpoint
    @app.get("/health", tags=["Health"])
    async def health():
        """Health check endpoint for deployment/monitoring."""
        vs_status = "loaded" if getattr(app.state, "vector_store_loaded", False) else "not_loaded"
        mongo_status = "connected" if mongo_manager.is_connected else "disconnected"
        return {
            "status": "ok",
            "vector_store": vs_status,
            "mongodb": mongo_status,
        }

    return app


# Create the app instance for uvicorn
app = create_app()
