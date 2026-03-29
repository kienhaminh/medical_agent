"""Built-in tool for creating new patient records.

Called by the Reception agent when no existing patient is found.
Self-registers at import time.
"""
import logging

from src.models import SessionLocal
from src.models.patient import Patient
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


def create_patient(name: str, dob: str, gender: str) -> str:
    """Create a new patient record in the system.

    Call this after find_patient returns no matches and you have
    collected the patient's basic information.

    Args:
        name: Patient's full name
        dob: Date of birth (format: YYYY-MM-DD)
        gender: Patient's gender (e.g., 'male', 'female', 'other')

    Returns:
        Confirmation message with the new patient's ID
    """
    if not name or not name.strip():
        return "Error: Patient name is required."
    if not dob or not dob.strip():
        return "Error: Date of birth is required."
    if not gender or not gender.strip():
        return "Error: Gender is required."

    with SessionLocal() as db:
        patient = Patient(
            name=name.strip(),
            dob=dob.strip(),
            gender=gender.strip().lower(),
        )
        db.add(patient)
        db.commit()
        db.refresh(patient)

        logger.info("Created new patient: %s (ID: %d)", patient.name, patient.id)

        return (
            f"Patient created successfully.\n"
            f"- ID: {patient.id}\n"
            f"- Name: {patient.name}\n"
            f"- DOB: {patient.dob}\n"
            f"- Gender: {patient.gender}\n"
            f"Use this patient_id ({patient.id}) when creating a visit."
        )


_registry = ToolRegistry()
_registry.register(
    create_patient,
    scope="global",
    symbol="create_patient",
    allow_overwrite=True,
)
