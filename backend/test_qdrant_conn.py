import os
from dotenv import load_dotenv
from qdrant_client import QdrantClient

load_dotenv()

url_base = os.getenv("QDRANT_URL", "").replace(":6333", "")
api_key = os.getenv("QDRANT_API_KEY", "")

print("Testing Port 443 via URL...")
try:
    client = QdrantClient(url=f"{url_base}:443", api_key=api_key, timeout=5)
    print("Port 443 via URL SUCCESS:", client.get_collections())
except Exception as e:
    print("Port 443 via URL FAILED:", e)
