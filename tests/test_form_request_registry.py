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


def test_register_and_get_session_queue():
    reg = FormRequestRegistry()
    q = asyncio.Queue()
    reg.register_session_queue(1, q)
    assert reg.get_session_queue(1) is q


def test_unregister_session_queue():
    reg = FormRequestRegistry()
    q = asyncio.Queue()
    reg.register_session_queue(1, q)
    reg.unregister_session_queue(1)
    assert reg.get_session_queue(1) is None


@pytest.mark.asyncio
async def test_register_form_and_resolve():
    reg = FormRequestRegistry()
    event = asyncio.Event()
    reg.register_form("form-1", event, "confirm_visit")

    reg.resolve_form("form-1", "confirmed")

    assert event.is_set()
    assert reg.get_form_result("form-1") == "confirmed"


def test_get_form_template():
    reg = FormRequestRegistry()
    event = asyncio.Event()
    reg.register_form("form-2", event, "patient_intake")
    assert reg.get_form_template("form-2") == "patient_intake"


def test_cleanup_form_removes_entry():
    reg = FormRequestRegistry()
    event = asyncio.Event()
    reg.register_form("form-3", event, "confirm_visit")
    reg.cleanup_form("form-3")
    assert reg.get_form_result("form-3") is None
    assert reg.get_form_template("form-3") is None


def test_get_form_entry_returns_none_for_unknown():
    reg = FormRequestRegistry()
    assert reg.get_form_result("no-such-id") is None


def test_context_var_default_is_none():
    assert current_session_id_var.get() is None
