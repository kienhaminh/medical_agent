"""Tests for ask_user tool — form request handler for reception agent."""
import asyncio
import pytest
from src.tools.form_request_registry import FormRequestRegistry, current_session_id_var


@pytest.fixture(autouse=True)
def reset_registry():
    """Each test gets a clean registry."""
    reg = FormRequestRegistry()
    reg.reset()
    yield
    reg.reset()


@pytest.mark.asyncio
async def test_ask_user_returns_confirm_result():
    """ask_user blocks until resolved, then returns the stored result."""
    from src.tools.builtin.ask_user_tool import ask_user

    session_id = 99
    side_queue = asyncio.Queue()
    reg = FormRequestRegistry()
    reg.register_session_queue(session_id, side_queue)
    current_session_id_var.set(session_id)

    async def resolve_after_delay():
        await asyncio.sleep(0.05)
        item = await side_queue.get()  # consume the form_request event
        form_id = item["payload"]["id"]
        reg.resolve_form(form_id, "confirmed")

    asyncio.create_task(resolve_after_delay())

    result = await ask_user("confirm_visit")
    assert result == "confirmed"


@pytest.mark.asyncio
async def test_ask_user_puts_form_request_on_queue():
    """ask_user must push a form_request event to the session queue."""
    from src.tools.builtin.ask_user_tool import ask_user

    session_id = 100
    side_queue = asyncio.Queue()
    reg = FormRequestRegistry()
    reg.register_session_queue(session_id, side_queue)
    current_session_id_var.set(session_id)

    async def resolve_immediately():
        await asyncio.sleep(0.02)
        item = await side_queue.get()
        assert item["type"] == "form_request"
        assert item["payload"]["template"] == "patient_intake"
        form_id = item["payload"]["id"]
        reg.resolve_form(form_id, "intake_completed. patient_id=1, intake_id=v-abc")

    asyncio.create_task(resolve_immediately())
    result = await ask_user("patient_intake")
    assert result.startswith("intake_completed")


@pytest.mark.asyncio
async def test_ask_user_unknown_template_returns_error():
    """ask_user returns error for unknown template."""
    from src.tools.builtin.ask_user_tool import ask_user

    current_session_id_var.set(None)
    result = await ask_user("nonexistent_template")
    assert result.startswith("Error:")
