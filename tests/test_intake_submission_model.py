"""Tests for IntakeSubmission model."""
import pytest
from src.models.intake_submission import IntakeSubmission


def test_intake_submission_has_required_fields():
    """Test that IntakeSubmission has all required fields."""
    s = IntakeSubmission()
    for field in [
        "id", "patient_id", "first_name", "last_name", "dob", "gender",
        "phone", "chief_complaint", "symptoms", "extra_data", "created_at",
    ]:
        assert hasattr(s, field), f"Missing field: {field}"


def test_intake_submission_tablename():
    """Test that IntakeSubmission has correct table name."""
    assert IntakeSubmission.__tablename__ == "intake_submissions"
