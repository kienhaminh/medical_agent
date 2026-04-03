"""Rooms API — clinical exam rooms grouped by department."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.models import RoomCreate, RoomAssign, RoomResponse
from src.models.base import get_db
from src.models.patient import Patient
from src.models.room import Room
from src.models.visit import Visit

router = APIRouter(prefix="/api/rooms", tags=["Rooms"])


async def _build_response(room: Room, db: AsyncSession) -> RoomResponse:
    """Build RoomResponse, joining patient name from visit if occupied."""
    patient_name = None
    if room.current_visit_id is not None:
        result = await db.execute(
            select(Patient.name)
            .join(Visit, Visit.patient_id == Patient.id)
            .where(Visit.id == room.current_visit_id)
        )
        patient_name = result.scalar_one_or_none()
    return RoomResponse(
        id=room.id,
        room_number=room.room_number,
        department_name=room.department_name,
        current_visit_id=room.current_visit_id,
        patient_name=patient_name,
    )


@router.get("", response_model=list[RoomResponse])
async def list_rooms(db: AsyncSession = Depends(get_db)):
    """List all rooms with current occupancy."""
    result = await db.execute(select(Room).order_by(Room.room_number))
    rooms = result.scalars().all()
    return [await _build_response(r, db) for r in rooms]


@router.post("", response_model=RoomResponse, status_code=201)
async def create_room(body: RoomCreate, db: AsyncSession = Depends(get_db)):
    """Create a new clinical room."""
    existing = await db.execute(select(Room).where(Room.room_number == body.room_number))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Room '{body.room_number}' already exists")
    room = Room(room_number=body.room_number, department_name=body.department_name)
    db.add(room)
    await db.commit()
    await db.refresh(room)
    return await _build_response(room, db)


@router.patch("/{room_number}", response_model=RoomResponse)
async def assign_room(room_number: str, body: RoomAssign, db: AsyncSession = Depends(get_db)):
    """Assign or unassign a visit to a room."""
    result = await db.execute(select(Room).where(Room.room_number == room_number))
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail=f"Room '{room_number}' not found")
    room.current_visit_id = body.current_visit_id
    await db.commit()
    await db.refresh(room)
    return await _build_response(room, db)
