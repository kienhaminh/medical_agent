"""Built-in tool for updating visit status during doctor consultations.

Called by the Doctor agent to transition visits (e.g., discharge a patient).
Self-registers at import time.
"""
import logging
from sqlalchemy import select

from src.models import SessionLocal
from src.models.visit import Visit, VisitStatus
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

# Valid transitions from doctor context
DOCTOR_TRANSITIONS = {
    VisitStatus.IN_DEPARTMENT.value: [VisitStatus.COMPLETED.value],
    VisitStatus.ROUTED.value: [VisitStatus.IN_DEPARTMENT.value],
}


def update_visit_status(
    visit_id: int,
    new_status: str,
) -> str:
    """Update the status of a patient visit.

    Allows doctors to transition visit status, primarily for discharging patients.
    Only valid transitions are allowed.

    Args:
        visit_id: The visit's primary key ID
        new_status: The target status (e.g., 'completed' for discharge)

    Returns:
        Confirmation message with the status change
    """
    with SessionLocal() as db:
        visit = db.execute(
            select(Visit).where(Visit.id == visit_id)
        ).scalar_one_or_none()

        if not visit:
            return f"Error: Visit with id={visit_id} not found."

        allowed = DOCTOR_TRANSITIONS.get(visit.status, [])
        if new_status not in allowed:
            return f"Error: Cannot transition from '{visit.status}' to '{new_status}'. Allowed: {allowed}"

        old_status = visit.status
        visit.status = new_status

        # Clear department fields on discharge
        if new_status == VisitStatus.COMPLETED.value:
            visit.current_department = None
            visit.queue_position = None

        db.commit()

        logger.info("Visit %s status changed: %s -> %s", visit.visit_id, old_status, new_status)
        return f"Visit {visit.visit_id} status updated from '{old_status}' to '{new_status}'."


_registry = ToolRegistry()
_registry.register(
    update_visit_status,
    scope="assignable",
    symbol="update_visit_status",
    allow_overwrite=True,
)
