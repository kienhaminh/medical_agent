"""Tests for hospital-level KPI stats endpoint."""
import pytest
import pytest_asyncio
from contextlib import asynccontextmanager
from unittest.mock import patch
from httpx import AsyncClient, ASGITransport

from src.models.base import get_db
from src.models.department import Department
from src.models.visit import Visit, VisitStatus


@pytest_asyncio.fixture
async def client(db_session):
    @asynccontextmanager
    async def mock_lifespan(app):
        yield

    with patch("src.api.server.lifespan", mock_lifespan):
        from src.api.server import app

        async def override_get_db():
            yield db_session

        app.dependency_overrides[get_db] = override_get_db
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            yield client
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_hospital_stats_empty(client):
    """Returns zero counts when there are no visits or departments."""
    response = await client.get("/api/hospital/stats")
    assert response.status_code == 200
    data = response.json()
    assert data["active_patients"] == 0
    assert data["departments_at_capacity"] == 0
    assert data["avg_wait_minutes"] == 0.0
    assert data["discharged_today"] == 0
