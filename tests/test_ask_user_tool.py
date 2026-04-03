"""Tests for ask_user_input tool — agent-defined form/choice handler."""
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
async def test_ask_user_input_blocks_until_resolved():
    """ask_user_input blocks until the form is resolved, then returns the result."""
    from src.tools.ask_user_input_tool import ask_user_input

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

    result = await ask_user_input(
        title="Confirm your visit",
        choices=["Yes", "No"],
    )
    assert result == "confirmed"


@pytest.mark.asyncio
async def test_ask_user_input_puts_form_request_on_queue():
    """ask_user_input pushes a form_request event to the session queue."""
    from src.tools.ask_user_input_tool import ask_user_input

    session_id = 100
    side_queue = asyncio.Queue()
    reg = FormRequestRegistry()
    reg.register_session_queue(session_id, side_queue)
    current_session_id_var.set(session_id)

    async def resolve_immediately():
        await asyncio.sleep(0.02)
        item = await side_queue.get()
        assert item["type"] == "form_request"
        assert "id" in item["payload"]
        form_id = item["payload"]["id"]
        reg.resolve_form(form_id, "intake_completed. patient_id=1")

    asyncio.create_task(resolve_immediately())
    result = await ask_user_input(
        title="Tell us about yourself",
        fields=[{"name": "first_name", "label": "First name", "type": "text"}],
    )
    assert result.startswith("intake_completed")


@pytest.mark.asyncio
async def test_ask_user_input_requires_fields_or_choices():
    """ask_user_input returns an error when neither fields nor choices is provided."""
    from src.tools.ask_user_input_tool import ask_user_input

    current_session_id_var.set(None)
    result = await ask_user_input(title="Missing both")
    assert result.startswith("Error:")
