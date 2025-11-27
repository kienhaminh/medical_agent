import os
import shutil
import uuid
import json
import logging
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, HTTPException, Depends, File, UploadFile, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import redis.asyncio as redis

from ...config.database import get_db, Patient, MedicalRecord, Imaging, ImageGroup
from ...config.settings import load_config
from ..models import (
    PatientCreate, PatientResponse, PatientDetailResponse,
    RecordResponse, TextRecordCreate, HealthSummaryResponse,
    ImagingResponse, ImagingCreate, ImageGroupCreate, ImageGroupResponse
)
from ..dependencies import get_or_create_agent

logger = logging.getLogger(__name__)

# Load configuration
config = load_config()


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

    # Fetch imaging records
    imaging_result = await db.execute(
        select(Imaging)
        .where(Imaging.patient_id == patient_id)
        .order_by(Imaging.created_at.desc())
    )
    imaging_records = imaging_result.scalars().all()

    # Fetch image groups
    groups_result = await db.execute(
        select(ImageGroup)
        .where(ImageGroup.patient_id == patient_id)
        .order_by(ImageGroup.created_at.desc())
    )
    image_groups = groups_result.scalars().all()

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

    # Format imaging
    formatted_imaging = [
        ImagingResponse(
            id=img.id,
            patient_id=img.patient_id,
            title=img.title,
            image_type=img.image_type,
            original_url=img.original_url,
            preview_url=img.preview_url,
            group_id=img.group_id,
            created_at=img.created_at.isoformat()
        ) for img in imaging_records
    ]

    # Format image groups
    formatted_groups = [
        ImageGroupResponse(
            id=g.id,
            patient_id=g.patient_id,
            name=g.name,
            created_at=g.created_at.isoformat()
        ) for g in image_groups
    ]

    return PatientDetailResponse(
        id=patient.id,
        name=patient.name,
        dob=patient.dob,
        gender=patient.gender,
        created_at=patient.created_at.isoformat(),
        records=formatted_records,
        imaging=formatted_imaging,
        image_groups=formatted_groups,
        health_summary=patient.health_summary,
        health_summary_updated_at=patient.health_summary_updated_at.isoformat() if patient.health_summary_updated_at else None,
        health_summary_status=patient.health_summary_status,
        health_summary_task_id=patient.health_summary_task_id
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

@router.get("/api/patients/{patient_id}/imaging", response_model=list[ImagingResponse])
async def list_patient_imaging(patient_id: int, db: AsyncSession = Depends(get_db)):
    """List all imaging records for a patient."""
    result = await db.execute(
        select(Imaging)
        .where(Imaging.patient_id == patient_id)
        .order_by(Imaging.created_at.desc())
    )
    imaging_records = result.scalars().all()
    
    return [
        ImagingResponse(
            id=img.id,
            patient_id=img.patient_id,
            title=img.title,
            image_type=img.image_type,
            original_url=img.original_url,
            preview_url=img.preview_url,
            group_id=img.group_id,
            created_at=img.created_at.isoformat()
        ) for img in imaging_records
    ]

@router.post("/api/patients/{patient_id}/imaging", response_model=ImagingResponse)
async def create_imaging_record(
    patient_id: int,
    imaging_data: ImagingCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create an imaging record via URL (without file upload)."""
    # Verify patient exists
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    new_imaging = Imaging(
        patient_id=patient_id,
        title=imaging_data.title,
        image_type=imaging_data.image_type,
        original_url=imaging_data.origin_url,
        preview_url=imaging_data.preview_url,
        group_id=imaging_data.group_id
    )
    db.add(new_imaging)
    await db.commit()
    await db.refresh(new_imaging)
    
    return ImagingResponse(
        id=new_imaging.id,
        patient_id=new_imaging.patient_id,
        title=new_imaging.title,
        image_type=new_imaging.image_type,
        original_url=new_imaging.original_url,
        preview_url=new_imaging.preview_url,
        group_id=new_imaging.group_id,
        created_at=new_imaging.created_at.isoformat()
    )

@router.post("/api/patients/{patient_id}/imaging/upload", response_model=ImagingResponse)
async def upload_imaging_record(
    patient_id: int,
    file: UploadFile = File(...),
    title: str = Form(...),
    image_type: str = Form(...),
    group_id: int | None = Form(None),
    db: AsyncSession = Depends(get_db)
):
    """Upload an imaging record with a file."""
    # Verify patient exists
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Generate unique filename
    file_ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4()}{file_ext}"
    file_path = UPLOAD_DIR / filename
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # For now, we'll use the same URL for original and preview
    # In a real app, we might generate a thumbnail for preview
    file_url = f"http://localhost:8000/uploads/{filename}"
    
    new_imaging = Imaging(
        patient_id=patient_id,
        title=title,
        image_type=image_type,
        original_url=file_url,
        preview_url=file_url,
        group_id=group_id
    )
    db.add(new_imaging)
    await db.commit()
    await db.refresh(new_imaging)
    
    return ImagingResponse(
        id=new_imaging.id,
        patient_id=new_imaging.patient_id,
        title=new_imaging.title,
        image_type=new_imaging.image_type,
        original_url=new_imaging.original_url,
        preview_url=new_imaging.preview_url,
        group_id=new_imaging.group_id,
        created_at=new_imaging.created_at.isoformat()
    )

@router.post("/api/patients/{patient_id}/image-groups", response_model=ImageGroupResponse)
async def create_image_group(
    patient_id: int,
    group_data: ImageGroupCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new image group."""
    # Verify patient exists
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    new_group = ImageGroup(
        patient_id=patient_id,
        name=group_data.name
    )
    db.add(new_group)
    await db.commit()
    await db.refresh(new_group)
    
    return ImageGroupResponse(
        id=new_group.id,
        patient_id=new_group.patient_id,
        name=new_group.name,
        created_at=new_group.created_at.isoformat()
    )

@router.get("/api/patients/{patient_id}/image-groups", response_model=list[ImageGroupResponse])
async def list_image_groups(patient_id: int, db: AsyncSession = Depends(get_db)):
    """List all image groups for a patient."""
    result = await db.execute(
        select(ImageGroup)
        .where(ImageGroup.patient_id == patient_id)
        .order_by(ImageGroup.created_at.desc())
    )
    groups = result.scalars().all()
    
    return [
        ImageGroupResponse(
            id=g.id,
            patient_id=g.patient_id,
            name=g.name,
            created_at=g.created_at.isoformat()
        ) for g in groups
    ]

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


@router.delete("/api/patients/{patient_id}/imaging/{imaging_id}")
async def delete_imaging_record(
    patient_id: int, imaging_id: int, db: AsyncSession = Depends(get_db)
):
    """Delete an imaging record and remove local file if applicable."""
    result = await db.execute(
        select(Imaging)
        .where(Imaging.id == imaging_id)
        .where(Imaging.patient_id == patient_id)
    )
    imaging = result.scalar_one_or_none()
    if not imaging:
        raise HTTPException(status_code=404, detail="Imaging record not found")

    # Attempt to remove local file uploads
    if imaging.original_url and imaging.original_url.startswith(
        "http://localhost:8000/uploads/"
    ):
        filename = imaging.original_url.rsplit("/", 1)[-1]
        file_path = UPLOAD_DIR / filename
        if file_path.exists():
            try:
                file_path.unlink()
            except OSError:
                pass

    await db.delete(imaging)
    await db.commit()
    return {"status": "ok", "message": "Imaging deleted"}


@router.post("/api/patients/{patient_id}/generate-summary", response_model=HealthSummaryResponse)
async def generate_health_summary(patient_id: int, db: AsyncSession = Depends(get_db)):
    """Dispatch background task to generate AI health summary for a patient.
    
    Returns immediately with task_id and status. Client should poll or stream
    for updates using the /api/patients/{patient_id}/summary-stream endpoint.
    """
    # Import task here to avoid circular imports
    from ...tasks.agent_tasks import generate_patient_health_summary
    
    # 1. Verify patient exists
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # 2. Mark patient as pending and dispatch task
    patient.health_summary_status = "pending"
    await db.commit()
    
    # 3. Dispatch Celery task
    task = generate_patient_health_summary.delay(patient_id=patient_id)
    
    # 4. Save task_id
    patient.health_summary_task_id = task.id
    await db.commit()
    
    return HealthSummaryResponse(
        patient_id=patient.id,
        health_summary=patient.health_summary or "",
        health_summary_updated_at=patient.health_summary_updated_at.isoformat() if patient.health_summary_updated_at else None,
        status=patient.health_summary_status or "pending",
        task_id=task.id
    )


@router.get("/api/patients/{patient_id}/summary-stream")
async def stream_health_summary_updates(patient_id: int, db: AsyncSession = Depends(get_db)):
    """Stream health summary generation updates via Server-Sent Events.
    
    Uses Redis Pub/Sub for real-time updates from background task.
    Falls back to DB check if generation is already completed.
    
    Args:
        patient_id: Patient ID to stream updates for
        
    Returns:
        StreamingResponse with SSE updates
    """
    import asyncio
    logger.info(f"Starting health summary stream for patient {patient_id}")
    
    async def generate():
        logger.info(f"Inside generate for patient {patient_id}")
        try:
            # Initialize Redis
            redis_client = redis.from_url(config.redis_url)
            pubsub = redis_client.pubsub()
            
            logger.info(f"Checking DB for patient {patient_id}")
            # 1. Check initial state from DB
            from src.config.database import AsyncSessionLocal
            async with AsyncSessionLocal() as local_db:
                result = await local_db.execute(
                    select(Patient).where(Patient.id == patient_id)
                )
                patient = result.scalar_one_or_none()
                
                if not patient:
                    logger.error(f"Patient {patient_id} not found in DB")
                    yield f"data: {json.dumps({'error': 'Patient not found'})}\n\n"
                    return
                
                logger.info(f"Patient {patient_id} found with status: {patient.health_summary_status}")
                
                # If already completed/error, send final state and exit
                if patient.health_summary_status in ['completed', 'error']:
                    yield f"data: {json.dumps({'type': 'status', 'status': patient.health_summary_status, 'summary': patient.health_summary})}\n\n"
                    yield f"data: {json.dumps({'type': 'done'})}\n\n"
                    return
                
                # Check Redis for current partial progress
                content_key = f"patient:health_summary:{patient_id}:content"
                cached_content = await redis_client.get(content_key)
                if cached_content:
                    if isinstance(cached_content, bytes):
                        cached_content = cached_content.decode('utf-8')
                    logger.info(f"Found cached partial content for patient {patient_id}, length: {len(cached_content)}")
                    yield f"data: {json.dumps({'type': 'status', 'status': patient.health_summary_status, 'summary': cached_content})}\n\n"
                elif patient.health_summary:
                    # Fallback to DB summary if no cached content (e.g. pending start)
                    yield f"data: {json.dumps({'type': 'status', 'status': patient.health_summary_status, 'summary': patient.health_summary})}\n\n"
            
            # 2. Subscribe to Redis channel
            channel = f"patient:health_summary:{patient_id}"
            logger.info(f"Subscribing to Redis channel: {channel}")
            await pubsub.subscribe(channel)
            logger.info(f"Subscribed to {channel}")
            
            # Send test event
            test_event = json.dumps({'type': 'status', 'status': 'connected'})
            logger.info(f"Sending test event: {test_event}")
            yield f"data: {test_event}\n\n"
            
            # 3. Stream events
            logger.info(f"Starting event loop for patient {patient_id}")
            event_count = 0
            while True:
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                
                if message:
                    event_count += 1
                    logger.info(f"Received Redis message #{event_count}: {message}")
                    data = message['data']
                    if isinstance(data, bytes):
                        data = data.decode('utf-8')
                    
                    # Yield the raw event data
                    logger.info(f"Yielding event #{event_count}: {data[:100]}...")
                    yield f"data: {data}\n\n"
                    
                    # Check for completion signal
                    try:
                        parsed = json.loads(data)
                        if parsed.get("type") in ["done", "error"]:
                            logger.info(f"Stream completed for patient {patient_id} with type: {parsed.get('type')}")
                            break
                    except:
                        pass
                
                await asyncio.sleep(0.01)
        
        except asyncio.CancelledError:
            logger.info(f"Stream cancelled for patient {patient_id}")
        except Exception as e:
            logger.error(f"Stream error for patient {patient_id}: {e}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        finally:
            try:
                await pubsub.unsubscribe()
                await redis_client.aclose()
            except:
                pass
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
    )
