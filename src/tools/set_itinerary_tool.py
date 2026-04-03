"""Built-in tool for setting a patient's visit itinerary.

Called by the Reception agent after complete_triage. Creates ordered
VisitStep rows, auto-prepends a Registration step (done), and activates
the first agent-provided step. Self-registers at import time.
"""
import logging
from datetime import datetime, timezone

from sqlalchemy import select

from src.models import SessionLocal
from src.models.visit import Visit
from src.models.visit_step import VisitStep, StepStatus
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


def set_itinerary(visit_id: int, steps: list[dict]) -> str:
    """Define the ordered list of stops for a patient's visit itinerary.

    Call this after complete_triage to give the patient a clear roadmap.
    A 'Registration & Intake' step is automatically prepended as completed.
    The first step you provide becomes the active step.

    Args:
        visit_id: The visit DB id (from system context, e.g. 'Visit DB ID: 12')
        steps: Ordered list of stops. Each dict must have:
            - order (int): Position starting at 1 (shifted to 2+ internally)
            - label (str): Display name e.g. "ENT Department", "Blood Test Lab"
            - department (str | None): Department name key e.g. "ent", or None
            - description (str, optional): What happens here
            - room (str, optional): Room or location e.g. "Room 204, Floor 2"

    Returns:
        Confirmation message with tracking link to share with patient.
    """
    with SessionLocal() as db:
        visit = db.execute(
            select(Visit).where(Visit.id == visit_id)
        ).scalar_one_or_none()

        if not visit:
            return f"Error: Visit with id={visit_id} not found."

        # Clear any existing steps for this visit (idempotent)
        existing = db.execute(
            select(VisitStep).where(VisitStep.visit_id == visit_id)
        ).scalars().all()
        for s in existing:
            db.delete(s)
        db.flush()

        now = datetime.now(timezone.utc).replace(tzinfo=None)

        # Auto-prepend Registration step (always done — patient completed intake)
        db.add(VisitStep(
            visit_id=visit_id,
            step_order=1,
            department=None,
            label="Registration & Intake",
            description="Completed at reception",
            room=None,
            status=StepStatus.DONE.value,
            completed_at=now,
        ))

        # Agent-provided steps start at order 2
        for i, step in enumerate(steps):
            is_first = i == 0
            db.add(VisitStep(
                visit_id=visit_id,
                step_order=i + 2,  # offset by 1 for the Registration step
                department=step.get("department"),
                label=step["label"],
                description=step.get("description"),
                room=step.get("room"),
                status=StepStatus.ACTIVE.value if is_first else StepStatus.PENDING.value,
                completed_at=None,
            ))

        db.commit()

    n = len(steps)
    first_label = steps[0]["label"] if steps else "none"
    logger.info(
        "Itinerary set for visit %s: %d steps, first active: %s",
        visit.visit_id, n, first_label,
    )

    return (
        f"Itinerary set: {n} step(s) created. "
        f"Step 1 ({first_label}) is now active.\n"
        f"Tracking link for patient: /track/{visit.visit_id}"
    )


_registry = ToolRegistry()
_registry.register(
    set_itinerary,
    scope="global",
    symbol="set_itinerary",
    allow_overwrite=True,
)
