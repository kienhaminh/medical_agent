import pytest
from unittest.mock import patch, MagicMock
from src.models import SessionLocal, Visit


def test_visit_has_urgency_level_field():
    """Visit model must expose urgency_level attribute."""
    v = Visit()
    assert hasattr(v, "urgency_level")
    v.urgency_level = "urgent"
    assert v.urgency_level == "urgent"


def test_order_model_has_required_fields():
    """Order model must have visit_id, patient_id, order_type, order_name, status."""
    from src.models.order import Order
    o = Order()
    assert hasattr(o, "visit_id")
    assert hasattr(o, "patient_id")
    assert hasattr(o, "order_type")
    assert hasattr(o, "order_name")
    assert hasattr(o, "status")


# ---------------------------------------------------------------------------
# Helpers for pre_visit_brief tests
# ---------------------------------------------------------------------------

def _make_mock_session(patient=None, visit=None, records=None):
    """Build a mock context-manager session with pre-configured execute responses."""
    mock_db = MagicMock()
    mock_session_cls = MagicMock()
    mock_session_cls.return_value.__enter__ = MagicMock(return_value=mock_db)
    mock_session_cls.return_value.__exit__ = MagicMock(return_value=False)

    # Execute is called in order: patient query, visit query, records query
    execute_results = []

    patient_result = MagicMock()
    patient_result.scalar_one_or_none.return_value = patient
    execute_results.append(patient_result)

    if patient is not None:
        visit_result = MagicMock()
        visit_result.scalar_one_or_none.return_value = visit
        execute_results.append(visit_result)

        if visit is not None:
            records_result = MagicMock()
            records_result.scalars.return_value.all.return_value = records or []
            execute_results.append(records_result)

    mock_db.execute.side_effect = execute_results
    return mock_session_cls, mock_db


# ---------------------------------------------------------------------------
# pre_visit_brief tests
# ---------------------------------------------------------------------------

def test_pre_visit_brief_returns_patient_info():
    """pre_visit_brief tool returns a string containing patient name and chief complaint."""
    from src.tools.builtin.pre_visit_brief_tool import pre_visit_brief

    mock_patient = MagicMock()
    mock_patient.id = 1
    mock_patient.name = "John Doe"
    mock_patient.dob = "1970-01-01"
    mock_patient.gender = "Male"

    mock_visit = MagicMock()
    mock_visit.id = 1
    mock_visit.visit_id = "VIS-20260329-001"
    mock_visit.patient_id = 1
    mock_visit.chief_complaint = "Chest pain"
    mock_visit.urgency_level = "urgent"
    mock_visit.current_department = None

    mock_session_cls, _ = _make_mock_session(
        patient=mock_patient,
        visit=mock_visit,
        records=[],
    )

    with patch("src.tools.builtin.pre_visit_brief_tool.SessionLocal", mock_session_cls):
        result = pre_visit_brief(patient_id=1, visit_id=1)

    assert isinstance(result, str)
    assert "John Doe" in result
    assert "Chest pain" in result


def test_pre_visit_brief_missing_patient():
    """Returns an error string when the patient does not exist."""
    from src.tools.builtin.pre_visit_brief_tool import pre_visit_brief

    mock_session_cls, _ = _make_mock_session(patient=None)

    with patch("src.tools.builtin.pre_visit_brief_tool.SessionLocal", mock_session_cls):
        result = pre_visit_brief(patient_id=999, visit_id=1)

    assert "Error" in result
    assert "999" in result


def test_pre_visit_brief_missing_visit():
    """Returns an error string when the visit does not exist."""
    from src.tools.builtin.pre_visit_brief_tool import pre_visit_brief

    mock_patient = MagicMock()
    mock_patient.id = 1
    mock_patient.name = "Jane Smith"

    mock_session_cls, _ = _make_mock_session(patient=mock_patient, visit=None)

    with patch("src.tools.builtin.pre_visit_brief_tool.SessionLocal", mock_session_cls):
        result = pre_visit_brief(patient_id=1, visit_id=999)

    assert "Error" in result
    assert "999" in result


def test_pre_visit_brief_includes_recent_records():
    """Brief includes recent medical record entries."""
    from datetime import datetime
    from src.tools.builtin.pre_visit_brief_tool import pre_visit_brief

    mock_patient = MagicMock()
    mock_patient.id = 1
    mock_patient.name = "Alice Brown"
    mock_patient.dob = "1985-03-20"
    mock_patient.gender = "Female"

    mock_visit = MagicMock()
    mock_visit.id = 2
    mock_visit.visit_id = "VIS-20260328-002"
    mock_visit.patient_id = 1
    mock_visit.chief_complaint = "Fever"
    mock_visit.urgency_level = "routine"
    mock_visit.current_department = "General Medicine"

    mock_record = MagicMock()
    mock_record.created_at = datetime(2026, 3, 1)
    mock_record.summary = "Previous flu visit"
    mock_record.content = "Influenza A positive"

    mock_session_cls, _ = _make_mock_session(
        patient=mock_patient,
        visit=mock_visit,
        records=[mock_record],
    )

    with patch("src.tools.builtin.pre_visit_brief_tool.SessionLocal", mock_session_cls):
        result = pre_visit_brief(patient_id=1, visit_id=2)

    assert "Alice Brown" in result
    assert "Fever" in result
    assert "Previous flu visit" in result


def test_pre_visit_brief_no_records_message():
    """Brief notes 'No records on file' when patient has no medical history."""
    from src.tools.builtin.pre_visit_brief_tool import pre_visit_brief

    mock_patient = MagicMock()
    mock_patient.id = 3
    mock_patient.name = "New Patient"
    mock_patient.dob = "2000-01-01"
    mock_patient.gender = "Other"

    mock_visit = MagicMock()
    mock_visit.id = 3
    mock_visit.visit_id = "VIS-20260329-003"
    mock_visit.patient_id = 3
    mock_visit.chief_complaint = "Routine checkup"
    mock_visit.urgency_level = None
    mock_visit.current_department = None

    mock_session_cls, _ = _make_mock_session(
        patient=mock_patient,
        visit=mock_visit,
        records=[],
    )

    with patch("src.tools.builtin.pre_visit_brief_tool.SessionLocal", mock_session_cls):
        result = pre_visit_brief(patient_id=3, visit_id=3)

    assert "No records on file" in result


# ---------------------------------------------------------------------------
# DDx tool tests
# ---------------------------------------------------------------------------

def test_ddx_tool_returns_json_with_diagnoses():
    """DDx tool returns valid JSON string with diagnoses list."""
    import json
    from src.tools.builtin.differential_diagnosis_tool import generate_differential_diagnosis

    mock_response_content = json.dumps({
        "diagnoses": [
            {
                "name": "Acute Coronary Syndrome",
                "icd10": "I24.9",
                "likelihood": "High",
                "evidence": "Chest pain radiating to arm",
                "red_flags": ["Diaphoresis", "ST elevation"]
            }
        ]
    })

    # Mock the LLM call inside the tool
    with patch("src.tools.builtin.differential_diagnosis_tool._call_llm", return_value=mock_response_content):
        result = generate_differential_diagnosis(
            patient_id=1,
            chief_complaint="Chest pain radiating to left arm",
            context="67yo male, hypertensive"
        )

    parsed = json.loads(result)
    assert "diagnoses" in parsed
    assert len(parsed["diagnoses"]) >= 1
    assert parsed["diagnoses"][0]["icd10"] == "I24.9"
