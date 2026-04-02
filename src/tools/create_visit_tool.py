"""Built-in tool for creating a new visit record.

Called by the Reception agent after identifying or creating a patient.
Creates a Visit in INTAKE status with a linked ChatSession.
Self-registers at import time.
"""
import logging
from datetime import date

from sqlalchemy import select
from src.models import SessionLocal
from src.models.visit import Visit, VisitStatus
from src.models.patient import Patient
from src.models.chat import ChatSession
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


def create_visit(patient_id: int) -> str:
    """Create a new visit for a patient and begin the intake process.

    Call this after you have identified or created the patient record.
    This creates a visit in INTAKE status. After collecting symptoms,
    call complete_triage to finalize the routing.

    Args:
        patient_id: The patient's ID (from check_patient or register_patient)

    Returns:
        Confirmation with visit ID and instructions
    """
    with SessionLocal() as db:
        # Validate patient exists
        patient = db.execute(
            select(Patient).where(Patient.id == patient_id)
        ).scalar_one_or_none()
        if not patient:
            return f"Error: Patient with id={patient_id} not found."

        # Check for duplicate active intake
        existing = db.execute(
            select(Visit).where(
                Visit.patient_id == patient_id,
                Visit.status == VisitStatus.INTAKE.value,
            )
        ).scalar_one_or_none()
        if existing:
            return (
                f"Patient already has an active intake visit: {existing.visit_id} (ID: {existing.id}). "
                f"Continue the intake with this visit."
            )

        # Generate visit ID
        today = date.today()
        prefix = f"VIS-{today.strftime('%Y%m%d')}-"
        result = db.execute(
            select(Visit.visit_id).where(Visit.visit_id.like(f"{prefix}%"))
            .order_by(Visit.visit_id.desc()).limit(1)
        )
        last_id = result.scalar_one_or_none()
        next_num = int(last_id.split("-")[-1]) + 1 if last_id else 1
        visit_id = f"{prefix}{next_num:03d}"

        # Create chat session
        session = ChatSession(
            title=f"Intake - {visit_id}",
        )
        db.add(session)
        db.flush()

        # Create visit
        visit = Visit(
            visit_id=visit_id,
            patient_id=patient_id,
            status=VisitStatus.INTAKE.value,
            intake_session_id=session.id,
        )
        db.add(visit)
        db.commit()
        db.refresh(visit)

        logger.info("Created visit %s for patient %s", visit.visit_id, patient.name)

        return (
            f"Visit created successfully.\n"
            f"- Visit ID: {visit.visit_id}\n"
            f"- Visit DB ID: {visit.id}\n"
            f"- Patient: {patient.name}\n"
            f"- Status: intake\n"
            f"Now collect the patient's symptoms, then call complete_triage "
            f"with id={visit.id} to finalize routing."
        )


_registry = ToolRegistry()
_registry.register(
    create_visit,
    scope="global",
    symbol="create_visit",
    allow_overwrite=True,
)
