"""Built-in tool for searching patient records.

Called by the Reception agent to find existing patients by name/DOB.
Self-registers at import time.
"""
import logging
from typing import Optional

from sqlalchemy import select, func
from src.models import SessionLocal
from src.models.patient import Patient
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


def find_patient(name: str, dob: Optional[str] = None) -> str:
    """Search for existing patients by name and optionally date of birth.

    Call this to check if a patient already exists in the system before
    creating a new record.

    Args:
        name: Patient name to search for (case-insensitive partial match)
        dob: Date of birth to filter by (format: YYYY-MM-DD), optional

    Returns:
        Formatted list of matching patients, or a message if none found
    """
    with SessionLocal() as db:
        query = select(Patient).where(
            func.lower(Patient.name).contains(name.lower())
        )
        if dob:
            query = query.where(Patient.dob == dob)

        query = query.limit(10)
        results = db.execute(query).scalars().all()

        if not results:
            return f"No patients found matching name='{name}'" + (
                f" and dob='{dob}'" if dob else ""
            ) + ". You may need to create a new patient record."

        lines = [f"Found {len(results)} patient(s):"]
        for p in results:
            lines.append(f"- ID: {p.id}, Name: {p.name}, DOB: {p.dob}, Gender: {p.gender}")
        return "\n".join(lines)


_registry = ToolRegistry()
_registry.register(
    find_patient,
    scope="assignable",
    symbol="find_patient",
    allow_overwrite=True,
)
