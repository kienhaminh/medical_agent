"""Integration tests for chat API endpoints."""
import pytest
import pytest_asyncio
from contextlib import asynccontextmanager
from unittest.mock import patch

import httpx
from httpx import ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool

from src.models.base import Base


TEST_DATABASE_URL = "sqlite+aiosqlite:///./test_integration_chat.db"


@pytest_asyncio.fixture(scope="module")
async def chat_integration_engine():
    """Create a test database engine for chat integration tests."""
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
async def chat_integration_db(chat_integration_engine):
    """Create a fresh database session for each chat integration test."""
    async_session = async_sessionmaker(
        chat_integration_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def chat_api_client(chat_integration_db):
    """Create an ASGI test client with overridden DB dependency and mocked lifespan."""

    @asynccontextmanager
    async def mock_lifespan(app):
        # Skip init_db() and skill discovery during tests
        yield

    with patch("src.api.server.lifespan", mock_lifespan):
        from src.api.server import app
        from src.models.base import get_db

        async def override_get_db():
            yield chat_integration_db

        app.dependency_overrides[get_db] = override_get_db

        transport = ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            yield client

        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_get_chat_sessions_empty(chat_api_client):
    """GET /api/chat/sessions returns 200 with empty list when no sessions exist."""
    response = await chat_api_client.get("/api/chat/sessions")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
