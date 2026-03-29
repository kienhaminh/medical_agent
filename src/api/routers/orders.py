"""Orders API — create, list, claim, and complete lab/imaging orders."""
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import get_db, Visit
from src.models.order import Order, OrderStatus
from src.models.patient import Patient
from ..models import (
    OrderCreate,
    OrderResponse,
    OrderListItem,
    ClaimOrderRequest,
    CompleteOrderRequest,
)
from src.api.ws.event_bus import event_bus
from src.api.ws.events import WSEventType

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Orders"])


def _order_to_response(o: Order) -> OrderResponse:
    return OrderResponse(
        id=o.id,
        visit_id=o.visit_id,
        patient_id=o.patient_id,
        order_type=o.order_type,
        order_name=o.order_name,
        status=o.status,
        notes=o.notes,
        ordered_by=o.ordered_by,
        result_notes=o.result_notes,
        fulfilled_by=o.fulfilled_by,
        created_at=o.created_at.isoformat(),
        updated_at=o.updated_at.isoformat(),
    )


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

    # Emit real-time event to department room
    if visit.current_department:
        await event_bus.emit_to_room(
            visit.current_department,
            WSEventType.ORDER_CREATED,
            {
                "order_id": order.id,
                "visit_id": order.visit_id,
                "patient_id": order.patient_id,
                "order_type": order.order_type,
                "order_name": order.order_name,
                "status": order.status,
                "notes": order.notes,
                "ordered_by": order.ordered_by,
            },
        )

    return _order_to_response(order)


@router.get("/api/visits/{visit_id}/orders", response_model=list[OrderResponse])
async def list_orders(visit_id: int, db: AsyncSession = Depends(get_db)):
    """List all orders for a visit."""
    result = await db.execute(
        select(Order).where(Order.visit_id == visit_id).order_by(Order.created_at.desc())
    )
    return [_order_to_response(o) for o in result.scalars().all()]


@router.get("/api/orders", response_model=list[OrderListItem])
async def list_all_orders(
    status: Optional[str] = Query(None, description="Filter by status"),
    order_type: Optional[str] = Query(None, description="Filter by type: lab or imaging"),
    db: AsyncSession = Depends(get_db),
):
    """List all orders across all visits — used by nurses for the fulfillment queue."""
    stmt = (
        select(Order, Patient.name.label("patient_name"), Visit.visit_id.label("visit_ref"))
        .join(Patient, Order.patient_id == Patient.id)
        .join(Visit, Order.visit_id == Visit.id)
        .order_by(Order.created_at.asc())
    )
    if status:
        stmt = stmt.where(Order.status == status)
    if order_type:
        stmt = stmt.where(Order.order_type == order_type)

    result = await db.execute(stmt)
    rows = result.all()
    return [
        OrderListItem(
            id=o.id,
            visit_id=o.visit_id,
            patient_id=o.patient_id,
            order_type=o.order_type,
            order_name=o.order_name,
            status=o.status,
            notes=o.notes,
            ordered_by=o.ordered_by,
            result_notes=o.result_notes,
            fulfilled_by=o.fulfilled_by,
            created_at=o.created_at.isoformat(),
            updated_at=o.updated_at.isoformat(),
            patient_name=patient_name,
            visit_ref=visit_ref,
        )
        for o, patient_name, visit_ref in rows
    ]


@router.patch("/api/orders/{order_id}/claim", response_model=OrderResponse)
async def claim_order(
    order_id: int,
    body: ClaimOrderRequest,
    db: AsyncSession = Depends(get_db),
):
    """Claim a pending order — transitions status to in_progress."""
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != OrderStatus.PENDING.value:
        raise HTTPException(status_code=400, detail="Order is not pending")

    order.status = OrderStatus.IN_PROGRESS.value
    order.fulfilled_by = body.fulfilled_by
    await db.commit()
    await db.refresh(order)

    # Resolve patient name and department for the event
    visit_result = await db.execute(
        select(Visit, Patient.name.label("patient_name"))
        .join(Patient, Visit.patient_id == Patient.id)
        .where(Visit.id == order.visit_id)
    )
    row = visit_result.first()
    dept = row[0].current_department if row else None
    patient_name = row[1] if row else "Unknown"

    if dept:
        await event_bus.emit_to_room(
            dept,
            WSEventType.ORDER_CLAIMED,
            {
                "order_id": order.id,
                "order_name": order.order_name,
                "fulfilled_by": order.fulfilled_by,
                "status": order.status,
                "patient_name": patient_name,
            },
        )

    return _order_to_response(order)


@router.patch("/api/orders/{order_id}/complete", response_model=OrderResponse)
async def complete_order(
    order_id: int,
    body: CompleteOrderRequest,
    db: AsyncSession = Depends(get_db),
):
    """Complete an in-progress order and attach result notes."""
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != OrderStatus.IN_PROGRESS.value:
        raise HTTPException(status_code=400, detail="Order must be in_progress to complete")

    order.status = OrderStatus.COMPLETED.value
    order.result_notes = body.result_notes
    order.fulfilled_by = body.fulfilled_by
    await db.commit()
    await db.refresh(order)

    # Resolve patient name and department for the event
    visit_result = await db.execute(
        select(Visit, Patient.name.label("patient_name"))
        .join(Patient, Visit.patient_id == Patient.id)
        .where(Visit.id == order.visit_id)
    )
    row = visit_result.first()
    dept = row[0].current_department if row else None
    patient_name = row[1] if row else "Unknown"

    if dept:
        await event_bus.emit_to_room(
            dept,
            WSEventType.ORDER_COMPLETED,
            {
                "order_id": order.id,
                "order_name": order.order_name,
                "result_notes": order.result_notes,
                "fulfilled_by": order.fulfilled_by,
                "status": order.status,
                "patient_name": patient_name,
            },
        )

    return _order_to_response(order)
