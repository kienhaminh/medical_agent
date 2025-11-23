import os
import shutil
import uuid
from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends, File, UploadFile, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ...config.database import get_db, Patient, MedicalRecord
from ..models import (
    PatientCreate, PatientResponse, PatientDetailResponse,
    RecordResponse, TextRecordCreate
)

router = APIRouter()

# Ensure uploads directory exists
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

@router.post("/api/patients", response_model=PatientResponse)
async def create_patient(patient: PatientCreate, db: AsyncSession = Depends(get_db)):
    """Create a new patient."""
    new_patient = Patient(name=patient.name, dob=patient.dob, gender=patient.gender)
    db.add(new_patient)
    await db.commit()
    await db.refresh(new_patient)
    return PatientResponse(
        id=new_patient.id,
        name=new_patient.name,
        dob=new_patient.dob,
        gender=new_patient.gender,
        created_at=new_patient.created_at.isoformat()
    )

@router.get("/api/patients", response_model=list[PatientResponse])
async def list_patients(db: AsyncSession = Depends(get_db)):
    """List all patients."""
    result = await db.execute(select(Patient))
    patients = result.scalars().all()
    return [
        PatientResponse(
            id=p.id,
            name=p.name,
            dob=p.dob,
            gender=p.gender,
            created_at=p.created_at.isoformat()
        ) for p in patients
    ]

@router.get("/api/patients/{patient_id}", response_model=PatientDetailResponse)
async def get_patient(patient_id: int, db: AsyncSession = Depends(get_db)):
    """Get patient details with medical records."""
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

    # Format records
    formatted_records = []
    for r in records:
        record_data = {
            "id": r.id,
            "patient_id": r.patient_id,
            "record_type": r.record_type,
            "title": r.summary or "Medical Record",
            "summary": r.summary,
            "content": r.content if r.record_type == "text" else None,
            "file_url": None,  # TODO: Implement file storage
            "file_type": r.record_type,
            "created_at": r.created_at.isoformat(),
            "updated_at": r.created_at.isoformat()
        }
        formatted_records.append(record_data)

    return PatientDetailResponse(
        id=patient.id,
        name=patient.name,
        dob=patient.dob,
        gender=patient.gender,
        created_at=patient.created_at.isoformat(),
        records=formatted_records
    )

@router.get("/api/patients/{patient_id}/records", response_model=list[RecordResponse])
async def list_patient_records(patient_id: int, db: AsyncSession = Depends(get_db)):
    """List all records for a patient."""
    result = await db.execute(select(MedicalRecord).where(MedicalRecord.patient_id == patient_id).order_by(MedicalRecord.created_at.desc()))
    records = result.scalars().all()
    
    response = []
    for r in records:
        file_url = None
        title = "Untitled"
        file_type = None
        
        if r.record_type == "text":
            # Extract title from the first line of content if available
            first_line = r.content.split('\n', 1)[0] if r.content else ""
            if first_line.startswith("Title: "):
                title = first_line[len("Title: "):].strip()
            else:
                title = first_line.strip() or "Text Record"
            content_display = r.content # Keep full content for text records
            file_type = "text"
        elif r.record_type in ["image", "pdf"]:
            filename = os.path.basename(r.content)
            file_url = f"http://localhost:8000/uploads/{filename}"
            
            # Extract title from summary if available
            if r.summary and "Title: " in r.summary:
                try:
                    title_part = r.summary.split("Title: ")[1].split(" |")[0]
                    title = title_part.strip()
                except IndexError:
                    title = filename
            else:
                title = filename
            content_display = None # No content for file records
            file_type = r.record_type
            
        response.append(RecordResponse(
            id=r.id,
            patient_id=r.patient_id,
            record_type=r.record_type,
            title=title,
            description=r.summary,
            content=content_display,
            file_url=file_url,
            file_type=file_type,
            created_at=r.created_at.isoformat()
        ))
    return response

@router.post("/api/patients/{patient_id}/records", response_model=RecordResponse)
async def create_text_record(patient_id: int, record: TextRecordCreate, db: AsyncSession = Depends(get_db)):
    """Create a new text record."""
    # We'll store title as the first line of content or just prepend it
    full_content = f"Title: {record.title}\n\n{record.content}"
    
    new_record = MedicalRecord(
        patient_id=patient_id,
        record_type="text",
        content=full_content,
        summary=record.description
    )
    db.add(new_record)
    await db.commit()
    await db.refresh(new_record)
    
    return RecordResponse(
        id=new_record.id,
        patient_id=new_record.patient_id,
        record_type=new_record.record_type,
        title=record.title,
        description=new_record.summary,
        content=new_record.content,
        file_url=None,
        file_type="text",
        created_at=new_record.created_at.isoformat()
    )

@router.post("/api/patients/{patient_id}/records/upload", response_model=RecordResponse)
async def upload_record(
    patient_id: int,
    file: UploadFile = File(...),
    title: str = Form(...),
    description: str = Form(None),
    file_type: str = Form(None),
    db: AsyncSession = Depends(get_db)
):
    """Upload a file record (Image/PDF)."""
    # Generate unique filename
    file_ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4()}{file_ext}"
    file_path = UPLOAD_DIR / filename
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Determine record type
    record_type = "pdf" if file.content_type == "application/pdf" else "image"
    
    # Store metadata in summary for now since we lack fields
    # Format: "Title: {title} | Type: {file_type} | Desc: {description}"
    metadata_summary = f"Title: {title} | Type: {file_type} | Desc: {description or ''}"
    
    new_record = MedicalRecord(
        patient_id=patient_id,
        record_type=record_type,
        content=str(file_path), # Store path in content
        summary=metadata_summary
    )
    db.add(new_record)
    await db.commit()
    await db.refresh(new_record)
    
    return RecordResponse(
        id=new_record.id,
        patient_id=new_record.patient_id,
        record_type=new_record.record_type,
        title=title,
        description=description,
        content=None,
        file_url=f"http://localhost:8000/uploads/{filename}",
        file_type=file_type,
        created_at=new_record.created_at.isoformat()
    )

@router.delete("/api/records/{record_id}")
async def delete_record(record_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a record."""
    result = await db.execute(select(MedicalRecord).where(MedicalRecord.id == record_id))
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    # If it's a file, delete it
    if record.record_type in ["image", "pdf"]:
        try:
            os.remove(record.content)
        except OSError:
            pass # File might not exist
            
    await db.delete(record)
    await db.commit()
    return {"status": "ok", "message": "Record deleted"}
