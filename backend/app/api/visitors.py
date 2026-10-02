"""Site visitor tracking and telemetry API endpoints backed by MongoDB."""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pymongo import ReturnDocument

from app.core.logging_config import get_logger
from app.db.mongodb import get_visitors_collection, get_visitor_stats_collection
from app.db.models import VisitorTrackRequest, VisitorTrackResponse

logger = get_logger(__name__)

router = APIRouter(prefix="/api/visitors", tags=["Visitor Tracking"])


@router.post("/track", response_model=VisitorTrackResponse)
async def track_visitor(request: VisitorTrackRequest):
    """Track a site visit. If unique visitor_id, atomically increment the total counter in MongoDB.
    
    Returns:
        Exact site visitor count and whether this ping counted as a new visitor.
    """
    visitors_col = get_visitors_collection()
    stats_col = get_visitor_stats_collection()

    if visitors_col is None or stats_col is None:
        logger.warning("MongoDB visitors collections unavailable.")
        return VisitorTrackResponse(
            status="ok",
            total_visitors=1,
            is_new_visitor=False,
        )

    clean_vid = request.visitor_id.strip()

    try:
        # Check if visitor already exists
        existing = await visitors_col.find_one({"visitor_id": clean_vid})

        if existing:
            # Already tracked visitor, get current total
            stats = await stats_col.find_one({"_id": "global_visitor_counter"})
            count = stats.get("total_count", 1) if stats else 1
            return VisitorTrackResponse(
                status="ok",
                total_visitors=count,
                is_new_visitor=False,
            )

        # New visitor: record session and increment counter atomically
        now = datetime.now(timezone.utc)
        await visitors_col.insert_one({
            "visitor_id": clean_vid,
            "user_agent": request.user_agent,
            "screen_resolution": request.screen_resolution,
            "created_at": now,
        })

        # Atomic increment
        updated_stats = await stats_col.find_one_and_update(
            {"_id": "global_visitor_counter"},
            {"$inc": {"total_count": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
        total_count = updated_stats.get("total_count", 1)
        logger.info("New unique visitor recorded (%s). Total visitors: %d", clean_vid[:8], total_count)

        return VisitorTrackResponse(
            status="ok",
            total_visitors=total_count,
            is_new_visitor=True,
        )

    except Exception as e:
        logger.error("Error updating visitor tracking in MongoDB: %s", str(e))
        return VisitorTrackResponse(
            status="error",
            total_visitors=1,
            is_new_visitor=False,
        )


@router.get("/count")
async def get_visitor_count():
    """Retrieve current verified visitor count from MongoDB."""
    stats_col = get_visitor_stats_collection()
    if stats_col is None:
        return {"status": "ok", "total_visitors": 0}

    try:
        stats = await stats_col.find_one({"_id": "global_visitor_counter"})
        count = stats.get("total_count", 0) if stats else 0
        return {"status": "ok", "total_visitors": count}
    except Exception as e:
        logger.error("Error retrieving visitor count: %s", str(e))
        return {"status": "error", "total_visitors": 0}
