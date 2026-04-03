"""Tests for VisitStep model and StepStatus enum."""


def test_visit_step_model_importable():
    from src.models.visit_step import VisitStep, StepStatus
    s = VisitStep()
    assert hasattr(s, "visit_id")
    assert hasattr(s, "step_order")
    assert hasattr(s, "label")
    assert hasattr(s, "department")
    assert hasattr(s, "description")
    assert hasattr(s, "room")
    assert hasattr(s, "status")
    assert hasattr(s, "completed_at")


def test_step_status_enum_values():
    from src.models.visit_step import StepStatus
    assert StepStatus.PENDING.value == "pending"
    assert StepStatus.ACTIVE.value == "active"
    assert StepStatus.DONE.value == "done"


def test_visit_step_exported_from_models():
    from src.models import VisitStep, StepStatus
    assert VisitStep is not None
    assert StepStatus is not None
