"""Integration tests for patients API endpoints."""
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch
from contextlib import asynccontextmanager

import httpx
from httpx import ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool

from src.models.base import Base


TEST_DATABASE_URL = "sqlite+aiosqlite:///./test_integration.db"


@pytest_asyncio.fixture(scope="module")
async def integration_engine():
    """Create a test database engine for integration tests."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        poolclass=NullPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def integration_db(integration_engine):
    """Create a fresh database session for each integration test."""
    async_session = async_sessionmaker(
        integration_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def api_client(integration_db):
    """Create an ASGI test client with overridden DB dependency and mocked lifespan."""

    @asynccontextmanager
    async def mock_lifespan(app):
        # Skip init_db() and skill discovery during tests
        yield

    with patch("src.api.server.lifespan", mock_lifespan):
        # Import app after patching lifespan
        from src.api.server import app
        from src.models.base import get_db

        async def override_get_db():
            yield integration_db

        app.dependency_overrides[get_db] = override_get_db

        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            yield client

        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_list_patients_empty(api_client):
    """GET /api/patients returns 200 with empty list when no patients exist."""
    response = await api_client.get("/api/patients")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)


@pytest.mark.asyncio
async def test_create_patient(api_client):
    """POST /api/patients creates a new patient and returns 200."""
    payload = {
        "name": "Alice Test",
        "dob": "1990-06-15",
        "gender": "female",
    }
    response = await api_client.post("/api/patients", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Alice Test"
    assert data["dob"] == "1990-06-15"
    assert data["gender"] == "female"
    assert "id" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_get_patient_by_id(api_client):
    """GET /api/patients/{id} returns the created patient."""
    # First create a patient
    payload = {
        "name": "Bob Test",
        "dob": "1985-03-20",
        "gender": "male",
    }
    create_response = await api_client.post("/api/patients", json=payload)
    assert create_response.status_code == 200
    patient_id = create_response.json()["id"]

    # Now fetch by ID
    get_response = await api_client.get(f"/api/patients/{patient_id}")
    assert get_response.status_code == 200
    data = get_response.json()
    assert data["id"] == patient_id
    assert data["name"] == "Bob Test"
    assert data["dob"] == "1985-03-20"
    assert data["gender"] == "male"
    assert "records" in data
    assert "imaging" in data


@pytest.mark.asyncio
async def test_get_patient_not_found(api_client):
    """GET /api/patients/999 returns 404 when patient does not exist."""
    response = await api_client.get("/api/patients/999")
    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
