"""Orders API — create and list lab/imaging orders for a visit."""
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import get_db, Visit
from src.models.order import Order
from ..models import OrderCreate, OrderResponse

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Orders"])


@router.post("/api/visits/{visit_id}/orders", response_model=OrderResponse)
async def create_order(
    visit_id: int,
    body: OrderCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a lab or imaging order for a visit."""
    result = await db.execute(select(Visit).where(Visit.id == visit_id))
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    order = Order(
        visit_id=visit_id,
        patient_id=visit.patient_id,
        order_type=body.order_type,
        order_name=body.order_name,
        notes=body.notes,
        ordered_by=body.ordered_by,
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)

    return OrderResponse(
        id=order.id,
        visit_id=order.visit_id,
        patient_id=order.patient_id,
        order_type=order.order_type,
        order_name=order.order_name,
        status=order.status,
        notes=order.notes,
        ordered_by=order.ordered_by,
        created_at=order.created_at.isoformat(),
    )


@router.get("/api/visits/{visit_id}/orders", response_model=list[OrderResponse])
async def list_orders(visit_id: int, db: AsyncSession = Depends(get_db)):
    """List all orders for a visit."""
    result = await db.execute(
        select(Order).where(Order.visit_id == visit_id).order_by(Order.created_at.desc())
    )
    orders = result.scalars().all()
    return [
        OrderResponse(
            id=o.id,
            visit_id=o.visit_id,
            patient_id=o.patient_id,
            order_type=o.order_type,
            order_name=o.order_name,
            status=o.status,
            notes=o.notes,
            ordered_by=o.ordered_by,
            created_at=o.created_at.isoformat(),
        )
        for o in orders
    ]
