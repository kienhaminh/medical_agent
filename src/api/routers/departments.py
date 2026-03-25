"""Department API endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.models import DepartmentResponse, DepartmentUpdate
from src.models.base import get_db
from src.models.department import Department
from src.models.visit import Visit, VisitStatus

router = APIRouter(prefix="/api/departments", tags=["Departments"])


def _compute_department_status(patient_count: int, capacity: int) -> str:
    """Compute department load status based on patient count vs capacity."""
    if capacity == 0:
        return "IDLE"
    ratio = patient_count / capacity
    if ratio < 0.25:
        return "IDLE"
    elif ratio < 0.60:
        return "OK"
    elif ratio < 0.85:
        return "BUSY"
    return "CRITICAL"


@router.get("", response_model=list[DepartmentResponse])
async def list_departments(db: AsyncSession = Depends(get_db)):
    """List all departments with live patient counts and status."""
    result = await db.execute(select(Department).order_by(Department.name))
    departments = result.scalars().all()

    # Aggregate patient counts per department in one query
    count_query = (
        select(Visit.current_department, func.count(Visit.id))
        .where(Visit.status == VisitStatus.IN_DEPARTMENT.value)
        .where(Visit.current_department.isnot(None))
        .group_by(Visit.current_department)
    )
    count_result = await db.execute(count_query)
    patient_counts = dict(count_result.all())

    responses = []
    for dept in departments:
        count = patient_counts.get(dept.name, 0)
        responses.append(DepartmentResponse(
            name=dept.name,
            label=dept.label,
            capacity=dept.capacity,
            is_open=dept.is_open,
            color=dept.color,
            icon=dept.icon,
            current_patient_count=count,
            queue_length=max(0, count - dept.capacity) if count > dept.capacity else 0,
            status=_compute_department_status(count, dept.capacity),
        ))
    return responses


@router.patch("/{name}", response_model=DepartmentResponse)
async def update_department(
    name: str,
    update: DepartmentUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update department capacity or open/close status."""
    result = await db.execute(select(Department).where(Department.name == name))
    dept = result.scalar_one_or_none()
    if not dept:
        raise HTTPException(status_code=404, detail=f"Department '{name}' not found")

    if update.capacity is not None:
        dept.capacity = update.capacity
    if update.is_open is not None:
        dept.is_open = update.is_open

    await db.commit()
    await db.refresh(dept)

    # Get live patient count for the updated department
    count_result = await db.execute(
        select(func.count(Visit.id))
        .where(Visit.current_department == name)
        .where(Visit.status == VisitStatus.IN_DEPARTMENT.value)
    )
    count = count_result.scalar() or 0

    return DepartmentResponse(
        name=dept.name,
        label=dept.label,
        capacity=dept.capacity,
        is_open=dept.is_open,
        color=dept.color,
        icon=dept.icon,
        current_patient_count=count,
        queue_length=max(0, count - dept.capacity) if count > dept.capacity else 0,
        status=_compute_department_status(count, dept.capacity),
    )
