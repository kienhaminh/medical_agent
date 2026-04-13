"""Tests for privacy vault — save_intake function."""
import pytest
from unittest.mock import MagicMock, AsyncMock, patch

from src.forms.vault import save_intake


@pytest.mark.asyncio
async def test_save_intake_returns_patient_id_and_intake_id():
    """save_intake must return (int, str) — no PII."""
    answers = {
        "first_name": "Jane", "last_name": "Doe", "dob": "1990-05-15",
        "gender": "female", "email": "jane@test.com",
        "address": "1 Main St", "chief_complaint": "headache", "symptoms": "",
        "insurance_provider": "BlueCross", "policy_id": "BC123",
        "emergency_contact_name": "John Doe",
        "emergency_contact_relationship": "spouse",
        "emergency_contact_phone": "555-0101",
    }

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None  # new patient
    mock_db.execute.return_value = mock_result

    # When add() is called, set IDs on Patient and IntakeSubmission objects
    def fake_add(obj):
        if hasattr(obj, 'name') and not hasattr(obj, 'first_name'):  # Patient (has name, no first_name)
            obj.id = 42
        # submission is added later, ID will be set by refresh

    mock_db.add = MagicMock(side_effect=fake_add)

    async def fake_refresh(obj):
        if hasattr(obj, 'first_name'):  # submission object
            obj.id = "vault-abc"

    mock_db.refresh.side_effect = fake_refresh

    with patch("src.forms.vault.AsyncSessionLocal") as mock_session_cls:
        mock_ctx = AsyncMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_db)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)
        mock_session_cls.return_value = mock_ctx

        patient_id, intake_id = await save_intake(answers)

    assert isinstance(patient_id, int)
    assert isinstance(intake_id, str)
    assert patient_id == 42
    assert intake_id == "vault-abc"


@pytest.mark.asyncio
async def test_save_intake_reuses_existing_patient():
    """When patient lookup finds a match, it reuses that patient's id."""
    answers = {
        "first_name": "Jane", "last_name": "Doe", "dob": "1990-05-15",
        "gender": "female", "email": "jane@test.com",
        "address": "1 Main St", "chief_complaint": "headache", "symptoms": "",
        "insurance_provider": "BlueCross", "policy_id": "BC123",
        "emergency_contact_name": "John Doe",
        "emergency_contact_relationship": "spouse",
        "emergency_contact_phone": "555-0101",
    }

    mock_existing_patient = MagicMock()
    mock_existing_patient.id = 7

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_existing_patient
    mock_db.execute.return_value = mock_result

    async def fake_refresh(obj):
        obj.id = "vault-xyz"

    mock_db.refresh.side_effect = fake_refresh

    with patch("src.forms.vault.AsyncSessionLocal") as mock_session_cls:
        mock_ctx = AsyncMock()
        mock_ctx.__aenter__ = AsyncMock(return_value=mock_db)
        mock_ctx.__aexit__ = AsyncMock(return_value=False)
        mock_session_cls.return_value = mock_ctx

        patient_id, intake_id = await save_intake(answers)

    assert patient_id == 7
    assert isinstance(intake_id, str)
