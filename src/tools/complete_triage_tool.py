"""Built-in tool for completing patient intake triage.

Called by the Reception agent after gathering enough information
to suggest department routing. Self-registers at import time.
"""
import logging
from typing import List
from sqlalchemy import select

from src.models import SessionLocal
from src.models.department import Department
from src.models.room import Room
from src.models.visit import Visit, VisitStatus, AUTO_ROUTE_THRESHOLD
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


def complete_triage(
    id: int,
    chief_complaint: str,
    intake_notes: str,
    routing_suggestion: List[str],
    confidence: float,
) -> str:
    """Complete the patient intake triage and route the visit.

    Call this when you have gathered enough information from the patient
    to suggest a department routing. This updates the visit record and
    routes it based on confidence level.

    Args:
        id: The visit primary key ID (provided in system context)
        chief_complaint: One-line summary of the patient's primary concern
        intake_notes: Structured summary of symptoms, history, and assessment
        routing_suggestion: List of department names to route to (e.g., ['cardiology'])
        confidence: Confidence in the routing suggestion (0.0-1.0)

    Returns:
        Confirmation message with routing outcome
    """
    with SessionLocal() as db:
        visit = db.execute(
            select(Visit).where(Visit.id == id)
        ).scalar_one_or_none()

        if not visit:
            return f"Error: Visit with id={id} not found."

        if visit.status != VisitStatus.INTAKE.value:
            return f"Error: Visit is not in intake status (current: {visit.status})."

        # Normalize department names: AI may produce labels like "Pulmonology"
        # but the DB FK expects the name key like "pulmonology"
        departments = db.execute(select(Department)).scalars().all()
        dept_lookup: dict[str, str] = {}
        for dept in departments:
            dept_lookup[dept.name.lower()] = dept.name
            dept_lookup[dept.label.lower()] = dept.name
        normalized = [dept_lookup.get(s.lower(), s) for s in routing_suggestion]

        visit.chief_complaint = chief_complaint
        visit.intake_notes = intake_notes
        visit.routing_suggestion = normalized
        visit.confidence = confidence

        if confidence >= AUTO_ROUTE_THRESHOLD:
            visit.routing_decision = normalized
            visit.status = VisitStatus.IN_DEPARTMENT.value
            # Auto-assign department and queue position
            target_dept = normalized[0] if normalized else None
            if target_dept:
                visit.current_department = target_dept
                from sqlalchemy import func
                max_pos = db.execute(
                    select(func.max(Visit.queue_position))
                    .where(Visit.current_department == target_dept)
                    .where(Visit.status == VisitStatus.IN_DEPARTMENT.value)
                ).scalar() or 0
                visit.queue_position = max_pos + 1
                # Assign the first empty room in the target department (ordered by room_number ascending)
                empty_room = db.execute(
                    select(Room)
                    .where(Room.department_name == target_dept)
                    .where(Room.current_visit_id.is_(None))
                    .order_by(Room.room_number)
                ).scalars().first()
                if empty_room:
                    empty_room.current_visit_id = visit.id
            route_msg = f"Auto-routed to: {', '.join(routing_suggestion)} (confidence: {confidence:.2f})"
        else:
            visit.status = VisitStatus.PENDING_REVIEW.value
            route_msg = f"Sent to doctor for review (confidence: {confidence:.2f})"

        db.commit()

        logger.info("Triage completed for visit %s: %s", visit.visit_id, route_msg)

        return f"Triage completed. {route_msg}. You may now give the patient a closing message."


# Auto-register to the global tool registry (matches existing pattern)
_registry = ToolRegistry()
_registry.register(
    complete_triage,
    scope="global",
    symbol="complete_triage",
    allow_overwrite=True,
)
