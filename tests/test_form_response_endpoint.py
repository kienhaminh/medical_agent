import asyncio
import pytest
from unittest.mock import patch, AsyncMock
from httpx import AsyncClient, ASGITransport
from src.api.server import app
from src.tools.form_request_registry import FormRequestRegistry


@pytest.fixture(autouse=True)
def reset_registry():
    reg = FormRequestRegistry()
    reg.reset()
    yield
    reg.reset()


@pytest.mark.asyncio
async def test_form_response_404_for_unknown_form():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/chat/1/form-response",
            json={"form_id": "no-such-form", "answers": {}},
        )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_form_response_resolves_confirm_visit():
    reg = FormRequestRegistry()
    event = asyncio.Event()
    reg.register_form("test-form-1", event, "confirm_visit")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/chat/1/form-response",
            json={"form_id": "test-form-1", "answers": {"confirmed": "true"}},
        )
    assert resp.status_code == 200
    assert event.is_set()
    assert reg.get_form_result("test-form-1") == "confirmed"


@pytest.mark.asyncio
async def test_form_response_resolves_declined():
    reg = FormRequestRegistry()
    event = asyncio.Event()
    reg.register_form("test-form-2", event, "confirm_visit")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/chat/1/form-response",
            json={"form_id": "test-form-2", "answers": {"confirmed": "false"}},
        )
    assert resp.status_code == 200
    assert reg.get_form_result("test-form-2") == "declined"
