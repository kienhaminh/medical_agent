"""Create order tool — allows the Doctor agent to place lab and imaging orders.

Self-registers at import time.
"""
import logging
from typing import Optional
from sqlalchemy import select

from src.models import SessionLocal, Visit
from src.models.order import Order
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


def create_order(
    patient_id: int,
    visit_id: int,
    order_type: str,
    order_name: str,
    notes: Optional[str] = None,
    ordered_by: Optional[str] = None,
) -> str:
    """Create a lab or imaging order for a patient visit.

    Args:
        patient_id: The patient's database ID
        visit_id: The visit's primary key ID
        order_type: Type of order — "lab" or "imaging"
        order_name: Name of the test or study (e.g., "CBC", "Chest X-Ray")
        notes: Optional clinical notes or special instructions
        ordered_by: Name of the ordering physician

    Returns:
        Confirmation message with order details
    """
    if order_type not in ("lab", "imaging"):
        return f"Error: order_type must be 'lab' or 'imaging', got '{order_type}'."

    with SessionLocal() as db:
        visit = db.execute(select(Visit).where(Visit.id == visit_id)).scalar_one_or_none()
        if not visit:
            return f"Error: Visit {visit_id} not found."
        if visit.patient_id != patient_id:
            return f"Error: Visit {visit_id} does not belong to patient {patient_id}."

        order = Order(
            visit_id=visit_id,
            patient_id=patient_id,
            order_type=order_type,
            order_name=order_name,
            notes=notes,
            ordered_by=ordered_by,
        )
        db.add(order)
        db.commit()
        db.refresh(order)

        logger.info("Order %d created: %s for visit %s", order.id, order_name, visit.visit_id)
        return f"Order created successfully: {order_type.upper()} — {order_name} (Order ID: {order.id}, Status: pending)."


_registry = ToolRegistry()
_registry.register(
    create_order,
    scope="assignable",
    symbol="create_order",
    allow_overwrite=True,
)
