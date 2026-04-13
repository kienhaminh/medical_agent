import asyncio
import os
import uuid
import json
import logging
from datetime import datetime, UTC
from fastapi import APIRouter, HTTPException, Depends, File, UploadFile, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import redis.asyncio as redis

from src.models import get_db, AsyncSessionLocal, Patient, MedicalRecord, Imaging, ImageGroup
from ...config.settings import load_config
from ...agent.stream_processor import StreamProcessor
from ...api.dependencies import get_agent
from ...utils.upload_storage import upload_bytes, patient_rel_path
from ..models import (
    PatientCreate, PatientResponse, PatientDetailResponse,
    RecordResponse, TextRecordCreate, HealthSummaryResponse,
    ImagingResponse, ImagingCreate, ImageGroupCreate, ImageGroupResponse
)
logger = logging.getLogger(__name__)

# Load configuration
config = load_config()


router = APIRouter()


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
            file_url = r.content  # content stores the Supabase URL

            # Extract title from summary if available
            if r.summary and "Title: " in r.summary:
                try:
                    title_part = r.summary.split("Title: ")[1].split(" |")[0]
                    title = title_part.strip()
                except IndexError:
                    title = r.record_type
            else:
                title = r.record_type
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
    """Upload a file record (Image/PDF) to Supabase Storage."""
    file_ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4()}{file_ext}"
    content_type = file.content_type or "application/octet-stream"
    record_type = "pdf" if content_type == "application/pdf" else "image"

    data = await file.read()
    rel_path = patient_rel_path(patient_id, filename)
    file_url = upload_bytes(rel_path, data, content_type)

    metadata_summary = f"Title: {title} | Type: {file_type} | Desc: {description or ''}"

    new_record = MedicalRecord(
        patient_id=patient_id,
        record_type=record_type,
        content=file_url,
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
        file_url=file_url,
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
    
    file_ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4()}{file_ext}"
    content_type = file.content_type or "application/octet-stream"

    data = await file.read()
    rel_path = patient_rel_path(patient_id, filename)
    file_url = upload_bytes(rel_path, data, content_type)

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
    
    await db.delete(record)
    await db.commit()
    return {"status": "ok", "message": "Record deleted"}


@router.delete("/api/patients/{patient_id}/imaging/{imaging_id}")
async def delete_imaging_record(
    patient_id: int, imaging_id: int, db: AsyncSession = Depends(get_db)
):
    """Delete an imaging record (Supabase Storage objects are retained)."""
    result = await db.execute(
        select(Imaging)
        .where(Imaging.id == imaging_id)
        .where(Imaging.patient_id == patient_id)
    )
    imaging = result.scalar_one_or_none()
    if not imaging:
        raise HTTPException(status_code=404, detail="Imaging record not found")

    await db.delete(imaging)
    await db.commit()
    return {"status": "ok", "message": "Imaging deleted"}


@router.post("/api/patients/{patient_id}/generate-summary", response_model=HealthSummaryResponse)
async def generate_health_summary(patient_id: int, db: AsyncSession = Depends(get_db)):
    """Dispatch background task to generate AI health summary for a patient.

    Returns immediately with task_id and status. Client should poll or stream
    for updates using the /api/patients/{patient_id}/summary-stream endpoint.
    """
    # 1. Verify patient exists
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # 2. Mark patient as pending and assign a task_id
    task_id = str(uuid.uuid4())
    patient.health_summary_status = "pending"
    patient.health_summary_task_id = task_id
    await db.commit()

    # 3. Dispatch asyncio background task
    asyncio.create_task(_generate_health_summary_background(patient_id=patient_id, task_id=task_id))

    return HealthSummaryResponse(
        patient_id=patient.id,
        health_summary=patient.health_summary or "",
        health_summary_updated_at=patient.health_summary_updated_at.isoformat() if patient.health_summary_updated_at else None,
        status=patient.health_summary_status or "pending",
        task_id=task_id
    )


async def _generate_health_summary_background(patient_id: int, task_id: str):
    """Background coroutine to generate patient health summary and publish via Redis."""
    redis_client = redis.from_url(config.redis_url)
    channel = f"patient:health_summary:{patient_id}"
    summary_content = ""

    last_save_time = datetime.now(UTC)
    chunk_count = 0
    SAVE_INTERVAL_SECONDS = 5
    SAVE_CHUNK_THRESHOLD = 20

    save_error = None

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Patient).where(Patient.id == patient_id))
            patient = result.scalar_one_or_none()
            if not patient:
                raise ValueError(f"Patient {patient_id} not found")

            patient.health_summary_status = "generating"
            await db.commit()
            await redis_client.publish(channel, json.dumps({"type": "status", "status": "generating"}))

            records_result = await db.execute(
                select(MedicalRecord)
                .where(MedicalRecord.patient_id == patient_id)
                .order_by(MedicalRecord.created_at.desc())
            )
            records = records_result.scalars().all()

            context_parts = [
                "Patient Information:",
                f"- Name: {patient.name}",
                f"- Date of Birth: {patient.dob}",
                f"- Gender: {patient.gender}",
                f"- Patient ID: {patient.id}",
                ""
            ]

            if records:
                context_parts.append(f"Medical Records ({len(records)} total):")
                for i, record in enumerate(records, 1):
                    context_parts.append(f"\n--- Record {i} ({record.record_type.upper()}) ---")
                    context_parts.append(f"Date: {record.created_at.strftime('%Y-%m-%d')}")
                    if record.summary:
                        context_parts.append(f"Summary: {record.summary}")
                    if record.record_type == "text" and record.content:
                        content = record.content[:2000] + "..." if len(record.content) > 2000 else record.content
                        context_parts.append(f"Content:\n{content}")
                    elif record.record_type in ["image", "pdf"]:
                        context_parts.append(f"File: {os.path.basename(record.content)}")
            else:
                context_parts.append("No medical records available.")

            patient_context = "\n".join(context_parts)

            prompt = f"""Based on the following patient information and medical records, generate a comprehensive AI Health Summary.

{patient_context}

---

Please generate a well-structured health summary in Markdown format that includes:
1. **Overall Health Status** - A brief assessment of the patient's current health state
2. **Key Health Indicators** - Important metrics and their status (if available from records)
3. **Active Concerns** - Any ongoing health issues or concerns noted in records
4. **Medical History Highlights** - Key points from the patient's medical history
5. **Preventive Care Status** - Status of screenings and preventive measures (if mentioned)
6. **Recommendations** - Suggested next steps or follow-up actions

If there is limited information available, acknowledge this and provide what summary is possible based on available data.
Be concise but thorough. Use bullet points and clear formatting."""

            agent = get_agent()
            stream = await agent.process_message(user_message=prompt, stream=True, chat_history=[])

            summary_processor = StreamProcessor()
            async for event in summary_processor.process(stream):
                if isinstance(event, dict) and event.get("type") == "content":
                    chunk_count += 1
                    summary_content = summary_processor.result.content

                    content_key = f"patient:health_summary:{patient_id}:content"
                    await redis_client.set(content_key, summary_content, ex=3600)
                    await redis_client.publish(channel, json.dumps({"type": "chunk", "content": event["content"]}))

                    time_since_last_save = (datetime.now(UTC) - last_save_time).total_seconds()
                    if time_since_last_save >= SAVE_INTERVAL_SECONDS or chunk_count >= SAVE_CHUNK_THRESHOLD:
                        try:
                            result = await db.execute(select(Patient).where(Patient.id == patient_id))
                            patient = result.scalar_one_or_none()
                            if patient:
                                patient.health_summary = summary_content
                                patient.health_summary_updated_at = datetime.now(UTC).replace(tzinfo=None)
                                await db.commit()
                            last_save_time = datetime.now(UTC)
                            chunk_count = 0
                        except Exception as save_ex:
                            logger.error(f"Incremental save failed for patient {patient_id}: {save_ex}")

                elif isinstance(event, dict) and event.get("type") in ("tool_call", "tool_result", "log"):
                    await redis_client.publish(channel, json.dumps(event))

            summary_content = summary_processor.result.content

        async with AsyncSessionLocal() as final_db:
            result = await final_db.execute(select(Patient).where(Patient.id == patient_id))
            patient = result.scalar_one_or_none()
            if patient:
                patient.health_summary = summary_content
                patient.health_summary_updated_at = datetime.now(UTC).replace(tzinfo=None)
                patient.health_summary_status = "completed"
                await final_db.commit()

        await redis_client.publish(channel, json.dumps({"type": "done"}))
        await redis_client.delete(f"patient:health_summary:{patient_id}:content")

    except Exception as e:
        save_error = e
        logger.error(f"Error generating health summary for patient {patient_id}: {e}", exc_info=True)
        try:
            async with AsyncSessionLocal() as error_db:
                result = await error_db.execute(select(Patient).where(Patient.id == patient_id))
                patient = result.scalar_one_or_none()
                if patient:
                    if summary_content:
                        patient.health_summary = summary_content
                        patient.health_summary_updated_at = datetime.now(UTC).replace(tzinfo=None)
                    patient.health_summary_status = "error"
                    await error_db.commit()
                await redis_client.delete(f"patient:health_summary:{patient_id}:content")
                await redis_client.publish(channel, json.dumps({"type": "error", "message": str(e)}))
        except Exception as final_error:
            logger.error(f"Failed to save error state for patient {patient_id}: {final_error}", exc_info=True)

    finally:
        await redis_client.aclose()


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
            from src.models import AsyncSessionLocal
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
                    except json.JSONDecodeError:
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
            except Exception:
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
