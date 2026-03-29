"""Visit API routes — create, list, detail, and routing approval."""
import logging
from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import get_db, Visit, Patient, ChatSession, SubAgent
from src.models.visit import VisitStatus, AUTO_ROUTE_THRESHOLD
from ..models import VisitCreate, VisitResponse, VisitListResponse, VisitDetailResponse, VisitRouteUpdate, VisitTransferRequest, ClinicalNotesUpdate, DDxResponse, DiagnosisItem, HandoffResponse
from src.tools.builtin.differential_diagnosis_tool import generate_differential_diagnosis as _ddx_fn
from src.tools.builtin.shift_handoff_tool import generate_shift_handoff as _handoff_fn
from src.models.department import Department
from src.api.ws.event_bus import event_bus
from src.api.ws.events import WSEventType

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
        clinical_notes=v.clinical_notes,
        assigned_doctor=v.assigned_doctor,
        urgency_level=v.urgency_level,
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
    department: str | None = None,
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
    if department:
        query = query.where(Visit.current_department == department)
    query = query.limit(limit).offset(offset)
    result = await db.execute(query)
    rows = result.all()
    now = datetime.now(timezone.utc)
    result_list = []
    for visit, patient_name in rows:
        created = visit.created_at.replace(tzinfo=timezone.utc) if visit.created_at.tzinfo is None else visit.created_at
        wait_minutes = int((now - created).total_seconds() / 60)
        result_list.append(VisitListResponse(
            **_visit_to_response(visit).model_dump(),
            patient_name=patient_name,
            wait_minutes=wait_minutes,
        ))
    return result_list


@router.get("/api/visits/handoff", response_model=HandoffResponse)
async def get_shift_handoff(
    department: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Generate a shift handoff document for all active in-department patients."""
    # Count active patients for the response metadata
    count_query = select(func.count(Visit.id)).where(Visit.status == VisitStatus.IN_DEPARTMENT.value)
    if department:
        count_query = count_query.where(Visit.current_department == department)
    count = (await db.execute(count_query)).scalar() or 0

    document = _handoff_fn(department=department)
    return HandoffResponse(document=document, patient_count=count, department=department)


@router.get("/api/visits/{visit_id}/brief")
async def get_visit_brief(visit_id: int, db: AsyncSession = Depends(get_db)):
    """Return a pre-visit patient brief assembled from DB data."""
    from src.tools.builtin.pre_visit_brief_tool import pre_visit_brief as _pre_visit_brief_fn
    result = await db.execute(select(Visit).where(Visit.id == visit_id))
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    brief_text = _pre_visit_brief_fn(patient_id=visit.patient_id, visit_id=visit.id)
    return {"brief": brief_text}


@router.post("/api/visits/{visit_id}/ddx", response_model=DDxResponse)
async def get_differential_diagnosis(visit_id: int, db: AsyncSession = Depends(get_db)):
    """Generate differential diagnoses for a visit based on chief complaint."""
    import json as _json
    result = await db.execute(select(Visit).where(Visit.id == visit_id))
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    patient_result = await db.execute(select(Patient).where(Patient.id == visit.patient_id))
    patient = patient_result.scalar_one_or_none()

    context = f"{patient.dob}, {patient.gender}" if patient else None
    raw = _ddx_fn(
        patient_id=visit.patient_id,
        chief_complaint=visit.chief_complaint or "Not specified",
        context=context,
    )
    data = _json.loads(raw)
    diagnoses = [DiagnosisItem(**d) for d in data.get("diagnoses", [])]
    return DDxResponse(
        visit_id=visit_id,
        chief_complaint=visit.chief_complaint,
        diagnoses=diagnoses,
        error=data.get("error"),
    )


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
        current_department=visit.current_department,
        queue_position=visit.queue_position,
        clinical_notes=visit.clinical_notes,
        assigned_doctor=visit.assigned_doctor,
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

    target_dept = route_data.routing_decision[0] if route_data.routing_decision else None
    if target_dept:
        await event_bus.emit_to_room(target_dept, WSEventType.VISIT_ROUTED, {
            "visit_id": visit.visit_id,
            "routing_decision": visit.routing_decision,
            "reviewed_by": visit.reviewed_by,
            "status": visit.status,
        })

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

    if visit.current_department:
        await event_bus.emit_to_room(visit.current_department, WSEventType.VISIT_CHECKED_IN, {
            "visit_id": visit.visit_id,
            "patient_id": visit.patient_id,
            "current_department": visit.current_department,
            "queue_position": visit.queue_position,
            "status": visit.status,
        })

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
    completed_dept = visit.current_department
    visit.status = VisitStatus.COMPLETED.value
    visit.current_department = None
    visit.queue_position = None
    await db.commit()
    await db.refresh(visit)

    if completed_dept:
        await event_bus.emit_to_room(completed_dept, WSEventType.VISIT_COMPLETED, {
            "visit_id": visit.visit_id,
            "patient_id": visit.patient_id,
            "status": visit.status,
        })
        await event_bus.emit_to_room(completed_dept, WSEventType.QUEUE_UPDATED, {
            "department": completed_dept,
        })

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

    # Notify both source and target departments
    await event_bus.emit_to_room(source_dept, WSEventType.VISIT_TRANSFERRED, {
        "visit_id": visit.visit_id,
        "patient_id": visit.patient_id,
        "old_department": source_dept,
        "new_department": transfer.target_department,
        "status": visit.status,
    })
    await event_bus.emit_to_room(transfer.target_department, WSEventType.VISIT_TRANSFERRED, {
        "visit_id": visit.visit_id,
        "patient_id": visit.patient_id,
        "old_department": source_dept,
        "new_department": transfer.target_department,
        "status": visit.status,
    })
    # Queue position updates for both departments
    await event_bus.emit_to_room(source_dept, WSEventType.QUEUE_UPDATED, {"department": source_dept})
    await event_bus.emit_to_room(transfer.target_department, WSEventType.QUEUE_UPDATED, {"department": transfer.target_department})

    return _visit_to_response(visit)


@router.patch("/api/visits/{visit_id}/notes", response_model=VisitResponse)
async def update_clinical_notes(visit_id: int, data: ClinicalNotesUpdate, db: AsyncSession = Depends(get_db)):
    """Update clinical notes and optionally assigned doctor on a visit."""
    result = await db.execute(select(Visit).where(Visit.id == visit_id))
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    visit.clinical_notes = data.clinical_notes
    if data.assigned_doctor is not None:
        visit.assigned_doctor = data.assigned_doctor
    await db.commit()
    await db.refresh(visit)

    # Notify assigned doctor if set
    if visit.assigned_doctor:
        await event_bus.emit_to_room(
            visit.current_department or "",
            WSEventType.VISIT_NOTES_UPDATED,
            {
                "visit_id": visit.visit_id,
                "assigned_doctor": visit.assigned_doctor,
            },
        )

    return _visit_to_response(visit)
