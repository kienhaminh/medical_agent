"""Tests for Allergy, Medication, and VitalSign models."""
import pytest
from datetime import date, datetime


def test_allergy_model_fields():
    """Allergy has the required columns."""
    from src.models.allergy import Allergy
    a = Allergy(
        patient_id=1,
        allergen="Penicillin",
        reaction="Anaphylaxis",
        severity="severe",
        recorded_at=date(2024, 1, 15),
    )
    assert a.allergen == "Penicillin"
    assert a.severity == "severe"
    assert a.patient_id == 1


def test_medication_model_fields():
    """Medication tracks active and ended prescriptions."""
    from src.models.medication import Medication
    m = Medication(
        patient_id=1,
        name="Metformin",
        dosage="500mg",
        frequency="twice daily",
        prescribed_by="Dr. Smith",
        start_date=date(2023, 3, 1),
    )
    assert m.name == "Metformin"
    assert m.end_date is None  # active


def test_vital_sign_model_fields():
    """VitalSign stores a point-in-time reading."""
    from src.models.vital_sign import VitalSign
    v = VitalSign(
        patient_id=1,
        recorded_at=datetime(2025, 6, 1, 9, 0),
        systolic_bp=128,
        diastolic_bp=82,
        heart_rate=72,
    )
    assert v.systolic_bp == 128
    assert v.visit_id is None  # standalone


def test_patient_dob_is_date_type():
    """Patient.dob must be a date object, not a string."""
    from src.models.patient import Patient
    from datetime import date
    p = Patient(name="Test", dob=date(1990, 1, 1), gender="female")
    assert isinstance(p.dob, date)
    assert str(p.dob) == "1990-01-01"
