"""Medical history data fetcher — returns all raw patient clinical data for agent analysis.

Fetches records, vitals, medications, allergies, and imaging from the database
and returns them as structured text. The agent reasons over this data directly
in the main conversation — no secondary LLM call is made.

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
# Section builders — each returns "" when list is empty (section omitted)
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
    """Fetch all clinical data for a patient and return it as structured text.

    The agent analyses and reasons over this data directly — no secondary LLM
    call is made. Returns records, vitals, medications, allergies, and imaging
    as plain text sections ready for clinical reasoning.

    Args:
        patient_id: Patient's database ID (from the patient context)
        focus_area: Optional clinical domain to highlight (e.g. "cardiovascular")

    Returns:
        Raw structured patient data for the agent to analyse
    """
    with SessionLocal() as db:
        patient = db.execute(
            _entity_select(Patient).where(Patient.id == patient_id)
        ).scalar_one_or_none()

        if not patient:
            return f"Error: Patient {patient_id} not found in the database."

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

        sections = [
            f"Patient: {patient.name}, {_patient_age(patient.dob)}yo {patient.gender}",
        ]
        if focus_area:
            sections.append(f"Focus area: {focus_area}")

        for section in (
            _build_records_section(records),
            _build_vitals_section(vitals),
            _build_medications_section(medications),
            _build_allergies_section(allergies),
            _build_imaging_section(imaging),
        ):
            if section:
                sections.append(section)

        return "\n\n".join(sections)


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
