"""ask_user — flexible agent-defined form tool.

The agent specifies either a list of fields (structured form) or a set of
choices (inline question buttons). Each field can declare a db_field so PII
is saved privately without the agent ever seeing the values.

Blocks the agent until the patient submits the form.
The backend resolves the asyncio.Event, unblocking this tool, which returns
the processed result string to the agent.

Registered at import time with scope="global".
"""
import asyncio
import logging
import uuid
from typing import Optional

from src.tools.form_request_registry import form_registry, current_session_id_var
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

# Maximum seconds to wait for patient form submission before timing out.
_FORM_TIMEOUT_SECONDS = 900  # 15 minutes


async def ask_user_input(
    title: str = "",
    fields: Optional[list[dict]] = None,
    message: str = "",
    choices: Optional[list[str]] = None,
    allow_multiple: bool = False,
) -> str:
    """Show a form or question to the patient and return immediately.

    The patient responds at their own pace. The backend saves PII privately
    and automatically triggers the next agent turn once the patient submits.

    Use `fields` for structured data collection (text inputs, selects, etc).
    Use `choices` for simple single/multi-choice questions (inline buttons).
    Exactly one of `fields` or `choices` must be provided.

    Args:
        title:          Heading shown to the patient. For choice questions,
                        this is the question text (e.g. "Do you have insurance?").
        fields:         List of field definitions for structured forms. Each field:
                            - "name"        (str, required): snake_case key
                            - "label"       (str, required): human-readable label
                            - "type"        (str, required): "text" | "email" | "date" |
                                             "select" | "textarea" | "number"
                            - "required"    (bool, default true)
                            - "db_field"    (str, optional): "patient.<col>" or
                                             "intake.<col>" — saved as PII, never
                                             returned to the agent
                            - "placeholder" (str, optional)
                            - "options"     (list[str], optional): for "select" type
        message:        Optional helper text shown below the title (fields forms only).
        choices:        List of button labels for inline choice questions
                        (e.g. ["Yes", "No"] or ["Emergency", "Routine", "Follow-up"]).
        allow_multiple: When True, patient can select multiple choices before
                        submitting (choices mode only).

    Returns:
        Processed result string once the patient submits (blocks until then).
        "Error: ..."   — if neither fields nor choices provided, no session, or timeout.

    --- Field form example (patient identification) ---
        ask_user_input(
            title="Let's Get Started",
            message="We need a few details to look you up.",
            fields=[
                {"name": "first_name", "label": "First Name", "type": "text",
                 "db_field": "patient.first_name", "placeholder": "Jane"},
                {"name": "last_name",  "label": "Last Name",  "type": "text",
                 "db_field": "patient.last_name",  "placeholder": "Doe"},
                {"name": "dob",        "label": "Date of Birth", "type": "date",
                 "db_field": "patient.dob"},
                {"name": "gender",     "label": "Gender", "type": "select",
                 "db_field": "patient.gender",
                 "options": ["male", "female", "other"]},
            ]
        )

    --- Choice question example ---
        ask_user_input(
            title="Do you have health insurance?",
            choices=["Yes", "No"],
        )
    """
    has_fields = bool(fields)
    has_choices = bool(choices)

    if not has_fields and not has_choices:
        return "Error: provide either fields (structured form) or choices (question buttons)"

    session_id = current_session_id_var.get()
    queue = form_registry.get_session_queue(session_id)
    if queue is None:
        logger.warning("ask_user called with no session queue (session_id=%s)", session_id)
        return "Error: no active patient session"

    form_id = str(uuid.uuid4())

    if has_choices:
        payload = {
            "id": form_id,
            "form_type": "question",
            "question": title,
            "choices": choices,
            "allow_multiple": allow_multiple,
        }
    else:
        # Normalize fields — ensure required defaults to True if not specified.
        normalized_fields = []
        for f in fields:  # type: ignore[union-attr]
            field: dict = {
                "name": f["name"],
                "label": f["label"],
                "type": f.get("type", "text"),
                "required": f.get("required", True),
            }
            if "db_field" in f:
                field["db_field"] = f["db_field"]
            if "placeholder" in f:
                field["placeholder"] = f["placeholder"]
            if "options" in f:
                field["options"] = f["options"]
            normalized_fields.append(field)

        payload = {
            "id": form_id,
            "form_type": "fields",
            "title": title,
            "message": message,
            "fields": normalized_fields,
        }

    template = "_dynamic_question" if has_choices else "_dynamic_input"
    field_names = [f["name"] for f in normalized_fields] if not has_choices else None

    event = asyncio.Event()
    form_registry.register_form(form_id, event, template, field_names)

    await queue.put({"type": "form_request", "payload": payload})

    logger.info(
        "Form shown: form_id=%s form_type=%s session_id=%s — awaiting response",
        form_id, payload["form_type"], session_id,
    )

    try:
        await asyncio.wait_for(event.wait(), timeout=_FORM_TIMEOUT_SECONDS)
        result = form_registry.get_form_result(form_id)
        return result or "form_completed"
    except asyncio.TimeoutError:
        logger.warning("Form timed out: form_id=%s session_id=%s", form_id, session_id)
        return "Error: form response timed out"
    finally:
        form_registry.cleanup_form(form_id)


_registry = ToolRegistry()
_registry.register(
    ask_user_input,
    scope="global",
    symbol="ask_user_input",
    allow_overwrite=True,
)
