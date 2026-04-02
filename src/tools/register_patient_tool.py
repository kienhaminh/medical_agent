"""Create a new patient record from vault data.

Reads identity fields from the vault and writes them to the Patient table.
Returns only the new patient_id — no PII exposed to the agent.
"""

import logging
from datetime import date as _date

from src.vault import VaultStore
from src.models import SessionLocal
from src.models.patient import Patient
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


def register_patient(vault_key: str) -> str:
    """Create a new patient record using data stored in the vault.

    Call this after check_patient returns "patient_not_found". The tool
    reads identity fields from the vault entry and inserts a Patient row.

    Args:
        vault_key: Opaque key returned by deposit_patient.

    Returns:
        "patient_created. patient_id=<id>" on success, or "Error: ...".
    """
    vault = VaultStore()
    entry = vault.get(vault_key)
    if entry is None:
        return "Error: vault_key not found or expired."
    if entry.entry_type != "patient":
        return f"Error: vault entry is type '{entry.entry_type}', expected 'patient'."

    full_name = f"{entry.data['first_name']} {entry.data['last_name']}"
    dob = _date.fromisoformat(entry.data["dob"])
    gender = entry.data.get("gender", "")

    with SessionLocal() as db:
        patient = Patient(
            name=full_name,
            dob=dob,
            gender=gender.lower() if gender else "",
        )
        db.add(patient)
        db.commit()
        db.refresh(patient)

    logger.info("register_patient: created patient_id=%s (vault_key=%s)", patient.id, vault_key)
    return f"patient_created. patient_id={patient.id}"


_registry = ToolRegistry()
_registry.register(register_patient, scope="global", symbol="register_patient", allow_overwrite=True)
