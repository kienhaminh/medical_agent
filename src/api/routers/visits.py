"""Visit API routes — create, list, detail, and routing approval."""
import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import get_db, Visit, Patient, ChatSession, SubAgent
from src.models.visit import VisitStatus, AUTO_ROUTE_THRESHOLD
from ..models import VisitCreate, VisitResponse, VisitListResponse, VisitDetailResponse, VisitRouteUpdate, VisitTransferRequest
from src.models.department import Department

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Visits"])


def _visit_to_response(v: Visit) -> VisitResponse:
    return VisitResponse(
        id=v.id, visit_id=v.visit_id, patient_id=v.patient_id,
        status=v.status, confidence=v.confidence,
        routing_suggestion=v.routing_suggestion,
        routing_decision=v.routing_decision,
        chief_complaint=v.chief_complaint,
        intake_session_id=v.intake_session_id,
        reviewed_by=v.reviewed_by,
        current_department=v.current_department,
        queue_position=v.queue_position,
        created_at=v.created_at.isoformat(),
        updated_at=v.updated_at.isoformat(),
    )


async def _generate_visit_id(db: AsyncSession) -> str:
    today = date.today()
    prefix = f"VIS-{today.strftime('%Y%m%d')}-"
    result = await db.execute(
        select(Visit.visit_id).where(Visit.visit_id.like(f"{prefix}%"))
        .order_by(Visit.visit_id.desc()).limit(1)
    )
    last_id = result.scalar_one_or_none()
    if last_id:
        next_num = int(last_id.split("-")[-1]) + 1
    else:
        next_num = 1
    return f"{prefix}{next_num:03d}"


@router.post("/api/visits", response_model=VisitResponse)
async def create_visit(visit_data: VisitCreate, db: AsyncSession = Depends(get_db)):
    # Validate patient exists
    patient = await db.execute(select(Patient).where(Patient.id == visit_data.patient_id))
    patient = patient.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Check for duplicate active intake
    existing = await db.execute(
        select(Visit).where(Visit.patient_id == visit_data.patient_id, Visit.status == VisitStatus.INTAKE.value)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Patient already has an active intake visit")

    # Look up Reception agent
    reception_agent = await db.execute(select(SubAgent).where(SubAgent.role == "reception_triage"))
    reception_agent = reception_agent.scalar_one_or_none()
    if not reception_agent:
        raise HTTPException(status_code=500, detail="Reception agent not configured. Create a SubAgent with role='reception_triage'.")

    from sqlalchemy.exc import IntegrityError
    visit = None
    for attempt in range(3):
        try:
            vid = await _generate_visit_id(db)
            session = ChatSession(title=f"Intake - {vid}", agent_id=reception_agent.id)
            db.add(session)
            await db.flush()
            visit = Visit(visit_id=vid, patient_id=visit_data.patient_id, status=VisitStatus.INTAKE.value, intake_session_id=session.id)
            db.add(visit)
            await db.commit()
            await db.refresh(visit)
            break
        except IntegrityError:
            await db.rollback()
            if attempt == 2:
                raise HTTPException(status_code=500, detail="Failed to generate unique visit ID")

    return _visit_to_response(visit)


@router.get("/api/visits", response_model=list[VisitListResponse])
async def list_visits(
    status: str | None = None,
    exclude_status: str | None = None,
    patient_id: int | None = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    query = select(Visit, Patient.name).join(Patient, Visit.patient_id == Patient.id).order_by(Visit.created_at.desc())
    if status:
        query = query.where(Visit.status == status)
    if exclude_status:
        query = query.where(Visit.status != exclude_status)
    if patient_id:
        query = query.where(Visit.patient_id == patient_id)
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    rows = result.all()
    return [
        VisitListResponse(
            **_visit_to_response(visit).model_dump(),
            patient_name=patient_name,
        )
        for visit, patient_name in rows
    ]


@router.get("/api/visits/{visit_id}", response_model=VisitDetailResponse)
async def get_visit(visit_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Visit).where(Visit.id == visit_id))
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    patient = await db.execute(select(Patient).where(Patient.id == visit.patient_id))
    patient = patient.scalar_one_or_none()
    return VisitDetailResponse(
        id=visit.id, visit_id=visit.visit_id, patient_id=visit.patient_id,
        status=visit.status, confidence=visit.confidence,
        routing_suggestion=visit.routing_suggestion,
        routing_decision=visit.routing_decision,
        chief_complaint=visit.chief_complaint,
        intake_session_id=visit.intake_session_id,
        reviewed_by=visit.reviewed_by,
        created_at=visit.created_at.isoformat(),
        updated_at=visit.updated_at.isoformat(),
        patient_name=patient.name if patient else "Unknown",
        patient_dob=patient.dob if patient else "",
        patient_gender=patient.gender if patient else "",
        intake_notes=visit.intake_notes,
    )


@router.patch("/api/visits/{visit_id}/route", response_model=VisitResponse)
async def route_visit(visit_id: int, route_data: VisitRouteUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Visit).where(Visit.id == visit_id))
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    if visit.status not in (VisitStatus.AUTO_ROUTED.value, VisitStatus.PENDING_REVIEW.value):
        raise HTTPException(status_code=400, detail=f"Visit cannot be routed from status '{visit.status}'.")
    visit.routing_decision = route_data.routing_decision
    visit.reviewed_by = route_data.reviewed_by
    visit.status = VisitStatus.ROUTED.value
    await db.commit()
    await db.refresh(visit)
    return _visit_to_response(visit)


@router.patch("/api/visits/{visit_id}/check-in", response_model=VisitResponse)
async def check_in_visit(visit_id: int, db: AsyncSession = Depends(get_db)):
    """Transition a routed visit to in_department status."""
    result = await db.execute(select(Visit).where(Visit.id == visit_id))
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    if visit.status != VisitStatus.ROUTED.value:
        raise HTTPException(status_code=400, detail=f"Visit cannot be checked in from status '{visit.status}'. Must be 'routed'.")
    visit.status = VisitStatus.IN_DEPARTMENT.value
    if visit.routing_decision:
        target_dept = visit.routing_decision[0]
        # Normalize: AI may have stored label ("Pulmonology") instead of name ("pulmonology")
        dept_result = await db.execute(select(Department).where(Department.name == target_dept))
        if not dept_result.scalar_one_or_none():
            # Try matching by label
            dept_by_label = await db.execute(
                select(Department).where(func.lower(Department.label) == func.lower(target_dept))
            )
            matched = dept_by_label.scalar_one_or_none()
            if matched:
                target_dept = matched.name
            else:
                raise HTTPException(status_code=400, detail=f"Department '{target_dept}' not found.")
        visit.current_department = target_dept
    max_pos_result = await db.execute(
        select(func.max(Visit.queue_position))
        .where(Visit.current_department == visit.current_department)
        .where(Visit.status == VisitStatus.IN_DEPARTMENT.value)
    )
    max_pos = max_pos_result.scalar() or 0
    visit.queue_position = max_pos + 1
    await db.commit()
    await db.refresh(visit)
    return _visit_to_response(visit)


@router.patch("/api/visits/{visit_id}/complete", response_model=VisitResponse)
async def complete_visit(visit_id: int, db: AsyncSession = Depends(get_db)):
    """Transition an in-department visit to completed status."""
    result = await db.execute(select(Visit).where(Visit.id == visit_id))
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    if visit.status != VisitStatus.IN_DEPARTMENT.value:
        raise HTTPException(status_code=400, detail=f"Visit cannot be completed from status '{visit.status}'. Must be 'in_department'.")
    if visit.current_department and visit.queue_position:
        source_visits_result = await db.execute(
            select(Visit)
            .where(Visit.current_department == visit.current_department)
            .where(Visit.status == VisitStatus.IN_DEPARTMENT.value)
            .where(Visit.queue_position > visit.queue_position)
            .order_by(Visit.queue_position)
        )
        for v in source_visits_result.scalars().all():
            v.queue_position -= 1
    visit.status = VisitStatus.COMPLETED.value
    visit.current_department = None
    visit.queue_position = None
    await db.commit()
    await db.refresh(visit)
    return _visit_to_response(visit)


@router.post("/api/visits/{visit_id}/transfer", response_model=VisitResponse)
async def transfer_visit(visit_id: int, transfer: VisitTransferRequest, db: AsyncSession = Depends(get_db)):
    """Transfer a patient between departments."""
    result = await db.execute(select(Visit).where(Visit.id == visit_id))
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    if visit.status != VisitStatus.IN_DEPARTMENT.value:
        raise HTTPException(status_code=400, detail="Visit must be in_department to transfer")
    dept_result = await db.execute(select(Department).where(Department.name == transfer.target_department))
    target_dept = dept_result.scalar_one_or_none()
    if not target_dept:
        raise HTTPException(status_code=404, detail="Target department not found")
    if not target_dept.is_open:
        raise HTTPException(status_code=400, detail="Target department is closed")
    count_result = await db.execute(
        select(func.count(Visit.id))
        .where(Visit.current_department == transfer.target_department)
        .where(Visit.status == VisitStatus.IN_DEPARTMENT.value)
    )
    current_count = count_result.scalar() or 0
    if current_count >= target_dept.capacity:
        raise HTTPException(status_code=400, detail="Target department is at capacity")
    source_dept = visit.current_department
    source_visits_result = await db.execute(
        select(Visit)
        .where(Visit.current_department == source_dept)
        .where(Visit.status == VisitStatus.IN_DEPARTMENT.value)
        .where(Visit.queue_position > visit.queue_position)
        .order_by(Visit.queue_position)
    )
    for v in source_visits_result.scalars().all():
        v.queue_position -= 1
    max_pos_result = await db.execute(
        select(func.max(Visit.queue_position))
        .where(Visit.current_department == transfer.target_department)
        .where(Visit.status == VisitStatus.IN_DEPARTMENT.value)
    )
    max_pos = max_pos_result.scalar() or 0
    visit.current_department = transfer.target_department
    visit.queue_position = max_pos + 1
    await db.commit()
    await db.refresh(visit)
    return _visit_to_response(visit)
