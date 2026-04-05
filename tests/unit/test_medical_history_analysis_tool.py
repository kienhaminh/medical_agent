"""Unit tests for analyze_medical_history tool."""
import pytest
from datetime import date, datetime
from unittest.mock import MagicMock, patch


# ---------------------------------------------------------------------------
# Helpers — build fake ORM objects without hitting the DB
# ---------------------------------------------------------------------------

def _patient(id=1, name="Nguyen Van A", dob=date(1970, 5, 15), gender="male"):
    p = MagicMock()
    p.id = id
    p.name = name
    p.dob = dob
    p.gender = gender
    return p


def _record(record_type="text", content="Patient has hypertension.", summary=None,
            created_at=datetime(2024, 3, 1)):
    r = MagicMock()
    r.record_type = record_type
    r.content = content
    r.summary = summary
    r.created_at = created_at
    return r


def _vital(systolic_bp=130, diastolic_bp=85, heart_rate=78, temperature=36.8,
           respiratory_rate=16, oxygen_saturation=98.0, weight_kg=70.0,
           height_cm=170.0, recorded_at=datetime(2024, 6, 1)):
    v = MagicMock()
    v.systolic_bp = systolic_bp
    v.diastolic_bp = diastolic_bp
    v.heart_rate = heart_rate
    v.temperature = temperature
    v.respiratory_rate = respiratory_rate
    v.oxygen_saturation = oxygen_saturation
    v.weight_kg = weight_kg
    v.height_cm = height_cm
    v.recorded_at = recorded_at
    return v


def _medication(name="Amlodipine", dosage="5mg", frequency="once daily",
                start_date=date(2023, 1, 1), end_date=None):
    m = MagicMock()
    m.name = name
    m.dosage = dosage
    m.frequency = frequency
    m.start_date = start_date
    m.end_date = end_date
    return m


def _allergy(allergen="Penicillin", reaction="Rash", severity="moderate",
             recorded_at=date(2020, 4, 10)):
    a = MagicMock()
    a.allergen = allergen
    a.reaction = reaction
    a.severity = severity
    a.recorded_at = recorded_at
    return a


def _imaging(image_type="flair", segmentation_result=None,
             created_at=datetime(2024, 2, 20)):
    i = MagicMock()
    i.image_type = image_type
    i.segmentation_result = segmentation_result
    i.created_at = created_at
    return i


# ---------------------------------------------------------------------------
# Fixture: mock DB session that returns a fully-populated patient dataset
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_db_full(monkeypatch):
    """Patch SessionLocal to return a fully-populated patient dataset."""
    patient = _patient()
    records = [_record(), _record(record_type="pdf", content=None, summary="ECG normal sinus rhythm")]
    vitals = [_vital()]
    meds = [_medication()]
    allergies = [_allergy()]
    images = [_imaging()]

    session = MagicMock()

    def execute_side_effect(stmt):
        result = MagicMock()
        # Identify query by inspecting the WHERE clause entity
        entity = stmt.froms[0].entity_zero.entity if hasattr(stmt, 'froms') else None
        from src.models import Patient, MedicalRecord, VitalSign, Medication, Allergy, Imaging
        if entity is Patient:
            result.scalar_one_or_none.return_value = patient
        elif entity is MedicalRecord:
            result.scalars.return_value.all.return_value = records
        elif entity is VitalSign:
            result.scalars.return_value.all.return_value = vitals
        elif entity is Medication:
            result.scalars.return_value.all.return_value = meds
        elif entity is Allergy:
            result.scalars.return_value.all.return_value = allergies
        elif entity is Imaging:
            result.scalars.return_value.all.return_value = images
        else:
            result.scalars.return_value.all.return_value = []
            result.scalar_one_or_none.return_value = None
        return result

    session.execute.side_effect = execute_side_effect
    session.__enter__ = MagicMock(return_value=session)
    session.__exit__ = MagicMock(return_value=False)

    mock_session_local = MagicMock(return_value=session)

    monkeypatch.setattr(
        "src.tools.medical_history_analysis_tool.SessionLocal",
        mock_session_local,
    )
    return session


@pytest.fixture
def mock_llm(monkeypatch):
    """Patch _call_llm to return a fixed analysis string."""
    llm_output = """## Chief Concerns
- Hypertension (ongoing)

## Chronic Conditions
- Essential hypertension diagnosed 2023

## Medication Review
- Amlodipine 5mg once daily (active)

## Allergy Profile
- Penicillin — Rash (moderate)

## Key Lab & Imaging Findings
- MRI flair available (2024-02-20)

## 🔴 Red Flags
- Elevated BP readings warrant follow-up

## Clinical Recommendations
- Annual cardiology review recommended"""

    monkeypatch.setattr(
        "src.tools.medical_history_analysis_tool._call_llm",
        lambda prompt: llm_output,
    )
    return llm_output


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestAnalyzeMedicalHistory:

    def test_returns_string(self, mock_db_full, mock_llm):
        """Tool must return a string."""
        from src.tools.medical_history_analysis_tool import analyze_medical_history
        result = analyze_medical_history(patient_id=1)
        assert isinstance(result, str)

    def test_contains_clinical_sections(self, mock_db_full, mock_llm):
        """Output must contain the expected clinical section headers."""
        from src.tools.medical_history_analysis_tool import analyze_medical_history
        result = analyze_medical_history(patient_id=1)
        assert "Chief Concerns" in result
        assert "Medication Review" in result
        assert "Allergy Profile" in result
        assert "Red Flags" in result
        assert "Clinical Recommendations" in result

    def test_patient_not_found_returns_error(self, monkeypatch):
        """When patient is not in DB, return a clear error string."""
        session = MagicMock()
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = None
        session.execute.return_value = result_mock
        session.__enter__ = MagicMock(return_value=session)
        session.__exit__ = MagicMock(return_value=False)
        monkeypatch.setattr(
            "src.tools.medical_history_analysis_tool.SessionLocal",
            MagicMock(return_value=session),
        )

        from src.tools.medical_history_analysis_tool import analyze_medical_history
        result = analyze_medical_history(patient_id=999)
        assert "not found" in result.lower()

    def test_focus_area_passed_to_llm(self, mock_db_full, monkeypatch):
        """When focus_area is provided, it must appear in the prompt sent to LLM."""
        captured = {}

        def capture_llm(prompt):
            captured["prompt"] = prompt
            return "## Chief Concerns\n- Test"

        monkeypatch.setattr(
            "src.tools.medical_history_analysis_tool._call_llm",
            capture_llm,
        )
        from src.tools.medical_history_analysis_tool import analyze_medical_history
        analyze_medical_history(patient_id=1, focus_area="cardiovascular")
        assert "cardiovascular" in captured["prompt"].lower()

    def test_no_records_does_not_crash(self, monkeypatch, mock_llm):
        """Tool must handle a patient with zero records/vitals/meds/allergies/imaging."""
        patient = _patient()
        session = MagicMock()

        def execute_side_effect(stmt):
            result = MagicMock()
            from src.models import Patient
            entity = stmt.froms[0].entity_zero.entity if hasattr(stmt, 'froms') else None
            if entity is Patient:
                result.scalar_one_or_none.return_value = patient
            else:
                result.scalars.return_value.all.return_value = []
            return result

        session.execute.side_effect = execute_side_effect
        session.__enter__ = MagicMock(return_value=session)
        session.__exit__ = MagicMock(return_value=False)
        monkeypatch.setattr(
            "src.tools.medical_history_analysis_tool.SessionLocal",
            MagicMock(return_value=session),
        )

        from src.tools.medical_history_analysis_tool import analyze_medical_history
        result = analyze_medical_history(patient_id=1)
        assert isinstance(result, str)
        assert len(result) > 0

    def test_registered_in_tool_registry(self):
        """analyze_medical_history must be registered in ToolRegistry after import."""
        import src.tools.medical_history_analysis_tool  # noqa: F401 — triggers registration
        from src.tools.registry import ToolRegistry
        registry = ToolRegistry()
        tool = registry.get("analyze_medical_history")
        assert tool is not None

    def test_text_record_content_truncated(self, monkeypatch, mock_llm):
        """Text records longer than 1500 chars must be truncated in the prompt."""
        patient = _patient()
        long_content = "A" * 3000
        records = [_record(content=long_content)]
        session = MagicMock()

        def execute_side_effect(stmt):
            result = MagicMock()
            from src.models import Patient, MedicalRecord
            entity = stmt.froms[0].entity_zero.entity if hasattr(stmt, 'froms') else None
            if entity is Patient:
                result.scalar_one_or_none.return_value = patient
            elif entity is MedicalRecord:
                result.scalars.return_value.all.return_value = records
            else:
                result.scalars.return_value.all.return_value = []
            return result

        session.execute.side_effect = execute_side_effect
        session.__enter__ = MagicMock(return_value=session)
        session.__exit__ = MagicMock(return_value=False)

        captured = {}

        def capture_llm(prompt):
            captured["prompt"] = prompt
            return "## Chief Concerns\n- Test"

        monkeypatch.setattr(
            "src.tools.medical_history_analysis_tool.SessionLocal",
            MagicMock(return_value=session),
        )
        monkeypatch.setattr(
            "src.tools.medical_history_analysis_tool._call_llm",
            capture_llm,
        )

        from src.tools.medical_history_analysis_tool import analyze_medical_history
        analyze_medical_history(patient_id=1)
        assert "A" * 3000 not in captured["prompt"]
        assert "A" * 1500 in captured["prompt"]       # truncated content is present
        assert "A" * 1501 not in captured["prompt"]   # content was not left longer than 1500
