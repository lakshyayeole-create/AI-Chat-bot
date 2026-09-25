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
from app.rag import vector_store

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

    # Try to load the vector store
    try:
        vector_store.load_index()
        app.state.vector_store_loaded = True
        logger.info("Vector store loaded successfully.")
    except FileNotFoundError as e:
        app.state.vector_store_loaded = False
        logger.warning(
            "Vector store not found. Run: python scripts/ingest.py"
        )
        logger.warning("Details: %s", str(e))
    except Exception as e:
        app.state.vector_store_loaded = False
        logger.error("Failed to load vector store: %s", str(e))

    logger.info("Server ready on %s:%d", settings.host, settings.port)

    yield

    # Shutdown
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
    origins = [settings.frontend_origin]
    # Allow localhost variants for development
    if "localhost" in settings.frontend_origin:
        origins.extend([
            "http://localhost:3000",
            "http://localhost:5173",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5173",
        ])

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    # Include routers
    app.include_router(chat_router)

    # Health endpoint
    @app.get("/health", tags=["Health"])
    async def health():
        """Health check endpoint for deployment/monitoring."""
        vs_status = "loaded" if getattr(app.state, "vector_store_loaded", False) else "not_loaded"
        return {
            "status": "ok",
            "vector_store": vs_status,
        }

    return app


# Create the app instance for uvicorn
app = create_app()
