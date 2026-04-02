"""ask_user — DEPRECATED. Delegates to ask_user_input / ask_user_question.

Kept for backward compatibility with existing sessions that use legacy
template names. New code should use ask_user_input or ask_user_question.

Registered at import time with scope="global".
"""
import logging

from src.forms.templates import TEMPLATES
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


async def ask_user(template: str) -> str:
    """[Deprecated] Use ask_user_input() or ask_user_question() instead.

    Request structured input from the patient via an interactive form.
    Delegates to the new dynamic tools internally.

    Args:
        template: Which legacy form to show (e.g. "identify_patient", "confirm_visit").

    Returns:
        Status string with opaque IDs — never raw PII.
    """
    # Import here to avoid circular imports at module load time.
    from .ask_user_input_tool import ask_user_input
    from .ask_user_question_tool import ask_user_question

    if template not in TEMPLATES:
        return f"Error: unknown template '{template}'. Valid: {list(TEMPLATES)}"

    tmpl = TEMPLATES[template]

    if tmpl.form_type == "yes_no":
        return await ask_user_question(
            question=tmpl.message or tmpl.title,
            choices=["Yes", "No"],
        )

    # Convert flat fields to a single section.
    section = {
        "label": "",
        "fields": [f.to_dict() for f in tmpl.fields],
    }
    return await ask_user_input(
        title=tmpl.title,
        sections=[section],
        message=tmpl.message,
    )


_registry = ToolRegistry()
_registry.register(
    ask_user,
    scope="global",
    symbol="ask_user",
    allow_overwrite=True,
)
