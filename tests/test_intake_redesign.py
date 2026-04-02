"""Tests for the intake redesign — prompt, classification, model, vault."""


def test_intake_system_prompt_is_nonempty_string():
    from src.prompt.intake import INTAKE_SYSTEM_PROMPT
    assert isinstance(INTAKE_SYSTEM_PROMPT, str)
    assert len(INTAKE_SYSTEM_PROMPT) > 100
    assert "ask_user_input" in INTAKE_SYSTEM_PROMPT


def test_chat_request_accepts_mode_field():
    from src.api.models import ChatRequest
    req = ChatRequest(message="hello", mode="intake")
    assert req.mode == "intake"


def test_chat_request_mode_defaults_to_none():
    from src.api.models import ChatRequest
    req = ChatRequest(message="hello")
    assert req.mode is None


def test_phone_is_in_patient_identity_fields():
    from src.forms.field_classification import PATIENT_IDENTITY_FIELDS
    assert "phone" in PATIENT_IDENTITY_FIELDS


def test_height_cm_is_safe_field():
    from src.forms.field_classification import SAFE_FIELDS
    assert "height_cm" in SAFE_FIELDS


def test_weight_kg_is_safe_field():
    from src.forms.field_classification import SAFE_FIELDS
    assert "weight_kg" in SAFE_FIELDS
