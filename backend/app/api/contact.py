"""Contact page API endpoint for user messages and queries stored in MongoDB."""
import random
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from app.core.logging_config import get_logger
from app.db.mongodb import get_contact_collection
from app.db.models import ContactFormRequest, ContactFormResponse

logger = get_logger(__name__)

router = APIRouter(prefix="/api/contact", tags=["Contact"])


@router.post("", response_model=ContactFormResponse)
async def submit_contact_form(request: ContactFormRequest):
    """Receive and validate user message from the Contact page and store in MongoDB.
    
    Returns:
        Structured response with generated reference token.
    """
    logger.info("Received contact inquiry from %s <%s> - '%s'", request.name, request.email, request.subject)

    ref_code = f"AVN-COMM-{random.randint(1000, 9999)}"
    now = datetime.now(timezone.utc)

    doc = {
        "name": request.name.strip(),
        "email": str(request.email).strip().lower(),
        "subject": (request.subject or "General Inquiry").strip(),
        "message": request.message.strip(),
        "reference_code": ref_code,
        "created_at": now,
        "status": "received",
    }

    collection = get_contact_collection()
    if collection is None:
        logger.error("MongoDB contact collection is unavailable.")
        raise HTTPException(
            status_code=503,
            detail="Our communication channel is momentarily busy. Please try sending your message again shortly.",
        )

    try:
        result = await collection.insert_one(doc)
        logger.info("Contact form inquiry saved to MongoDB with id: %s (ref: %s)", result.inserted_id, ref_code)
        return ContactFormResponse(
            status="success",
            message="Your message has been received and relayed to Anantya Central Command.",
            reference_code=ref_code,
            created_at=now,
        )
    except Exception as e:
        logger.error("Failed to insert contact form inquiry into MongoDB: %s", str(e))
        raise HTTPException(
            status_code=500,
            detail="Unable to complete transmission right now. Please try again shortly.",
        )
