"""Tests for the intake redesign — prompt, classification, model, vault."""


def test_intake_system_prompt_is_nonempty_string():
    from src.prompt.intake import INTAKE_SYSTEM_PROMPT
    assert isinstance(INTAKE_SYSTEM_PROMPT, str)
    assert len(INTAKE_SYSTEM_PROMPT) > 100


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


def test_height_cm_not_in_unknown_fields():
    """height_cm must not fall into the 'unknown' bucket after classification."""
    from src.forms.field_classification import PII_FIELDS, SAFE_FIELDS
    field = "height_cm"
    assert field in SAFE_FIELDS
    assert field not in PII_FIELDS


def test_intake_submission_nullable_columns():
    """email and dropped fields must be Optional on the model."""
    from src.models.intake_submission import IntakeSubmission
    from typing import get_args
    hints = IntakeSubmission.__annotations__

    nullable_fields = [
        "email", "address", "insurance_provider", "policy_id",
        "emergency_contact_name", "emergency_contact_relationship",
        "emergency_contact_phone",
    ]
    for field in nullable_fields:
        assert field in hints, f"Missing annotation for {field}"
        hint = hints[field]
        # SQLAlchemy Mapped[Optional[str]] → check Optional
        args = get_args(hint)
        inner = args[0] if args else hint
        inner_args = get_args(inner)
        assert type(None) in inner_args, (
            f"{field} should be Optional but got {hint}"
        )
