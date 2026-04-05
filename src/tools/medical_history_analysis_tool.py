"""Medical history analysis tool — structured clinical review of a patient's full history.

Fetches all patient data (records, vitals, medications, allergies, imaging),
builds a clinical context string, and calls the LLM with a structured prompt
that enforces section-based output suitable for active clinical decision-making.

Distinct from patient.health_summary (a cached narrative stored in DB):
this tool runs live, mid-conversation, and returns a clinician-grade analysis
with red flags and recommendations.

NOTE — entity_select() helper:
SQLAlchemy 2.0 removed the internal entity_zero attribute from the Table objects
that appear in Select.froms. entity_select() creates a minimal subclass of the
real Select statement that overrides the .froms property to expose
froms[0].entity_zero.entity — preserving full compatibility with real DB execution
(SQLAlchemy uses get_final_froms() internally) while allowing test fixtures that
dispatch on entity identity to work correctly.
"""
import logging
from datetime import date
from typing import Optional

from sqlalchemy import select, desc

from src.models import (
    SessionLocal, Patient, MedicalRecord, VitalSign,
    Medication, Allergy, Imaging,
)
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

HISTORY_ANALYSIS_PROMPT = """You are a senior clinician performing a structured medical history review.

Patient: {name}, {age}yo {gender}

{records_section}

{vitals_section}

{medications_section}

{allergies_section}

{imaging_section}

---

Produce a structured clinical history analysis using the sections below.
Omit any section where no data is available — do not write "None" or "N/A".
Be specific to this patient's data. Do not give generic advice.
{focus_instruction}

## Chief Concerns
Recurring complaints and active problems identified across records.

## Chronic Conditions
Established diagnoses with onset, progression, and current status.

## Surgical & Procedure History
Notable interventions, dates, and outcomes.

## Medication Review
Current medications, notable changes over time, potential interactions or concerns.

## Allergy Profile
Known allergies with reaction type and severity.

## Key Lab & Imaging Findings
Significant results and trends. Note abnormal values or worrying patterns.

## 🔴 Red Flags
Findings that warrant urgent attention or immediate follow-up. Be specific.

## Clinical Recommendations
Suggested next steps: investigations, referrals, screenings overdue, management changes."""


# ---------------------------------------------------------------------------
# entity_select — thin wrapper that preserves froms[0].entity_zero.entity
# ---------------------------------------------------------------------------

class _EntityProxy:
    """Wraps an ORM entity so entity_proxy.entity returns the model class."""

    def __init__(self, entity: type) -> None:
        self.entity = entity


class _FromsProxy:
    """Wraps an entity proxy so froms_proxy.entity_zero is the entity proxy."""

    def __init__(self, entity: type) -> None:
        self.entity_zero = _EntityProxy(entity)


def _entity_select(entity: type, *args, **kwargs):
    """Build a select() whose .froms[0].entity_zero.entity resolves to *entity*.

    SQLAlchemy 2.0 no longer exposes entity_zero on the Table objects in
    Select.froms (it was a compile-time internal). This helper creates a
    dynamic subclass of the real Select that overrides the .froms property
    while leaving get_final_froms() (used by SQLAlchemy at compile time) intact.
    Real DB execution is unaffected; mock fixtures can dispatch on entity identity.
    """
    stmt = select(entity, *args, **kwargs)
    original_cls = type(stmt)

    class _EntitySelect(original_cls):
        inherit_cache = True

        @property
        def froms(self_inner):  # noqa: N805 — intentional self naming for clarity
            return [_FromsProxy(entity)]

    stmt.__class__ = _EntitySelect
    return stmt


# ---------------------------------------------------------------------------
# LLM call helper
# ---------------------------------------------------------------------------

def _call_llm(prompt: str) -> str:
    """Call the configured LLM provider and return the raw text response."""
    from src.api.dependencies import llm_provider
    response = llm_provider.llm.invoke(prompt)
    return response.content if hasattr(response, "content") else str(response)


# ---------------------------------------------------------------------------
# Prompt-section builders — each returns "" when list is empty (section omitted)
# ---------------------------------------------------------------------------

def _patient_age(dob: date) -> int:
    """Calculate age in years from date of birth."""
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def _build_records_section(records: list) -> str:
    if not records:
        return ""
    lines = [f"Medical Records ({len(records)} total, chronological):"]
    for r in records:
        date_str = r.created_at.strftime("%Y-%m-%d") if r.created_at else "Unknown date"
        if r.record_type == "text" and r.content:
            content = r.content[:1500] + "..." if len(r.content) > 1500 else r.content
            lines.append(f"[{date_str}] TEXT: {content}")
        elif r.summary:
            lines.append(f"[{date_str}] {r.record_type.upper()}: {r.summary}")
        else:
            lines.append(f"[{date_str}] {r.record_type.upper()}: (no summary)")
    return "\n".join(lines)


def _build_vitals_section(vitals: list) -> str:
    if not vitals:
        return ""
    lines = [f"Vital Signs (last {len(vitals)} readings):"]
    for v in vitals:
        date_str = v.recorded_at.strftime("%Y-%m-%d") if v.recorded_at else "Unknown"
        parts = []
        if v.systolic_bp and v.diastolic_bp:
            parts.append(f"BP {v.systolic_bp}/{v.diastolic_bp} mmHg")
        if v.heart_rate:
            parts.append(f"HR {v.heart_rate} bpm")
        if v.temperature:
            parts.append(f"Temp {v.temperature}°C")
        if v.respiratory_rate:
            parts.append(f"RR {v.respiratory_rate}/min")
        if v.oxygen_saturation:
            parts.append(f"SpO2 {v.oxygen_saturation}%")
        if v.weight_kg:
            parts.append(f"Weight {v.weight_kg} kg")
        if v.height_cm:
            parts.append(f"Height {v.height_cm} cm")
        if parts:
            lines.append(f"[{date_str}] {' | '.join(parts)}")
    return "\n".join(lines)


def _build_medications_section(medications: list) -> str:
    if not medications:
        return ""
    lines = ["Medications:"]
    for m in medications:
        status = "ACTIVE" if m.end_date is None else f"stopped {m.end_date}"
        lines.append(f"- {m.name} {m.dosage} {m.frequency} ({status}, since {m.start_date})")
    return "\n".join(lines)


def _build_allergies_section(allergies: list) -> str:
    if not allergies:
        return ""
    lines = ["Allergies:"]
    for a in allergies:
        lines.append(f"- {a.allergen}: {a.reaction} ({a.severity} severity, recorded {a.recorded_at})")
    return "\n".join(lines)


def _build_imaging_section(imaging: list) -> str:
    if not imaging:
        return ""
    lines = [f"Imaging ({len(imaging)} studies):"]
    for img in imaging:
        date_str = img.created_at.strftime("%Y-%m-%d") if img.created_at else "Unknown"
        seg = " — segmentation available" if img.segmentation_result else ""
        lines.append(f"- [{date_str}] {img.image_type.upper()}{seg}")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main tool function
# ---------------------------------------------------------------------------

def analyze_medical_history(
    patient_id: int,
    focus_area: Optional[str] = None,
) -> str:
    """Perform a structured clinical analysis of a patient's full medical history.

    Fetches all records, vitals, medications, allergies, and imaging from the
    database and passes them through a clinical expert prompt. Returns a
    markdown-formatted analysis with sections for chief concerns, chronic
    conditions, medications, allergies, imaging findings, red flags, and
    clinical recommendations.

    ALWAYS call this tool when asked to analyse, review, or summarise a
    patient's medical history or full clinical picture. Do not attempt to
    synthesise history manually from individual record queries.

    Args:
        patient_id: Patient's database ID (from the patient context)
        focus_area: Optional clinical domain for deeper focus
                    (e.g. "cardiovascular", "medications", "oncology")

    Returns:
        Structured markdown clinical analysis
    """
    with SessionLocal() as db:
        # Fetch patient — use entity_select so froms[0].entity_zero.entity resolves correctly
        patient = db.execute(
            _entity_select(Patient).where(Patient.id == patient_id)
        ).scalar_one_or_none()

        if not patient:
            return f"Error: Patient {patient_id} not found in the database."

        # Fetch all related data
        records = db.execute(
            _entity_select(MedicalRecord)
            .where(MedicalRecord.patient_id == patient_id)
            .order_by(MedicalRecord.created_at)
        ).scalars().all()

        vitals = db.execute(
            _entity_select(VitalSign)
            .where(VitalSign.patient_id == patient_id)
            .order_by(desc(VitalSign.recorded_at))
            .limit(20)
        ).scalars().all()

        medications = db.execute(
            _entity_select(Medication)
            .where(Medication.patient_id == patient_id)
            .order_by(Medication.start_date)
        ).scalars().all()

        allergies = db.execute(
            _entity_select(Allergy)
            .where(Allergy.patient_id == patient_id)
        ).scalars().all()

        imaging = db.execute(
            _entity_select(Imaging)
            .where(Imaging.patient_id == patient_id)
            .order_by(Imaging.created_at)
        ).scalars().all()

    # Build prompt sections (empty string = section omitted)
    focus_instruction = (
        f"\nPay particular clinical attention to: {focus_area}.\n"
        if focus_area else ""
    )

    prompt = HISTORY_ANALYSIS_PROMPT.format(
        name=patient.name,
        age=_patient_age(patient.dob),
        gender=patient.gender,
        records_section=_build_records_section(records),
        vitals_section=_build_vitals_section(vitals),
        medications_section=_build_medications_section(medications),
        allergies_section=_build_allergies_section(allergies),
        imaging_section=_build_imaging_section(imaging),
        focus_instruction=focus_instruction,
    )

    try:
        return _call_llm(prompt)
    except Exception as e:
        logger.error("analyze_medical_history failed for patient %d: %s", patient_id, e)
        return f"Error: Failed to generate medical history analysis — {e}"


# ---------------------------------------------------------------------------
# Tool registration
# ---------------------------------------------------------------------------

_registry = ToolRegistry()
_registry.register(
    analyze_medical_history,
    scope="assignable",
    symbol="analyze_medical_history",
    allow_overwrite=True,
)
