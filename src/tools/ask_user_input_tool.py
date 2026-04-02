"""ask_user_input — dynamic multi-field form tool.

Lets the agent generate a form schema on the fly (title, sections, fields)
and present it to the patient. The patient fills it out and submits.

Privacy contract: PII fields are stored in the vault; the tool returns
opaque IDs only. Non-PII field values are returned as-is.

Registered at import time with scope="global".
"""
import asyncio
import logging
import uuid

from src.tools.form_request_registry import form_registry, current_session_id_var
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

FORM_TIMEOUT_SECONDS = 300.0


def _normalize_sections(sections: list[dict]) -> tuple[list[dict], list[str]]:
    """Normalize agent-provided sections into canonical form.

    Ensures each field has ``field_type`` (from ``type`` alias),
    ``required`` defaults to True, and collects all field names.

    Returns (normalized_sections, all_field_names).
    """
    normalized: list[dict] = []
    all_field_names: list[str] = []

    for section in sections:
        norm_fields: list[dict] = []
        for f in section.get("fields", []):
            field: dict = {
                "name": f["name"],
                "label": f["label"],
                "field_type": f.get("field_type") or f.get("type", "text"),
                "required": f.get("required", True),
            }
            if "options" in f:
                field["options"] = f["options"]
            if "placeholder" in f:
                field["placeholder"] = f["placeholder"]
            norm_fields.append(field)
            all_field_names.append(f["name"])
        normalized.append({
            "label": section.get("label", ""),
            "fields": norm_fields,
        })

    return normalized, all_field_names


async def ask_user_input(
    title: str,
    sections: list[dict],
    message: str = "",
) -> str:
    """Collect structured information from the patient via an interactive form.

    The form replaces the chat input bar until the patient submits it.

    PRIVACY: This tool NEVER returns raw personal information. It returns
    opaque IDs and non-sensitive field values only.

    If the form contains patient identity fields (first_name, last_name,
    dob, gender), the system automatically creates or looks up the patient
    record and returns a patient_id.

    Args:
        title: Form heading displayed to the patient (e.g. "New Patient Registration").
        sections: List of section objects. Each section has:
            - "label" (str): Section heading shown to the patient (e.g. "Personal Info").
            - "fields" (list[dict]): Fields in this section. Each field has:
                - "name" (str): Machine-readable identifier in snake_case.
                - "label" (str): Human-readable label shown to the patient.
                - "type" (str): One of "text", "date", "select", "textarea".
                - "required" (bool, optional): Whether the field must be filled. Default true.
                - "placeholder" (str, optional): Placeholder hint text.
                - "options" (list[str], optional): Choices for "select" type fields.
        message: Optional helper text displayed below the title.

    Returns:
        A status string with opaque identifiers. Examples:
            "form_completed. patient_id=42, is_new=true, intake_id=abc-123"
            "form_completed. fields_collected=allergy_info,preferred_language"
            "form_timeout" (if patient does not respond within 5 minutes)
            "Error: <message>" (on failure)

    Example:
        ask_user_input(
            title="New Patient Registration",
            message="Welcome! Please fill out your details below.",
            sections=[
                {
                    "label": "Personal Info",
                    "fields": [
                        {"name": "first_name", "label": "First Name", "type": "text", "required": true, "placeholder": "Jane"},
                        {"name": "last_name", "label": "Last Name", "type": "text", "required": true, "placeholder": "Doe"},
                        {"name": "dob", "label": "Date of Birth", "type": "date", "required": true},
                        {"name": "gender", "label": "Gender", "type": "select", "options": ["male", "female", "other"]}
                    ]
                },
                {
                    "label": "Contact",
                    "fields": [
                        {"name": "phone", "label": "Phone Number", "type": "text", "placeholder": "+1 555 000 0000"},
                        {"name": "email", "label": "Email Address", "type": "text", "placeholder": "jane@example.com"},
                        {"name": "address", "label": "Home Address", "type": "textarea", "placeholder": "123 Main St, City, State"}
                    ]
                },
                {
                    "label": "Insurance",
                    "fields": [
                        {"name": "insurance_provider", "label": "Insurance Provider", "type": "text", "placeholder": "e.g. Blue Cross"},
                        {"name": "policy_id", "label": "Policy / Member ID", "type": "text"}
                    ]
                },
                {
                    "label": "Emergency Contact",
                    "fields": [
                        {"name": "emergency_contact_name", "label": "Contact Name", "type": "text"},
                        {"name": "emergency_contact_relationship", "label": "Relationship", "type": "select", "options": ["spouse", "parent", "sibling", "friend", "other"]},
                        {"name": "emergency_contact_phone", "label": "Contact Phone", "type": "text"}
                    ]
                }
            ]
        )
    """
    if not sections:
        return "Error: sections list cannot be empty"

    normalized_sections, all_field_names = _normalize_sections(sections)

    form_id = str(uuid.uuid4())
    session_id = current_session_id_var.get()

    event = asyncio.Event()
    form_registry.register_form(
        form_id, event, "_dynamic_input", field_names=all_field_names,
    )

    try:
        queue = form_registry.get_session_queue(session_id)
        if queue is None:
            logger.warning(
                "ask_user_input called with no session queue (session_id=%s)",
                session_id,
            )
        else:
            await queue.put({
                "type": "form_request",
                "payload": {
                    "id": form_id,
                    "template": "_dynamic_input",
                    "schema": {
                        "title": title,
                        "form_type": "multi_field",
                        "message": message,
                        "sections": normalized_sections,
                    },
                },
            })

        try:
            await asyncio.wait_for(event.wait(), timeout=FORM_TIMEOUT_SECONDS)
        except asyncio.TimeoutError:
            logger.info(
                "Form timed out: form_id=%s session_id=%s", form_id, session_id,
            )
            return "form_timeout"

        result = form_registry.get_form_result(form_id)
        logger.info("Form completed: form_id=%s result=%s", form_id, result)
        return result or "form_error"

    finally:
        form_registry.cleanup_form(form_id)


_registry = ToolRegistry()
_registry.register(
    ask_user_input,
    scope="global",
    symbol="ask_user_input",
    allow_overwrite=True,
)
