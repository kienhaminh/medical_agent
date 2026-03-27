"""Integration tests for authentication API endpoints."""
import pytest
import pytest_asyncio
from contextlib import asynccontextmanager
from unittest.mock import patch

import httpx
from httpx import ASGITransport
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool

from src.models.base import Base
from src.models.user import User
from src.utils.auth import hash_password, create_access_token


TEST_DATABASE_URL = "sqlite+aiosqlite:///./test_auth.db"


@pytest_asyncio.fixture(scope="module")
async def auth_engine():
    """Create a test database engine for auth integration tests."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def auth_db(auth_engine):
    """Create a fresh database session with cleanup for each test."""
    async_session = async_sessionmaker(
        auth_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session() as session:
        yield session
        await session.rollback()
    # Clean up users table after each test
    async with auth_engine.begin() as conn:
        await conn.execute(text("DELETE FROM users"))


def _make_client_fixture(db_session):
    """Build an ASGI test client bound to the given db session."""

    @asynccontextmanager
    async def _ctx():
        @asynccontextmanager
        async def mock_lifespan(app):
            yield

        with patch("src.api.server.lifespan", mock_lifespan):
            from src.api.server import app
            from src.models.base import get_db

            async def override_get_db():
                yield db_session

            app.dependency_overrides[get_db] = override_get_db

            transport = ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                yield client

            app.dependency_overrides.clear()

    return _ctx()


@pytest_asyncio.fixture
async def auth_client(auth_db):
    """Create an ASGI test client with overridden DB dependency."""
    async with _make_client_fixture(auth_db) as client:
        yield client


@pytest_asyncio.fixture
async def seeded_client(auth_db):
    """Create an ASGI test client with a pre-seeded doctor user."""
    user = User(
        username="testdoc",
        password_hash=hash_password("pass123"),
        name="Dr. Test",
        role="doctor",
        department="Cardiology",
    )
    auth_db.add(user)
    await auth_db.commit()
    await auth_db.refresh(user)

    async with _make_client_fixture(auth_db) as client:
        yield client, user


# --- POST /api/auth/login ---


@pytest.mark.asyncio
async def test_login_success(seeded_client):
    """Valid credentials return 200 with token and user info."""
    client, user = seeded_client
    response = await client.post(
        "/api/auth/login",
        json={"username": "testdoc", "password": "pass123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    assert data["user"]["username"] == "testdoc"
    assert data["user"]["name"] == "Dr. Test"
    assert data["user"]["role"] == "doctor"
    assert data["user"]["department"] == "Cardiology"


@pytest.mark.asyncio
async def test_login_wrong_password(seeded_client):
    """Wrong password returns 401."""
    client, _ = seeded_client
    response = await client.post(
        "/api/auth/login",
        json={"username": "testdoc", "password": "wrongpass"},
    )
    assert response.status_code == 401
    assert "Invalid username or password" in response.json()["detail"]


@pytest.mark.asyncio
async def test_login_nonexistent_user(auth_client):
    """Non-existent username returns 401."""
    response = await auth_client.post(
        "/api/auth/login",
        json={"username": "nobody", "password": "anything"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_login_empty_fields(auth_client):
    """Empty username/password returns 422 (validation error)."""
    response = await auth_client.post("/api/auth/login", json={})
    assert response.status_code == 422


# --- GET /api/auth/me ---


@pytest.mark.asyncio
async def test_me_with_valid_token(seeded_client):
    """GET /me with valid token returns current user."""
    client, user = seeded_client
    # Login first to get token
    login_resp = await client.post(
        "/api/auth/login",
        json={"username": "testdoc", "password": "pass123"},
    )
    token = login_resp.json()["token"]

    response = await client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "testdoc"
    assert data["role"] == "doctor"


@pytest.mark.asyncio
async def test_me_without_token(auth_client):
    """GET /me without Authorization header returns 401."""
    response = await auth_client.get("/api/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me_with_invalid_token(auth_client):
    """GET /me with garbage token returns 401."""
    response = await auth_client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer invalid.token.here"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me_with_nonexistent_user_token(auth_client):
    """GET /me with token referencing deleted user returns 401."""
    token = create_access_token(user_id=99999, username="ghost", role="doctor")
    response = await auth_client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_me_malformed_auth_header(auth_client):
    """GET /me with non-Bearer auth header returns 401."""
    response = await auth_client.get(
        "/api/auth/me",
        headers={"Authorization": "Basic dXNlcjpwYXNz"},
    )
    assert response.status_code == 401
