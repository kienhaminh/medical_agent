"""ask_user_question — choice-based question tool.

Lets the agent ask the patient a question with predefined choices
(yes/no, single-select, or multi-select). The patient clicks their
answer and it is returned directly to the agent.

No PII concerns — choices are agent-defined strings.

Registered at import time with scope="global".
"""
import asyncio
import logging
import uuid

from src.tools.form_request_registry import form_registry, current_session_id_var
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

FORM_TIMEOUT_SECONDS = 300.0


async def ask_user_question(
    question: str,
    choices: list[str],
    allow_multiple: bool = False,
) -> str:
    """Ask the patient a question with predefined answer choices.

    Displays a question with clickable choice buttons at the bottom of the
    chat, replacing the text input. The patient selects one (or multiple
    if allow_multiple is true) and submits.

    Args:
        question: The question text to display to the patient.
        choices: List of answer options. Examples:
            ["Yes", "No"]
            ["Mild", "Moderate", "Severe"]
            ["Headache", "Fever", "Nausea", "Fatigue", "Other"]
        allow_multiple: If true, the patient can select more than one choice.
            Default false (single choice only).

    Returns:
        The selected choice(s) as a string. Examples:
            "Yes"
            "Moderate"
            "Mild, Severe"  (when allow_multiple=true, comma-separated)
            "form_timeout"  (if patient does not respond within 5 minutes)

    Examples:
        # Yes/no confirmation
        ask_user_question(
            question="Are you ready to proceed with your visit today?",
            choices=["Yes, proceed", "No, cancel"]
        )

        # Severity scale
        ask_user_question(
            question="How would you rate your pain on a scale?",
            choices=["Mild", "Moderate", "Severe"]
        )

        # Multi-select symptoms
        ask_user_question(
            question="Which of the following symptoms are you experiencing?",
            choices=["Headache", "Fever", "Nausea", "Fatigue", "Other"],
            allow_multiple=True
        )
    """
    if not choices or len(choices) < 2:
        return "Error: choices must contain at least 2 options"

    form_id = str(uuid.uuid4())
    session_id = current_session_id_var.get()

    event = asyncio.Event()
    form_registry.register_form(form_id, event, "_dynamic_question")

    try:
        queue = form_registry.get_session_queue(session_id)
        if queue is None:
            logger.warning(
                "ask_user_question called with no session queue (session_id=%s)",
                session_id,
            )
        else:
            await queue.put({
                "type": "form_request",
                "payload": {
                    "id": form_id,
                    "template": "_dynamic_question",
                    "schema": {
                        "title": "",
                        "form_type": "question",
                        "message": question,
                        "choices": choices,
                        "allow_multiple": allow_multiple,
                    },
                },
            })

        try:
            await asyncio.wait_for(event.wait(), timeout=FORM_TIMEOUT_SECONDS)
        except asyncio.TimeoutError:
            logger.info(
                "Question timed out: form_id=%s session_id=%s",
                form_id,
                session_id,
            )
            return "form_timeout"

        result = form_registry.get_form_result(form_id)
        logger.info("Question answered: form_id=%s result=%s", form_id, result)
        return result or "form_error"

    finally:
        form_registry.cleanup_form(form_id)


_registry = ToolRegistry()
_registry.register(
    ask_user_question,
    scope="global",
    symbol="ask_user_question",
    allow_overwrite=True,
)
