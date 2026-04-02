"""Orders API — stubbed (nurse fulfillment removed)."""
from fastapi import APIRouter

router = APIRouter(tags=["Orders"])


@router.get("/api/visits/{visit_id}/orders")
async def list_orders(visit_id: int):
    """List orders for a visit. Stubbed — order fulfillment removed."""
    return []


@router.post("/api/visits/{visit_id}/orders")
async def create_order(visit_id: int):
    """Create an order. Stubbed — order fulfillment removed."""
    return {}
