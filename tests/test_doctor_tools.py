import pytest
from src.models import SessionLocal, Visit


def test_visit_has_urgency_level_field():
    """Visit model must expose urgency_level attribute."""
    v = Visit()
    assert hasattr(v, "urgency_level")
    v.urgency_level = "urgent"
    assert v.urgency_level == "urgent"
