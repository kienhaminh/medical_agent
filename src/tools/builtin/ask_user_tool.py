"""ask_user — lets the reception agent collect structured input from the patient.

Registered at import time with scope="global".

Privacy contract: this tool NEVER returns raw PII. It returns status strings
and opaque IDs only. The vault handles PII storage.

Cleanup contract: cleanup_form() is called in a finally block so form entries
are removed from the registry even if the tool is cancelled or times out.
"""
import asyncio
import logging
import uuid

from src.forms.templates import TEMPLATES
from src.tools.form_request_registry import form_registry, current_session_id_var
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

FORM_TIMEOUT_SECONDS = 300.0


async def ask_user(template: str) -> str:
    """Request structured input from the patient via an interactive form.

    Pauses the agent until the patient submits the form. Returns a status
    string with opaque IDs — never raw PII.

    Use this tool when you need patient information or a confirmation.
    Do not attempt to read or interpret the personal data returned.

    Args:
        template: Which form to show.
            "patient_intake" — full check-in form (name, DOB, insurance, etc.)
            "confirm_visit"  — yes/no confirmation before creating a visit

    Returns:
        For "patient_intake":
            "intake_completed. patient_id=<N>, intake_id=<UUID>"
        For "confirm_visit":
            "confirmed" or "declined"
        On timeout: "form_timeout"
        On error:   "Error: <message>"
    """
    if template not in TEMPLATES:
        return f"Error: unknown template '{template}'. Valid: {list(TEMPLATES)}"

    form_id = str(uuid.uuid4())
    session_id = current_session_id_var.get()

    event = asyncio.Event()
    form_registry.register_form(form_id, event, template)

    try:
        # Push form_request to SSE side-channel
        queue = form_registry.get_session_queue(session_id)
        if queue is None:
            logger.warning(
                "ask_user called with no session queue (session_id=%s)", session_id
            )
        else:
            await queue.put({
                "type": "form_request",
                "payload": {
                    "id": form_id,
                    "template": template,
                    "schema": TEMPLATES[template].to_schema(),
                },
            })

        # Wait for patient to submit the form
        try:
            await asyncio.wait_for(event.wait(), timeout=FORM_TIMEOUT_SECONDS)
        except asyncio.TimeoutError:
            logger.info(
                "Form timed out: form_id=%s session_id=%s", form_id, session_id
            )
            return "form_timeout"

        result = form_registry.get_form_result(form_id)
        logger.info("Form completed: form_id=%s result=%s", form_id, result)
        return result or "form_error"

    finally:
        form_registry.cleanup_form(form_id)


_registry = ToolRegistry()
_registry.register(
    ask_user,
    scope="global",
    symbol="ask_user",
    allow_overwrite=True,
)
