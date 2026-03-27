"""Built-in tool for saving clinical notes during doctor consultations.

Called by the Doctor agent to persist clinical notes linked to a patient visit.
Self-registers at import time.
"""
import logging
from typing import Optional
from sqlalchemy import select

from src.models import SessionLocal
from src.models.visit import Visit
from src.models.medical_record import MedicalRecord
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


def save_clinical_note(
    patient_id: int,
    visit_id: int,
    note_content: str,
    note_title: Optional[str] = None,
) -> str:
    """Save clinical notes for a patient visit.

    Persists notes both on the visit record (clinical_notes field) and as a
    new MedicalRecord entry linked to the patient for permanent history.

    Args:
        patient_id: The patient's database ID
        visit_id: The visit's primary key ID
        note_content: The clinical note text (SOAP format recommended)
        note_title: Optional title for the medical record entry (defaults to "Clinical Note - Visit {visit_id}")

    Returns:
        Confirmation message with record details
    """
    with SessionLocal() as db:
        visit = db.execute(
            select(Visit).where(Visit.id == visit_id)
        ).scalar_one_or_none()

        if not visit:
            return f"Error: Visit with id={visit_id} not found."

        if visit.patient_id != patient_id:
            return f"Error: Visit {visit_id} does not belong to patient {patient_id}."

        # Update visit clinical notes
        visit.clinical_notes = note_content

        # Create a medical record entry for permanent history
        title = note_title or f"Clinical Note - Visit {visit.visit_id}"
        record = MedicalRecord(
            patient_id=patient_id,
            record_type="text",
            content=note_content,
            summary=f"{title}: {note_content[:200]}..." if len(note_content) > 200 else f"{title}: {note_content}",
        )
        db.add(record)
        db.commit()

        logger.info("Clinical note saved for visit %s, patient %d", visit.visit_id, patient_id)
        return f"Clinical note saved successfully. Medical record created: '{title}'."


_registry = ToolRegistry()
_registry.register(
    save_clinical_note,
    scope="assignable",
    symbol="save_clinical_note",
    allow_overwrite=True,
)
