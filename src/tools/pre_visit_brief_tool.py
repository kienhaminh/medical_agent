"""Pre-visit brief tool — assembles a structured patient summary for the doctor.

Queries patient demographics, current visit, and recent medical records
from the database and formats them as a readable brief. No LLM call —
pure DB aggregation for speed and reliability.
"""
import logging
from sqlalchemy import select, desc

from src.models import SessionLocal, Visit, Patient, MedicalRecord
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


def pre_visit_brief(patient_id: int, visit_id: int) -> str:
    """Generate a structured pre-visit brief for a patient.

    Assembles patient demographics, current chief complaint, urgency level,
    and the last 3 medical records into a concise doctor briefing.

    Args:
        patient_id: The patient's database ID
        visit_id: The current visit's primary key ID

    Returns:
        Formatted brief string with demographics, chief complaint, and recent records
    """
    with SessionLocal() as db:
        patient = db.execute(
            select(Patient).where(Patient.id == patient_id)
        ).scalar_one_or_none()

        if not patient:
            return f"Error: Patient {patient_id} not found."

        visit = db.execute(
            select(Visit).where(Visit.id == visit_id)
        ).scalar_one_or_none()

        if not visit:
            return f"Error: Visit {visit_id} not found."

        # Fetch last 3 medical records ordered by most recent first
        records = db.execute(
            select(MedicalRecord)
            .where(MedicalRecord.patient_id == patient_id)
            .order_by(desc(MedicalRecord.created_at))
            .limit(3)
        ).scalars().all()

        # Build brief
        urgency = (visit.urgency_level or "routine").upper()
        lines = [
            f"# Pre-Visit Brief — {patient.name}",
            f"**Urgency:** {urgency}",
            f"**DOB:** {patient.dob}  |  **Gender:** {patient.gender}",
            f"**Visit:** {visit.visit_id}  |  **Department:** {visit.current_department or 'Unassigned'}",
            "",
            f"**Chief Complaint:** {visit.chief_complaint or 'Not recorded'}",
            "",
        ]

        if records:
            lines.append("**Recent Records (last 3):**")
            for r in records:
                date = r.created_at.strftime("%Y-%m-%d") if r.created_at else "Unknown"
                preview = (r.summary or r.content or "")[:120]
                lines.append(f"- [{date}] {preview}{'...' if len(preview) == 120 else ''}")
        else:
            lines.append("**Recent Records:** No records on file.")

        return "\n".join(lines)


_registry = ToolRegistry()
_registry.register(
    pre_visit_brief,
    scope="assignable",
    symbol="pre_visit_brief",
    allow_overwrite=True,
)
