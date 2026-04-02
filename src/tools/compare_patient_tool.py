"""Compare vault data against an existing patient record.

Returns a field-by-field match/mismatch report WITHOUT exposing actual values.
"""

import logging

from sqlalchemy import select

from src.vault import VaultStore
from src.models import SessionLocal
from src.models.patient import Patient
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


def compare_patient(vault_key: str, patient_id: int) -> str:
    """Compare vault data with a database patient record.

    For each field (name, dob, gender), reports whether the vault value
    matches the database value. No raw data is returned.

    Args:
        vault_key: Opaque key returned by deposit_patient.
        patient_id: ID of the patient record to compare against.

    Returns:
        A structured comparison report, e.g.:
            comparison_result. patient_id=42
            name: match
            dob: match
            gender: mismatch
    """
    vault = VaultStore()
    entry = vault.get(vault_key)
    if entry is None:
        return "Error: vault_key not found or expired."
    if entry.entry_type != "patient":
        return f"Error: vault entry is type '{entry.entry_type}', expected 'patient'."

    with SessionLocal() as db:
        patient = db.execute(
            select(Patient).where(Patient.id == patient_id)
        ).scalar_one_or_none()

    if patient is None:
        return f"Error: patient_id={patient_id} not found."

    vault_name = f"{entry.data['first_name']} {entry.data['last_name']}"

    def _cmp(vault_val: str, db_val: str | None) -> str:
        return "match" if (vault_val or "").lower() == (db_val or "").lower() else "mismatch"

    lines = [
        f"comparison_result. patient_id={patient_id}",
        f"name: {_cmp(vault_name, patient.name)}",
        f"dob: {_cmp(entry.data['dob'], patient.dob.isoformat() if patient.dob else '')}",
        f"gender: {_cmp(entry.data.get('gender', ''), patient.gender)}",
    ]

    result = "\n".join(lines)
    logger.info("compare_patient: patient_id=%s vault_key=%s", patient_id, vault_key)
    return result


_registry = ToolRegistry()
_registry.register(compare_patient, scope="global", symbol="compare_patient", allow_overwrite=True)
