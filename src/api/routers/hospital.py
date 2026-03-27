"""Hospital-level KPI endpoints."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.base import get_db
from src.models.department import Department
from src.models.visit import Visit, VisitStatus


class HospitalStats(BaseModel):
    active_patients: int
    departments_at_capacity: int
    avg_wait_minutes: float
    discharged_today: int


router = APIRouter(prefix="/api/hospital", tags=["Hospital"])


@router.get("/stats", response_model=HospitalStats)
async def get_hospital_stats(db: AsyncSession = Depends(get_db)):
    """Get aggregated hospital KPIs."""
    active_result = await db.execute(
        select(func.count(Visit.id)).where(Visit.status != VisitStatus.COMPLETED.value)
    )
    active_patients = active_result.scalar() or 0

    dept_result = await db.execute(select(Department))
    departments = dept_result.scalars().all()

    count_result = await db.execute(
        select(Visit.current_department, func.count(Visit.id))
        .where(Visit.status == VisitStatus.IN_DEPARTMENT.value)
        .where(Visit.current_department.isnot(None))
        .group_by(Visit.current_department)
    )
    patient_counts = dict(count_result.all())

    at_capacity = sum(1 for dept in departments if patient_counts.get(dept.name, 0) >= dept.capacity)

    active_visits_result = await db.execute(
        select(Visit.created_at).where(Visit.status != VisitStatus.COMPLETED.value)
    )
    created_times = active_visits_result.scalars().all()
    if created_times:
        now = datetime.now(timezone.utc)
        total_minutes = sum((now - (ct.replace(tzinfo=timezone.utc) if ct.tzinfo is None else ct)).total_seconds() / 60 for ct in created_times)
        avg_wait = round(total_minutes / len(created_times), 1)
    else:
        avg_wait = 0.0

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    discharged_result = await db.execute(
        select(func.count(Visit.id))
        .where(Visit.status == VisitStatus.COMPLETED.value)
        .where(Visit.updated_at >= today_start)
    )
    discharged_today = discharged_result.scalar() or 0

    return HospitalStats(
        active_patients=active_patients,
        departments_at_capacity=at_capacity,
        avg_wait_minutes=avg_wait,
        discharged_today=discharged_today,
    )


class ExtendedHospitalStats(BaseModel):
    """Extended hospital statistics including bed occupancy and visit breakdown."""
    active_patients: int
    departments_at_capacity: int
    avg_wait_minutes: float
    discharged_today: int
    total_beds: int
    occupied_beds: int
    occupancy_rate: float  # percentage 0-100
    visits_by_status: dict[str, int]  # e.g. {"intake": 3, "in_department": 5}


@router.get("/extended-stats", response_model=ExtendedHospitalStats)
async def get_extended_hospital_stats(db: AsyncSession = Depends(get_db)):
    """Get extended hospital KPIs including bed occupancy and visit status breakdown."""
    # Reuse base stats logic
    active_result = await db.execute(
        select(func.count(Visit.id)).where(Visit.status != VisitStatus.COMPLETED.value)
    )
    active_patients = active_result.scalar() or 0

    dept_result = await db.execute(select(Department))
    departments = dept_result.scalars().all()

    # Patient counts per department (in_department only)
    count_result = await db.execute(
        select(Visit.current_department, func.count(Visit.id))
        .where(Visit.status == VisitStatus.IN_DEPARTMENT.value)
        .where(Visit.current_department.isnot(None))
        .group_by(Visit.current_department)
    )
    patient_counts = dict(count_result.all())

    at_capacity = sum(1 for dept in departments if patient_counts.get(dept.name, 0) >= dept.capacity)

    # Average wait time
    active_visits_result = await db.execute(
        select(Visit.created_at).where(Visit.status != VisitStatus.COMPLETED.value)
    )
    created_times = active_visits_result.scalars().all()
    if created_times:
        now = datetime.now(timezone.utc)
        total_minutes = sum(
            (now - (ct.replace(tzinfo=timezone.utc) if ct.tzinfo is None else ct)).total_seconds() / 60
            for ct in created_times
        )
        avg_wait = round(total_minutes / len(created_times), 1)
    else:
        avg_wait = 0.0

    # Discharged today
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    discharged_result = await db.execute(
        select(func.count(Visit.id))
        .where(Visit.status == VisitStatus.COMPLETED.value)
        .where(Visit.updated_at >= today_start)
    )
    discharged_today = discharged_result.scalar() or 0

    # Bed capacity calculations
    total_beds = sum(dept.capacity for dept in departments)
    occupied_beds = sum(patient_counts.values())
    occupancy_rate = round((occupied_beds / total_beds * 100), 1) if total_beds > 0 else 0.0

    # Visits grouped by status
    status_result = await db.execute(
        select(Visit.status, func.count(Visit.id)).group_by(Visit.status)
    )
    visits_by_status = dict(status_result.all())

    return ExtendedHospitalStats(
        active_patients=active_patients,
        departments_at_capacity=at_capacity,
        avg_wait_minutes=avg_wait,
        discharged_today=discharged_today,
        total_beds=total_beds,
        occupied_beds=occupied_beds,
        occupancy_rate=occupancy_rate,
        visits_by_status=visits_by_status,
    )
