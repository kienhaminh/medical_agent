"""Patient core CRUD operations."""
import logging
import os
from datetime import date as _date
from fastapi import APIRouter, HTTPException, Depends

from src.utils.upload_storage import public_url_for_rel, public_url_from_filesystem_path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import cast, or_, select, String as SAString

from src.models import get_db, Patient, MedicalRecord, Imaging, ImageGroup
from ...models import (
    PatientCreate, PatientResponse, PatientDetailResponse,
    RecordResponse,
)
from ..patients.imaging import _imaging_to_response

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Patients"])


@router.post("/api/patients", response_model=PatientResponse)
async def create_patient(patient: PatientCreate, db: AsyncSession = Depends(get_db)):
    """Create a new patient."""
    new_patient = Patient(name=patient.name, dob=_date.fromisoformat(patient.dob), gender=patient.gender)
    db.add(new_patient)
    await db.commit()
    await db.refresh(new_patient)
    return PatientResponse(
        id=new_patient.id,
        name=new_patient.name,
        dob=new_patient.dob.isoformat(),
        gender=new_patient.gender,
        created_at=new_patient.created_at.isoformat()
    )


@router.get("/api/patients", response_model=list[PatientResponse])
async def list_patients(q: str | None = None, db: AsyncSession = Depends(get_db)):
    """List all patients, optionally filtered by search query."""
    query = select(Patient)
    if q:
        filters = [
            Patient.name.ilike(f"%{q}%"),
            cast(Patient.dob, SAString).ilike(f"%{q}%"),
        ]
        if q.isdigit():
            filters.append(Patient.id == int(q))
        query = query.where(or_(*filters))
    result = await db.execute(query)
    patients = result.scalars().all()
    return [
        PatientResponse(
            id=p.id,
            name=p.name,
            dob=p.dob.isoformat(),
            gender=p.gender,
            created_at=p.created_at.isoformat()
        ) for p in patients
    ]


@router.get("/api/patients/{patient_id}", response_model=PatientDetailResponse)
async def get_patient(patient_id: int, db: AsyncSession = Depends(get_db)):
    """Get patient details with medical records and imaging."""
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Fetch medical records
    records_result = await db.execute(
        select(MedicalRecord)
        .where(MedicalRecord.patient_id == patient_id)
        .order_by(MedicalRecord.created_at.desc())
    )
    records = records_result.scalars().all()

    # Fetch imaging
    imaging_result = await db.execute(
        select(Imaging)
        .where(Imaging.patient_id == patient_id)
        .order_by(Imaging.created_at.desc())
    )
    imaging = imaging_result.scalars().all()

    # Fetch image groups
    groups_result = await db.execute(
        select(ImageGroup)
        .where(ImageGroup.patient_id == patient_id)
        .order_by(ImageGroup.created_at.desc())
    )
    image_groups = groups_result.scalars().all()

    # Build RecordResponse with correct fields per record type
    formatted_records = []
    for r in records:
        if r.record_type == "text":
            first_line = r.content.split("\n", 1)[0] if r.content else ""
            title = first_line[len("Title: "):].strip() if first_line.startswith("Title: ") else (first_line.strip() or "Text Record")
            file_url = None
            file_type = "text"
        else:
            raw = r.content or ""
            file_url = public_url_from_filesystem_path(raw)
            if not file_url and raw:
                file_url = public_url_for_rel(os.path.basename(raw))
            if r.summary and "Title: " in r.summary:
                try:
                    title = r.summary.split("Title: ")[1].split(" |")[0].strip()
                except IndexError:
                    title = filename or "Record"
            else:
                title = filename or "Record"
            file_type = r.record_type

        formatted_records.append(RecordResponse(
            id=r.id,
            patient_id=r.patient_id,
            record_type=r.record_type,
            title=title,
            description=r.summary,
            content=r.content if r.record_type == "text" else None,
            file_url=file_url,
            file_type=file_type,
            created_at=r.created_at.isoformat(),
        ))

    return PatientDetailResponse(
        id=patient.id,
        name=patient.name,
        dob=patient.dob.isoformat(),
        gender=patient.gender,
        created_at=patient.created_at.isoformat(),
        records=formatted_records,
        imaging=[_imaging_to_response(i) for i in imaging],
        image_groups=[
            {"id": g.id, "patient_id": g.patient_id, "name": g.name, "created_at": g.created_at.isoformat()}
            for g in image_groups
        ],
        health_summary=getattr(patient, "health_summary", None),
        health_summary_updated_at=patient.health_summary_updated_at.isoformat() if getattr(patient, "health_summary_updated_at", None) else None,
        health_summary_status=getattr(patient, "health_summary_status", None),
        health_summary_task_id=getattr(patient, "health_summary_task_id", None),
    )
