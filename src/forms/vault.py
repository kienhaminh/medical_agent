"""Privacy vault — saves intake PII to the database and returns opaque IDs."""
import uuid
import logging
from sqlalchemy import select

from src.models.base import AsyncSessionLocal
from src.models.patient import Patient
from src.models.intake_submission import IntakeSubmission

logger = logging.getLogger(__name__)


async def save_intake(answers: dict[str, str]) -> tuple[int, str]:
    """Persist patient intake answers and return (patient_id, intake_id).

    Looks up an existing Patient by (name, dob).
    Creates a new Patient if none is found.
    Always creates a new IntakeSubmission row with the opaque ID.

    Args:
        answers: Dict of field_name -> value from the intake form.

    Returns:
        (patient_id, intake_id) — opaque identifiers, no PII exposed to caller.

    Raises:
        ValueError: If required fields are missing from answers.

    Note:
        This function is not safe for concurrent calls with identical (name, dob) pairs.
        A unique constraint migration should be added before production rollout.
    """
    required = {"first_name", "last_name", "dob", "gender"}
    missing = required - answers.keys()
    if missing:
        raise ValueError(f"save_intake: missing required fields: {sorted(missing)}")

    full_name = f"{answers['first_name'].strip()} {answers['last_name'].strip()}"
    dob = answers["dob"].strip()
    gender = answers["gender"].strip()

    async with AsyncSessionLocal() as db:
        # Look up existing patient by name + dob
        result = await db.execute(
            select(Patient).where(
                Patient.name == full_name,
                Patient.dob == dob,
            )
        )
        patient = result.scalar_one_or_none()

        if patient is None:
            patient = Patient(name=full_name, dob=dob, gender=gender)
            db.add(patient)
            await db.flush()  # get patient.id before creating submission

        submission = IntakeSubmission(
            id=str(uuid.uuid4()),
            patient_id=patient.id,
            first_name=answers["first_name"].strip(),
            last_name=answers["last_name"].strip(),
            dob=dob,
            gender=gender,
            phone=answers.get("phone", "").strip(),
            email=answers.get("email", "").strip(),
            address=answers.get("address", "").strip(),
            chief_complaint=answers.get("chief_complaint", "").strip(),
            symptoms=answers.get("symptoms", "").strip() or None,
            insurance_provider=answers.get("insurance_provider", "").strip(),
            policy_id=answers.get("policy_id", "").strip(),
            emergency_contact_name=answers.get("emergency_contact_name", "").strip(),
            emergency_contact_relationship=answers.get("emergency_contact_relationship", "").strip(),
            emergency_contact_phone=answers.get("emergency_contact_phone", "").strip(),
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
