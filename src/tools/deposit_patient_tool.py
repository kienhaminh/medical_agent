"""Deposit patient identity data into the vault and return an opaque key.

The agent collects name/DOB conversationally, then calls this tool so that
raw PII is stored in the vault — never held in the conversation context.
"""

import logging

from src.vault import VaultStore
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


def deposit_patient(
    first_name: str,
    last_name: str,
    dob: str,
    gender: str = "",
) -> str:
    """Store patient identity information in the vault.

    Call this after collecting patient details from the user. Returns an
    opaque vault key that you must pass to check_patient, compare_patient,
    or register_patient. You will NOT see the raw data again.

    Args:
        first_name: Patient's first name.
        last_name: Patient's last name.
        dob: Date of birth (YYYY-MM-DD).
        gender: Gender (optional).

    Returns:
        A vault key string (e.g. "vault_key=<uuid>").
    """
    if not first_name or not first_name.strip():
        return "Error: first_name is required."
    if not last_name or not last_name.strip():
        return "Error: last_name is required."
    if not dob or not dob.strip():
        return "Error: dob is required."

    vault = VaultStore()
    key = vault.store("patient", {
        "first_name": first_name.strip(),
        "last_name": last_name.strip(),
        "dob": dob.strip(),
        "gender": gender.strip() if gender else "",
    })
    logger.info("deposit_patient: vault_key=%s", key)
    return f"vault_key={key}"


_registry = ToolRegistry()
_registry.register(deposit_patient, scope="global", symbol="deposit_patient", allow_overwrite=True)
