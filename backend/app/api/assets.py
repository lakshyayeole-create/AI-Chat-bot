"""API endpoint to serve the static assets manifest to the frontend."""
import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.logging_config import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/assets", tags=["Static Assets"])


def _load_manifest() -> dict:
    """Read the generated Cloudinary asset manifest from disk."""
    settings = get_settings()
    manifest_path: Path = settings.resolved_assets_manifest_path

    if not manifest_path.is_file():
        logger.warning("Asset manifest not found at %s. Returning empty fallback.", manifest_path)
        return {
            "version": 1,
            "generated_at": None,
            "status": "pending_seed",
            "models": {},
            "images": {},
            "audio": {},
        }

    try:
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
        return data
    except Exception as e:
        logger.error("Failed to read asset manifest: %s", str(e))
        raise HTTPException(
            status_code=500,
            detail="Could not read assets manifest file.",
        )


@router.get("")
async def get_all_assets():
    """Retrieve full static website asset manifest containing Cloudinary URLs.
    
    Returns:
        JSON object with models, images, and static audio Cloudinary URLs.
    """
    manifest = _load_manifest()
    return JSONResponse(content=manifest)


@router.get("/models")
async def get_model_assets():
    """Retrieve only 3D models from the static asset manifest."""
    manifest = _load_manifest()
    return JSONResponse(content=manifest.get("models", {}))


@router.get("/images")
async def get_image_assets():
    """Retrieve only images and textures from the static asset manifest."""
    manifest = _load_manifest()
    return JSONResponse(content=manifest.get("images", {}))


@router.get("/audio")
async def get_audio_assets():
    """Retrieve static background audio from the asset manifest (NOT dynamic TTS)."""
    manifest = _load_manifest()
    return JSONResponse(content=manifest.get("audio", {}))
