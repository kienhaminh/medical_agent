"""Privacy vault — saves intake PII to the database and returns opaque IDs."""
import json
import uuid
import logging
from typing import Optional
from sqlalchemy import select

from src.models.base import AsyncSessionLocal
from src.models.patient import Patient
from src.models.intake_submission import IntakeSubmission

logger = logging.getLogger(__name__)

# Columns that exist on IntakeSubmission as dedicated fields.
_KNOWN_COLUMNS: set[str] = {
    "first_name", "last_name", "dob", "gender",
    "phone", "email", "address",
    "chief_complaint", "symptoms",
    "insurance_provider", "policy_id",
    "emergency_contact_name", "emergency_contact_relationship",
    "emergency_contact_phone",
}


async def identify_patient(answers: dict[str, str]) -> tuple[Optional[int], bool]:
    """Look up a patient by name + DOB. Create if not found.

    Returns:
        (patient_id, is_new) — patient_id is always set, is_new is True if just created.
    """
    required = {"first_name", "last_name", "dob", "gender"}
    missing = required - answers.keys()
    if missing:
        raise ValueError(f"identify_patient: missing required fields: {sorted(missing)}")

    full_name = f"{answers['first_name'].strip()} {answers['last_name'].strip()}"
    dob = answers["dob"].strip()
    gender = answers["gender"].strip()

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Patient).where(Patient.name == full_name, Patient.dob == dob)
        )
        patient = result.scalar_one_or_none()

        if patient is not None:
            logger.info("identify_patient: found existing patient_id=%s", patient.id)
            return patient.id, False

        patient = Patient(name=full_name, dob=dob, gender=gender)
        db.add(patient)
        await db.commit()
        await db.refresh(patient)
        logger.info("identify_patient: created new patient_id=%s", patient.id)
        return patient.id, True


async def save_intake(answers: dict[str, str], patient_id: int | None = None) -> tuple[int, str]:
    """Persist patient intake answers and return (patient_id, intake_id).

    If ``patient_id`` is supplied the Patient row is fetched directly by PK,
    skipping the name+dob lookup.  This avoids a redundant query when the
    caller already ran ``identify_patient``.

    Args:
        answers: Dict of field_name -> value from the intake form.
        patient_id: If already known, skip patient lookup/creation.

    Returns:
        (patient_id, intake_id) — opaque identifiers, no PII exposed to caller.

    Raises:
        ValueError: If required fields are missing and no patient_id given.
    """
    async with AsyncSessionLocal() as db:
        if patient_id is not None:
            # Fast path — patient already identified.
            result = await db.execute(
                select(Patient).where(Patient.id == patient_id)
            )
            patient = result.scalar_one_or_none()
            if patient is None:
                raise ValueError(f"save_intake: patient_id={patient_id} not found")
        else:
            # Legacy path — resolve patient from identity fields.
            required = {"first_name", "last_name", "dob", "gender"}
            missing = required - answers.keys()
            if missing:
                raise ValueError(f"save_intake: missing required fields: {sorted(missing)}")

            full_name = f"{answers['first_name'].strip()} {answers['last_name'].strip()}"
            dob = answers["dob"].strip()
            gender = answers["gender"].strip()

            result = await db.execute(
                select(Patient).where(Patient.name == full_name, Patient.dob == dob)
            )
            patient = result.scalar_one_or_none()

            if patient is None:
                patient = Patient(name=full_name, dob=dob, gender=gender)
                db.add(patient)
                await db.flush()

        def _get(key: str) -> str:
            return answers.get(key, "").strip()

        # Resolve identity fields — prefer answers, fall back to Patient row.
        first_name = _get("first_name") or (patient.name.split(" ", 1)[0] if patient.name else "")
        last_name = _get("last_name") or (patient.name.split(" ", 1)[-1] if patient.name else "")
        dob_val = _get("dob") or (patient.dob if patient.dob else "")
        gender_val = _get("gender") or (patient.gender if patient.gender else "")

        # Collect extra fields not mapped to dedicated columns.
        extra = {k: v for k, v in answers.items() if k not in _KNOWN_COLUMNS}

        submission = IntakeSubmission(
            id=str(uuid.uuid4()),
            patient_id=patient.id,
            first_name=first_name,
            last_name=last_name,
            dob=dob_val,
            gender=gender_val,
            phone=_get("phone"),
            email=_get("email"),
            address=_get("address"),
            chief_complaint=_get("chief_complaint"),
            symptoms=_get("symptoms") or None,
            insurance_provider=_get("insurance_provider"),
            policy_id=_get("policy_id"),
            emergency_contact_name=_get("emergency_contact_name"),
            emergency_contact_relationship=_get("emergency_contact_relationship"),
            emergency_contact_phone=_get("emergency_contact_phone"),
            extra_data=json.dumps(extra) if extra else None,
        )
        db.add(submission)
        await db.commit()
        await db.refresh(submission)

        logger.info(
            "Intake saved: patient_id=%s intake_id=%s",
            patient.id,
            submission.id,
        )
        return patient.id, submission.id
