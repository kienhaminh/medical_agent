# tests/eval/test_patient_seeder.py
import pytest
from datetime import date
from unittest.mock import AsyncMock, MagicMock
from eval.case_loader import EvalCase, PatientProfile, MedicalHistoryItem, IntakeScript, CaseExpected, TriageExpectation
from eval.patient_seeder import PatientSeeder


def _make_case(age: int = 55) -> EvalCase:
    return EvalCase(
        id="test-seed-001",
        description="Test seeding case",
        patient=PatientProfile(
            name="John Doe",
            age=age,
            sex="male",
            medical_history=[
                MedicalHistoryItem(type="chronic_condition", name="Hypertension"),
                MedicalHistoryItem(type="medication", name="Lisinopril", dosage="10mg daily"),
            ],
            allergies=["Penicillin"],
        ),
        intake=IntakeScript(turns=["I have chest pain"]),
        expected=CaseExpected(triage=TriageExpectation(department="Cardiology")),
    )


@pytest.mark.asyncio
async def test_seed_creates_patient_via_api():
    """seed() calls create_patient with name, calculated dob, and sex."""
    mock_api = AsyncMock()
    mock_api.create_patient.return_value = {"id": 42}
    mock_db = AsyncMock()

    seeder = PatientSeeder(db=mock_db, api_client=mock_api)
    case = _make_case(age=55)

    patient_id = await seeder.seed(case)

    assert patient_id == 42
    mock_api.create_patient.assert_called_once()
    call_args = mock_api.create_patient.call_args
    assert call_args.kwargs.get("name") == "John Doe" or call_args.args[0] == "John Doe"


@pytest.mark.asyncio
async def test_seed_creates_medical_records_in_db():
    """seed() inserts MedicalRecord rows for history items and allergies."""
    mock_api = AsyncMock()
    mock_api.create_patient.return_value = {"id": 10}
    mock_db = AsyncMock()
    added_objects = []
    # Session.add() is synchronous — override with MagicMock so side_effect fires
    mock_db.add = MagicMock(side_effect=lambda obj: added_objects.append(obj))

    seeder = PatientSeeder(db=mock_db, api_client=mock_api)
    case = _make_case()

    await seeder.seed(case)

    # 2 history items + 1 allergy = 3 records
    assert len(added_objects) == 3
    record_types = [obj.record_type for obj in added_objects]
    assert "chronic_condition" in record_types
    assert "medication" in record_types
    assert "allergy" in record_types
    mock_db.commit.assert_called_once()


@pytest.mark.asyncio
async def test_teardown_deletes_records_and_patient():
    """teardown() executes DELETE for records then patient."""
    mock_db = AsyncMock()
    seeder = PatientSeeder(db=mock_db, api_client=AsyncMock())

    await seeder.teardown(patient_id=42)

    assert mock_db.execute.call_count >= 2  # records + patient
    mock_db.commit.assert_called_once()
