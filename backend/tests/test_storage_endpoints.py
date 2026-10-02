"""Integration tests for Static Assets, Contact Form, and Visitor Telemetry APIs."""
import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture(scope="module")
def client():
    """TestClient instance with app lifespan."""
    with TestClient(app) as tc:
        yield tc


def test_health_check(client):
    """Verify health endpoint reports vector_store and mongodb status."""
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "vector_store" in data
    assert "mongodb" in data


def test_get_assets_manifest(client):
    """Verify assets manifest returns models, images, and audio categories."""
    res = client.get("/api/assets")
    assert res.status_code == 200
    data = res.json()
    assert "models" in data
    assert "images" in data
    assert "audio" in data
    # Verify iron man model exists in manifest
    assert "/assets/iron_man_detailed_web.glb" in data["models"]
    entry = data["models"]["/assets/iron_man_detailed_web.glb"]
    assert "secure_url" in entry
    assert entry["resource_type"] == "raw"


def test_contact_form_submission_success(client):
    """Verify valid contact form submission inserts into MongoDB and returns reference code."""
    payload = {
        "name": "Integration Test User",
        "email": "test.user@pccoe.edu.in",
        "subject": "Symposium Registration Inquiry",
        "message": "We would like to register our team for DecentraHack 2.0."
    }
    res = client.post("/api/contact", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["reference_code"].startswith("AVN-COMM-")


def test_contact_form_invalid_email(client):
    """Verify contact form rejects invalid email addresses."""
    payload = {
        "name": "Invalid User",
        "email": "not-an-email",
        "subject": "Inquiry",
        "message": "Hello world"
    }
    res = client.post("/api/contact", json=payload)
    assert res.status_code == 422


def test_visitor_tracking_and_counter(client):
    """Verify visitor tracking ping registers and increments the atomic counter."""
    unique_vid = "test_pytest_vid_999"
    # First ping
    res1 = client.post("/api/visitors/track", json={
        "visitor_id": unique_vid,
        "user_agent": "Pytest Agent",
        "screen_resolution": "1920x1080"
    })
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["status"] == "ok"
    assert isinstance(data1["total_visitors"], int)

    # Repeat ping with same ID should not increment
    res2 = client.post("/api/visitors/track", json={
        "visitor_id": unique_vid,
        "user_agent": "Pytest Agent",
        "screen_resolution": "1920x1080"
    })
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["is_new_visitor"] is False
    assert data2["total_visitors"] == data1["total_visitors"]

    # Verify count endpoint
    res3 = client.get("/api/visitors/count")
    assert res3.status_code == 200
    assert res3.json()["total_visitors"] >= data1["total_visitors"]
