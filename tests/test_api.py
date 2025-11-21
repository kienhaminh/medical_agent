import pytest
from fastapi.testclient import TestClient
from src.api.server import app

client = TestClient(app)

def test_read_main():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_list_tools():
    response = client.get("/api/tools")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

# Note: Database tests would require a running DB or mock, skipping for now in this simple test file.
# We focus on endpoints that don't require DB or where we can mock easily if needed.
# But list_tools uses the in-memory registry, so it should work.
