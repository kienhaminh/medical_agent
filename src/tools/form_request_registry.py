"""In-memory registry that coordinates form requests between tools and SSE streams.

Each active chat session gets a side-channel asyncio.Queue that the SSE
generate() function reads from alongside the agent event stream.

Each pending form gets an asyncio.Event that the ask_user tool awaits.
The POST /form-response endpoint resolves it by calling resolve_form().

Cleanup contracts:
    - ask_user tool MUST call cleanup_form() in a finally block after awaiting the event.
    - SSE generate() MUST call unregister_session_queue() in a finally block.
    Failure to call these will leave orphan entries in memory.
"""
import asyncio
import contextvars
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Allows ask_user tool to find its session's side-channel queue
# without needing an explicit parameter.
current_session_id_var: contextvars.ContextVar[Optional[int]] = contextvars.ContextVar(
    "current_session_id", default=None
)


class FormRequestRegistry:
    """Singleton coordinating form events between tools and SSE streams."""

    _instance: Optional["FormRequestRegistry"] = None

    # session_id -> asyncio.Queue (SSE side-channel)
    _session_queues: dict[int, asyncio.Queue]

    # form_id -> asyncio.Event
    _form_events: dict[str, asyncio.Event]

    # form_id -> result string
    _form_results: dict[str, str]

    # form_id -> template name
    _form_templates: dict[str, str]

    def __new__(cls) -> "FormRequestRegistry":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._session_queues = {}
            cls._instance._form_events = {}
            cls._instance._form_results = {}
            cls._instance._form_templates = {}
        return cls._instance

    # --- session queue API ---

    def register_session_queue(self, session_id: int, queue: asyncio.Queue) -> None:
        self._session_queues[session_id] = queue

    def unregister_session_queue(self, session_id: int) -> None:
        self._session_queues.pop(session_id, None)

    def get_session_queue(self, session_id: Optional[int]) -> Optional[asyncio.Queue]:
        if session_id is None:
            return None
        return self._session_queues.get(session_id)

    # --- form event API ---

    def register_form(self, form_id: str, event: asyncio.Event, template: str) -> None:
        self._form_events[form_id] = event
        self._form_templates[form_id] = template

    def resolve_form(self, form_id: str, result: str) -> None:
        """Store result and fire the event so the waiting tool can return."""
        event = self._form_events.get(form_id)
        if event is None:
            logger.warning("resolve_form called for unknown form_id: %s", form_id)
            return
        self._form_results[form_id] = result
        event.set()

    def get_form_result(self, form_id: str) -> Optional[str]:
        return self._form_results.get(form_id)

    def get_form_template(self, form_id: str) -> Optional[str]:
        return self._form_templates.get(form_id)

    def cleanup_form(self, form_id: str) -> None:
        self._form_events.pop(form_id, None)
        self._form_results.pop(form_id, None)
        self._form_templates.pop(form_id, None)

    def reset(self) -> None:
        """Clear all state. For tests only."""
        self._session_queues.clear()
        self._form_events.clear()
        self._form_results.clear()
        self._form_templates.clear()


# Module-level singleton
form_registry = FormRequestRegistry()
