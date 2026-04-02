"""Check whether a patient exists in the database using a vault key.

Queries the Patient table by name + DOB from the vault entry. Returns only
status and patient_id — never raw PII.
"""

import logging

from sqlalchemy import select, func

from src.vault import VaultStore
from src.models import SessionLocal
from src.models.patient import Patient
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


def check_patient(vault_key: str) -> str:
    """Check if a patient matching the vault data already exists.

    Uses the name and date of birth stored under the given vault key to
    search the patient database. Returns whether a match was found and
    the patient_id if exactly one match exists.

    Args:
        vault_key: Opaque key returned by deposit_patient.

    Returns:
        One of:
        - "patient_found. patient_id=<id>"
        - "multiple_patients_found. count=<n>"
        - "patient_not_found"
        - "Error: ..."
    """
    vault = VaultStore()
    entry = vault.get(vault_key)
    if entry is None:
        return "Error: vault_key not found or expired."
    if entry.entry_type != "patient":
        return f"Error: vault entry is type '{entry.entry_type}', expected 'patient'."

    full_name = f"{entry.data['first_name']} {entry.data['last_name']}"
    dob = entry.data["dob"]

    with SessionLocal() as db:
        query = (
            select(Patient)
            .where(func.lower(Patient.name) == full_name.lower())
            .where(Patient.dob == dob)
        )
        results = db.execute(query).scalars().all()

    if len(results) == 0:
        logger.info("check_patient: not found (vault_key=%s)", vault_key)
        return "patient_not_found"
    if len(results) == 1:
        pid = results[0].id
        logger.info("check_patient: found patient_id=%s (vault_key=%s)", pid, vault_key)
        return f"patient_found. patient_id={pid}"

    logger.info("check_patient: multiple matches count=%d (vault_key=%s)", len(results), vault_key)
    return f"multiple_patients_found. count={len(results)}"


_registry = ToolRegistry()
_registry.register(check_patient, scope="global", symbol="check_patient", allow_overwrite=True)
