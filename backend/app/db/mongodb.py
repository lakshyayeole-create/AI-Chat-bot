"""MongoDB client and lifecycle manager using Motor async driver."""
from typing import Optional
import certifi
import motor.motor_asyncio
from pymongo import ASCENDING, DESCENDING
from pymongo.errors import PyMongoError

from app.core.config import get_settings
from app.core.logging_config import get_logger

logger = get_logger(__name__)


class MongoDBManager:
    """Manages the Motor async MongoDB client connection and collections."""

    def __init__(self):
        self.client: Optional[motor.motor_asyncio.AsyncIOMotorClient] = None
        self.db: Optional[motor.motor_asyncio.AsyncIOMotorDatabase] = None
        self.is_connected: bool = False

    async def connect(self):
        """Establish asynchronous connection to MongoDB Atlas."""
        settings = get_settings()
        if not settings.mongodb_uri:
            logger.warning("MongoDB URI not configured. MongoDB features will be disabled.")
            return

        try:
            logger.info("Connecting to MongoDB Atlas...")
            self.client = motor.motor_asyncio.AsyncIOMotorClient(
                settings.mongodb_uri,
                tlsCAFile=certifi.where(),
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=5000,
                maxPoolSize=20,
                minPoolSize=2,
            )
            # Verify connectivity with ping
            await self.client.admin.command("ping")
            self.db = self.client[settings.mongodb_db_name]
            self.is_connected = True
            logger.info("MongoDB Atlas connected successfully. Database: '%s'", settings.mongodb_db_name)

            # Initialize collections & indexes
            await self._init_indexes()

        except Exception as e:
            self.is_connected = False
            logger.error("Failed to connect to MongoDB Atlas: %s", str(e))

    async def _init_indexes(self):
        """Create indexes on collections for performant queries."""
        if not self.is_connected or self.db is None:
            return

        try:
            # 1. Chat messages indexes
            await self.db.chat_messages.create_index([("created_at", DESCENDING)])
            await self.db.chat_messages.create_index([("session_id", ASCENDING)])

            # 2. Contact form queries indexes
            await self.db.contact_queries.create_index([("created_at", DESCENDING)])
            await self.db.contact_queries.create_index([("email", ASCENDING)])

            # 3. Site visitors indexes
            await self.db.site_visitors.create_index([("visitor_id", ASCENDING)], unique=True)
            await self.db.site_visitors.create_index([("created_at", DESCENDING)])

            # 4. Atomic global counter document initialization
            await self.db.visitor_stats.update_one(
                {"_id": "global_visitor_counter"},
                {"$setOnInsert": {"total_count": 0, "initialized_at": True}},
                upsert=True,
            )
            logger.info("MongoDB collections and indexes initialized successfully.")
        except PyMongoError as e:
            logger.warning("Error initializing MongoDB indexes: %s", str(e))

    async def close(self):
        """Close MongoDB connection pool gracefully."""
        if self.client:
            logger.info("Closing MongoDB connection pool...")
            self.client.close()
            self.is_connected = False
            logger.info("MongoDB connection closed.")


# Singleton instance
mongo_manager = MongoDBManager()


def get_mongo_db() -> Optional[motor.motor_asyncio.AsyncIOMotorDatabase]:
    """Retrieve active Motor database instance."""
    return mongo_manager.db


def get_chat_collection():
    """Retrieve chat_messages collection."""
    if mongo_manager.db is not None:
        return mongo_manager.db["chat_messages"]
    return None


def get_contact_collection():
    """Retrieve contact_queries collection."""
    if mongo_manager.db is not None:
        return mongo_manager.db["contact_queries"]
    return None


def get_visitors_collection():
    """Retrieve site_visitors collection."""
    if mongo_manager.db is not None:
        return mongo_manager.db["site_visitors"]
    return None


def get_visitor_stats_collection():
    """Retrieve visitor_stats collection."""
    if mongo_manager.db is not None:
        return mongo_manager.db["visitor_stats"]
    return None


def get_users_collection():
    """Retrieve users collection."""
    if mongo_manager.db is not None:
        return mongo_manager.db["users"]
    return None
