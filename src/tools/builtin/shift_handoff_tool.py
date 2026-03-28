"""Shift handoff tool — generates a structured handoff document for all active patients.

Queries all in-department visits, assembles patient summaries, and uses the LLM
to format a handoff brief for the incoming doctor.
"""
import logging
from typing import Optional
from sqlalchemy import select

from src.models import SessionLocal, Visit, Patient
from src.models.order import Order
from src.models.visit import VisitStatus
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

HANDOFF_PROMPT = """You are generating a clinical shift handoff document. Based on the patient data below, create a structured handoff for the incoming doctor.

Format each patient as:
**[Patient Name]** — Visit {visit_id} | {department}
- Chief Complaint: {complaint}
- Status/Plan: [brief status and outstanding items]
- Pending: [any pending orders, results, or actions]
- Priority: [Routine/Urgent/Critical]

Patient Data:
{patient_data}

Write a concise, clinical handoff. Prioritize critical/urgent patients first."""


def _call_llm(prompt: str) -> str:
    from src.api.dependencies import llm_provider
    response = llm_provider.llm.invoke(prompt)
    return response.content if hasattr(response, "content") else str(response)


def generate_shift_handoff(department: Optional[str] = None) -> str:
    """Generate a shift handoff document for all active in-department patients.

    Args:
        department: Optional — filter to a specific department. If None, includes all.

    Returns:
        Formatted handoff document as markdown string
    """
    with SessionLocal() as db:
        query = select(Visit, Patient).join(
            Patient, Visit.patient_id == Patient.id
        ).where(Visit.status == VisitStatus.IN_DEPARTMENT.value)

        if department:
            query = query.where(Visit.current_department == department)

        rows = db.execute(query).all()

        if not rows:
            return "No active patients in department at time of handoff."

        patient_sections = []
        for visit, patient in rows:
            # Fetch pending orders
            pending_orders = db.execute(
                select(Order).where(
                    Order.visit_id == visit.id,
                    Order.status == "pending"
                )
            ).scalars().all()

            orders_str = ", ".join(o.order_name for o in pending_orders) if pending_orders else "None"
            section = (
                f"Patient: {patient.name} ({patient.dob}, {patient.gender})\n"
                f"Visit: {visit.visit_id} | Department: {visit.current_department or 'Unknown'}\n"
                f"Chief Complaint: {visit.chief_complaint or 'Not recorded'}\n"
                f"Urgency: {visit.urgency_level or 'routine'}\n"
                f"Clinical Notes: {(visit.clinical_notes or 'None')[:300]}\n"
                f"Pending Orders: {orders_str}"
            )
            patient_sections.append(section)

        prompt = HANDOFF_PROMPT.format(patient_data="\n\n".join(patient_sections))

        try:
            return _call_llm(prompt)
        except Exception as e:
            logger.error("Shift handoff LLM call failed: %s", e)
            # Fallback: return raw data without LLM formatting
            return "# Shift Handoff\n\n" + "\n\n---\n\n".join(patient_sections)


_registry = ToolRegistry()
_registry.register(
    generate_shift_handoff,
    scope="assignable",
    symbol="generate_shift_handoff",
    allow_overwrite=True,
)
