import pytest
from src.forms.templates import TEMPLATES, FormTemplate, FormField


def test_patient_intake_template_exists():
    assert "patient_intake" in TEMPLATES


def test_confirm_visit_template_exists():
    assert "confirm_visit" in TEMPLATES


def test_patient_intake_has_required_fields():
    template = TEMPLATES["patient_intake"]
    field_names = [f.name for f in template.fields]
    for name in [
        "first_name", "last_name", "dob", "gender",
        "phone", "email", "address", "chief_complaint",
        "insurance_provider", "policy_id",
        "emergency_contact_name", "emergency_contact_relationship",
        "emergency_contact_phone",
    ]:
        assert name in field_names, f"Missing field: {name}"


def test_symptoms_is_optional():
    template = TEMPLATES["patient_intake"]
    symptoms = next(f for f in template.fields if f.name == "symptoms")
    assert symptoms.required is False


def test_confirm_visit_is_yes_no():
    template = TEMPLATES["confirm_visit"]
    assert template.form_type == "yes_no"


def test_to_schema_returns_serialisable_dict():
    import json
    schema = TEMPLATES["patient_intake"].to_schema()
    # Must be JSON-serialisable
    json.dumps(schema)
    assert schema["form_type"] == "multi_field"
    assert len(schema["fields"]) > 0
