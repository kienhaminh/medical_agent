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


# _build_response is used by create_room and assign_room (single-room endpoints).
# list_rooms uses its own inline batch join to avoid N+1 queries.
async def _build_response(room: Room, db: AsyncSession) -> RoomResponse:
    """Build RoomResponse, joining patient name and visit info if occupied."""
    patient_name = None
    chief_complaint = None
    checked_in_at = None
    if room.current_visit_id is not None:
        result = await db.execute(
            select(Patient.name, Visit.chief_complaint, Visit.created_at)
            .join(Visit, Visit.patient_id == Patient.id)
            .where(Visit.id == room.current_visit_id)
        )
        row = result.one_or_none()
        if row:
            patient_name, chief_complaint, checked_in_at_dt = row
            checked_in_at = checked_in_at_dt.isoformat() if checked_in_at_dt else None
    return RoomResponse(
        id=room.id,
        room_number=room.room_number,
        department_name=room.department_name,
        current_visit_id=room.current_visit_id,
        patient_name=patient_name,
        chief_complaint=chief_complaint,
        checked_in_at=checked_in_at,
    )


@router.get("", response_model=list[RoomResponse])
async def list_rooms(db: AsyncSession = Depends(get_db)):
    """List all rooms with current occupancy."""
    result = await db.execute(select(Room).order_by(Room.room_number))
    rooms = result.scalars().all()

    # Batch-fetch patient name, complaint, and check-in time for occupied rooms
    occupied_ids = [r.current_visit_id for r in rooms if r.current_visit_id is not None]
    visit_map: dict[int, tuple[str, str | None, str | None]] = {}
    if occupied_ids:
        rows = await db.execute(
            select(Visit.id, Patient.name, Visit.chief_complaint, Visit.created_at)
            .join(Patient, Patient.id == Visit.patient_id)
            .where(Visit.id.in_(occupied_ids))
        )
        for visit_id, name, complaint, created_at_dt in rows.all():
            visit_map[visit_id] = (
                name,
                complaint,
                created_at_dt.isoformat() if created_at_dt else None,
            )

    return [
        RoomResponse(
            id=r.id,
            room_number=r.room_number,
            department_name=r.department_name,
            current_visit_id=r.current_visit_id,
            patient_name=visit_map[r.current_visit_id][0] if r.current_visit_id in visit_map else None,
            chief_complaint=visit_map[r.current_visit_id][1] if r.current_visit_id in visit_map else None,
            checked_in_at=visit_map[r.current_visit_id][2] if r.current_visit_id in visit_map else None,
        )
        for r in rooms
    ]


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
    if body.current_visit_id is not None:
        visit_check = await db.execute(select(Visit.id).where(Visit.id == body.current_visit_id))
        if visit_check.scalar_one_or_none() is None:
            raise HTTPException(status_code=404, detail=f"Visit '{body.current_visit_id}' not found")
        # Guard against the same visit being assigned to two rooms simultaneously
        conflict_result = await db.execute(
            select(Room).where(
                Room.current_visit_id == body.current_visit_id,
                Room.room_number != room_number,
            )
        )
        if conflict_result.scalar_one_or_none():
            raise HTTPException(
                status_code=409,
                detail=f"Visit '{body.current_visit_id}' is already assigned to another room",
            )
    room.current_visit_id = body.current_visit_id
    await db.commit()
    await db.refresh(room)
    return await _build_response(room, db)
