"""Chat message handling routes — main chat, send, task status, and message streaming."""
import os
import json
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.models import get_db, Patient, MedicalRecord, ChatSession, ChatMessage, AsyncSessionLocal, VitalSign
from src.models.imaging import Imaging
from src.models.visit import Visit as VisitModel
from src.config.settings import load_config
from ...models import (
    ChatRequest, ChatResponse, ChatTaskResponse, TaskStatusResponse,
    FormResponseRequest,
)
from ...dependencies import get_agent, get_intake_agent
from src.tools.form_request_registry import form_registry, current_session_id_var
from src.forms.vault import save_intake, identify_patient
from src.forms.field_classification import PII_FIELDS, SAFE_FIELDS, PATIENT_IDENTITY_FIELDS
from src.agent.stream_processor import StreamProcessor
from . import broadcast

logger = logging.getLogger(__name__)
config = load_config()

router = APIRouter()


async def _update_message_db(db, message_id: int, result) -> None:
    """Persist incremental streaming content to the DB."""
    db_result = await db.execute(select(ChatMessage).where(ChatMessage.id == message_id))
    message = db_result.scalar_one_or_none()
    if message:
        message.content = result.content
        message.tool_calls = result.tool_calls_json()
        message.reasoning = result.reasoning if result.reasoning else None
        message.logs = result.logs_json()
        message.token_usage = result.usage_json()
        message.last_updated_at = datetime.now(timezone.utc).replace(tzinfo=None).replace(tzinfo=None)
        await db.commit()


async def _run_agent_background(
    message_id: int,
    session_id: int,
    user_id: str,
    user_message: str,
    patient_id: Optional[int] = None,
    record_id: Optional[int] = None,
    visit_id: Optional[int] = None,
) -> None:
    """Run agent in an asyncio background task.

    Publishes streaming events via the in-memory broadcast bus.
    Saves content incrementally to the DB so reconnecting clients
    can resume from current partial content.
    """
    processor = StreamProcessor()
    last_save_time = datetime.now(timezone.utc).replace(tzinfo=None)
    chunk_count = 0
    SAVE_INTERVAL_SECONDS = 5
    SAVE_CHUNK_THRESHOLD = 50

    try:
        async with AsyncSessionLocal() as db:
            # Mark message as streaming
            result = await db.execute(select(ChatMessage).where(ChatMessage.id == message_id))
            message = result.scalar_one_or_none()
            if not message:
                raise ValueError(f"Message {message_id} not found")
            message.status = "streaming"
            message.streaming_started_at = datetime.now(timezone.utc).replace(tzinfo=None)
            message.last_updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
            await db.commit()

            await broadcast.publish(message_id, {"type": "status", "status": "streaming"})

            # Build context message
            context_message = user_message
            if patient_id:
                result = await db.execute(select(Patient).where(Patient.id == patient_id))
                patient = result.scalar_one_or_none()
                if patient:
                    context_message = (
                        f"Context: Patient {patient.name} "
                        f"(DOB: {patient.dob}, Gender: {patient.gender}, patient_id={patient.id}"
                    )
                    if visit_id:
                        visit_result = await db.execute(
                            select(VisitModel).where(VisitModel.id == visit_id)
                        )
                        visit = visit_result.scalar_one_or_none()
                        if visit:
                            context_message += (
                                f", visit_id={visit.id}, chief_complaint=\"{visit.chief_complaint}\""
                            )
                    context_message += ").\n\n"
                    imaging_result = await db.execute(
                        select(Imaging).where(Imaging.patient_id == patient.id).order_by(Imaging.created_at.asc())
                    )
                    bg_imaging = imaging_result.scalars().all()
                    if bg_imaging:
                        imaging_lines = ", ".join(
                            f"imaging_id={img.id} ({img.image_type})" for img in bg_imaging
                        )
                        context_message += f"Patient Imaging: [{imaging_lines}].\n"
                    if record_id:
                        result = await db.execute(
                            select(MedicalRecord).where(MedicalRecord.id == record_id)
                        )
                        record = result.scalar_one_or_none()
                        if record:
                            context_message += f"Focus Record: {record.record_type}\n"
                            if record.record_type == "text":
                                context_message += f"Content: {record.content}\n"
                            elif record.record_type in ("image", "pdf"):
                                context_message += f"File: {record.content}\n"
                                if record.summary:
                                    context_message += f"Metadata: {record.summary}\n"
                    context_message += f"User Query: {user_message}"

            # Load chat history
            stmt = (
                select(ChatMessage)
                .where(ChatMessage.session_id == session_id)
                .order_by(ChatMessage.created_at)
            )
            result = await db.execute(stmt)
            chat_history = [
                {"role": m.role, "content": m.content}
                for m in result.scalars().all()
                if m.id != message_id and m.content and m.content.strip()
            ]

            # Run agent
            user_agent = get_agent()
            stream = await user_agent.process_message(
                user_message=context_message.strip(),
                stream=True,
                chat_history=chat_history,
            )

            async for event in processor.process(stream):
                chunk_count += 1
                if isinstance(event, dict):
                    await broadcast.publish(message_id, event)

                elapsed = (datetime.now(timezone.utc).replace(tzinfo=None) - last_save_time).total_seconds()
                if elapsed >= SAVE_INTERVAL_SECONDS or chunk_count >= SAVE_CHUNK_THRESHOLD:
                    await _update_message_db(db, message_id, processor.result)
                    last_save_time = datetime.now(timezone.utc).replace(tzinfo=None)
                    chunk_count = 0

            # Final save
            r = processor.result
            result = await db.execute(select(ChatMessage).where(ChatMessage.id == message_id))
            message = result.scalar_one_or_none()
            if message:
                message.content = r.content
                message.tool_calls = r.tool_calls_json()
                message.reasoning = r.reasoning if r.reasoning else None
                message.logs = r.logs_json()
                message.token_usage = r.usage_json()
                message.status = "completed"
                message.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
                message.last_updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
                await db.commit()

            await broadcast.publish(message_id, {"type": "done"})

    except asyncio.CancelledError:
        await broadcast.publish(message_id, {"type": "error", "message": "Task cancelled"})
        async with AsyncSessionLocal() as err_db:
            r = processor.result
            result = await err_db.execute(select(ChatMessage).where(ChatMessage.id == message_id))
            msg = result.scalar_one_or_none()
            if msg:
                msg.content = r.content
                msg.status = "interrupted"
                msg.error_message = "Task cancelled"
                msg.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
                await err_db.commit()
        raise

    except Exception as e:
        logger.error("Background agent task failed for message %d: %s", message_id, e, exc_info=True)
        await broadcast.publish(message_id, {"type": "error", "message": str(e)})
        async with AsyncSessionLocal() as err_db:
            r = processor.result
            result = await err_db.execute(select(ChatMessage).where(ChatMessage.id == message_id))
            msg = result.scalar_one_or_none()
            if msg:
                msg.content = r.content
                msg.status = "error"
                msg.error_message = str(e)
                msg.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
                await err_db.commit()


@router.post("/api/chat/{session_id}/form-response")
async def submit_form_response(session_id: int, body: FormResponseRequest):
    """Receive patient form submission and unblock the waiting ask_user tool.

    Validates the form_id, processes PII via the vault (for patient_intake),
    stores the opaque result, then fires the asyncio.Event so the tool returns.

    Note: session_id is included in the path for REST semantics but is not used
    to authorize the form lookup. Security relies on the unguessability of the
    uuid4 form_id. Future hardening: validate form belongs to this session.
    """
    template = form_registry.get_form_template(body.form_id)
    if template is None:
        # Form expired from in-memory registry (e.g. server restart).
        # Fall back to template sent by frontend so data is not lost.
        template = body.template
        if template is None:
            raise HTTPException(status_code=404, detail="Form not found or expired")
        logger.warning(
            "form_id=%s expired from registry; using fallback template=%s",
            body.form_id, template,
        )

    if template == "identify_patient":
        # Step 1: Look up or create patient from name + DOB
        try:
            form_registry.accumulate_answers(session_id, body.answers)
            patient_id, is_new = await identify_patient(body.answers)
            if is_new:
                result = f"patient_not_found. Created new patient_id={patient_id}. This is their first visit — collect contact, insurance, and emergency contact details next."
            else:
                result = f"patient_found. patient_id={patient_id}. This is a returning patient — skip to visit details."
        except Exception as e:
            logger.error("identify_patient failed: %s", e, exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to identify patient")

    elif template == "new_patient_details":
        # Step 2 (new patients): Accumulate contact/insurance/emergency info
        form_registry.accumulate_answers(session_id, body.answers)
        result = "details_collected. Proceed to collect visit details."

    elif template == "visit_details":
        # Step 3: Accumulate visit info, then flush everything to IntakeSubmission
        form_registry.accumulate_answers(session_id, body.answers)
        all_answers = form_registry.get_accumulated_answers(session_id)
        try:
            patient_id, intake_id = await save_intake(all_answers)
            form_registry.clear_accumulated_answers(session_id)
            result = f"intake_completed. patient_id={patient_id}, intake_id={intake_id}"
        except Exception as e:
            logger.error("save_intake failed: %s", e, exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to save intake data")

    elif template == "patient_intake":
        # Legacy single-form flow
        try:
            patient_id, intake_id = await save_intake(body.answers)
            result = f"intake_completed. patient_id={patient_id}, intake_id={intake_id}"
        except Exception as e:
            logger.error("Vault save failed: %s", e, exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to save intake data")

    elif template == "confirm_visit":
        confirmed = body.answers.get("confirmed", "false").lower()
        result = "confirmed" if confirmed in ("true", "yes", "1") else "declined"

    elif template == "_dynamic_input":
        result = await _process_dynamic_input(session_id, body.answers)

    elif template == "_dynamic_question":
        # Choices are agent-defined strings — return as-is, no PII concerns.
        choice = body.answers.get("choice", "")
        choices = body.answers.get("choices", "")
        result = choices if choices else choice

    else:
        raise HTTPException(status_code=400, detail=f"Unknown template: {template}")

    form_registry.resolve_form(body.form_id, result)
    return {"status": "ok"}


async def _process_dynamic_input(session_id: int, answers: dict[str, str]) -> str:
    """Process a dynamically generated form submission.

    Classifies fields as PII or safe, stores PII in the vault,
    threads patient_id across multi-step forms via the session accumulator,
    creates a VitalSign when height/weight are present, and returns
    opaque IDs + safe field values to the agent.
    """
    result_parts: list[str] = []

    # --- Step 1: resolve patient identity ---
    has_identity = PATIENT_IDENTITY_FIELDS.issubset(answers.keys())
    patient_id: int | None = None

    if has_identity:
        try:
            patient_id, is_new = await identify_patient(answers)
            result_parts.append(f"patient_id={patient_id}")
            result_parts.append(f"is_new={'true' if is_new else 'false'}")
            # Persist patient_id and phone for subsequent steps in this session.
            form_registry.accumulate_answers(session_id, {
                "__patient_id": str(patient_id),
                "__phone": answers.get("phone", ""),
            })
        except Exception as e:
            logger.error("identify_patient failed: %s", e, exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to identify patient")
    else:
        # Recover patient_id (and phone) established in a previous step of this session.
        accumulated = form_registry.get_accumulated_answers(session_id)
        pid_str = accumulated.get("__patient_id")
        if pid_str:
            patient_id = int(pid_str)
        # Inject phone so save_intake can populate the non-nullable column.
        if "__phone" in accumulated and "phone" not in answers:
            answers = {**answers, "phone": accumulated["__phone"]}

    # --- Step 2: create VitalSign when height/weight are provided ---
    height_cm_str = answers.get("height_cm", "").strip()
    weight_kg_str = answers.get("weight_kg", "").strip()
    if patient_id and (height_cm_str or weight_kg_str):
        try:
            height_cm_val = float(height_cm_str) if height_cm_str else None
        except ValueError:
            logger.warning("Invalid height_cm value (not numeric): %r — skipping", height_cm_str)
            height_cm_val = None
        try:
            weight_kg_val = float(weight_kg_str) if weight_kg_str else None
        except ValueError:
            logger.warning("Invalid weight_kg value (not numeric): %r — skipping", weight_kg_str)
            weight_kg_val = None
        if height_cm_val is not None or weight_kg_val is not None:
            try:
                async with AsyncSessionLocal() as db:
                    vital = VitalSign(
                        patient_id=patient_id,
                        recorded_at=datetime.now(timezone.utc).replace(tzinfo=None),
                        height_cm=height_cm_val,
                        weight_kg=weight_kg_val,
                    )
                    db.add(vital)
                    await db.commit()
                result_parts.append("vitals_recorded=true")
            except Exception as e:
                logger.error("VitalSign creation failed: %s", e, exc_info=True)

    # --- Step 3: persist intake data ---
    pii_answers = {k: v for k, v in answers.items() if k in PII_FIELDS}
    has_clinical = bool(answers.get("chief_complaint"))

    # Call save_intake when:
    # - Step 1 (identity present + PII fields), OR
    # - Step 2 (patient already known from session + clinical fields present)
    if (pii_answers and has_identity) or (patient_id and not has_identity and has_clinical):
        try:
            _pid, intake_id = await save_intake(answers, patient_id=patient_id)
            result_parts.append(f"intake_id={intake_id}")
        except Exception as e:
            logger.error("save_intake failed: %s", e, exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to save intake data")

    # --- Step 4: return safe field values to agent ---
    safe_answers = {k: v for k, v in answers.items() if k in SAFE_FIELDS}
    for k, v in safe_answers.items():
        result_parts.append(f"{k}={v}")

    # Note any unknown fields collected (values NOT returned).
    unknown = {
        k for k in answers
        if k not in PII_FIELDS and k not in SAFE_FIELDS and not k.startswith("__")
    }
    if unknown:
        result_parts.append(f"additional_fields_collected={','.join(sorted(unknown))}")

    prefix = "form_completed"
    return f"{prefix}. {', '.join(result_parts)}" if result_parts else "form_completed."


@router.post("/api/chat")
async def chat(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    """Chat endpoint with streaming support and patient context.

    Args:
        request: Chat request with message, user_id, and optional stream flag

    Returns:
        StreamingResponse for streaming, ChatResponse for non-streaming
    """
    try:
        if not request.message or not request.message.strip():
            raise HTTPException(status_code=400, detail="Message cannot be empty")

        # 1. Manage Chat Session
        session = None
        if request.session_id:
            result = await db.execute(select(ChatSession).where(ChatSession.id == request.session_id))
            session = result.scalar_one_or_none()

        if not session:
            session = ChatSession(
                title=request.message[:50] + "..." if len(request.message) > 50 else request.message,
            )
            db.add(session)
            await db.commit()
            await db.refresh(session)

        # 2. Save User Message
        user_msg = ChatMessage(
            session_id=session.id,
            role="user",
            content=request.message
        )
        db.add(user_msg)
        await db.commit()

        # Select agent based on mode
        if request.mode == "intake":
            user_agent = get_intake_agent()
        else:
            user_agent = get_agent()

        # Fetch patient info if provided
        patient = None
        context_message = request.message
        if request.patient_id:
            # Fetch patient info
            result = await db.execute(select(Patient).where(Patient.id == request.patient_id))
            patient = result.scalar_one_or_none()
            if patient:
                context_message = f"Context: Patient {patient.name} (DOB: {patient.dob}, Gender: {patient.gender}, patient_id={patient.id}).\n\n"

                imaging_result = await db.execute(
                    select(Imaging).where(Imaging.patient_id == patient.id).order_by(Imaging.created_at.asc())
                )
                patient_imaging = imaging_result.scalars().all()
                if patient_imaging:
                    imaging_lines = ", ".join(
                        f"imaging_id={img.id} ({img.image_type})" for img in patient_imaging
                    )
                    context_message += f"Patient Imaging: [{imaging_lines}].\n"

                if request.record_id:
                    # Fetch specific record
                    result = await db.execute(select(MedicalRecord).where(MedicalRecord.id == request.record_id))
                    record = result.scalar_one_or_none()
                    if record:
                        context_message += f"Focus Record: {record.record_type}\n"
                        if record.record_type == "text":
                            context_message += f"Content: {record.content}\n"
                        elif record.record_type == "image":
                            context_message += f"Image File: {os.path.basename(record.content)}\n"
                            context_message += f"Metadata: {record.summary}\n"
                        elif record.record_type == "pdf":
                            context_message += f"PDF File: {os.path.basename(record.content)}\n"
                            context_message += f"Metadata: {record.summary}\n"

                context_message += f"User Query: {request.message}"

        # For intake sessions, inject visit context so the agent retains visit/patient IDs
        # across separate requests (tool call results are not preserved in chat history).
        if request.mode == "intake" and session:
            visit_result = await db.execute(
                select(VisitModel).where(VisitModel.intake_session_id == session.id)
            )
            intake_visit = visit_result.scalar_one_or_none()
            if intake_visit:
                context_message = (
                    f"[Session context: Visit DB ID={intake_visit.id}, "
                    f"Visit ID={intake_visit.visit_id}, "
                    f"patient_id={intake_visit.patient_id}]\n\n"
                ) + context_message

        # Load chat history if session exists
        chat_history = []
        if session:
            stmt = select(ChatMessage).where(ChatMessage.session_id == session.id).order_by(ChatMessage.created_at)
            result = await db.execute(stmt)
            existing_messages = result.scalars().all()

            # Convert database messages to chat history format
            # Exclude the current user message we just saved
            for msg in existing_messages:
                if msg.id != user_msg.id:  # Skip the message we just added
                    chat_history.append({
                        "role": msg.role,
                        "content": msg.content
                    })

        # If streaming is requested
        if request.stream:
            async def generate():
                processor = StreamProcessor()

                # --- form side-channel setup ---
                form_event_queue: asyncio.Queue = asyncio.Queue()
                form_registry.register_session_queue(session.id, form_event_queue)
                current_session_id_var.set(session.id)
                # --------------------------------

                # Emit session_id early so the frontend has it before any
                # mid-stream events (e.g. form_request) that depend on it.
                yield f"data: {json.dumps({'session_id': session.id})}\n\n"

                try:
                    # Drain the agent stream into a queue so we can race it
                    # against the form side-channel.
                    agent_event_queue: asyncio.Queue = asyncio.Queue()

                    async def drain_agent():
                        stream = await user_agent.process_message(
                            user_message=context_message.strip(),
                            stream=True,
                            chat_history=chat_history,
                            patient_id=patient.id if patient else None,
                            patient_name=patient.name if patient else None,
                        )
                        async for evt in stream:
                            await agent_event_queue.put(evt)
                        await agent_event_queue.put(None)  # sentinel

                    agent_task = asyncio.create_task(drain_agent())

                    # Merge agent + form queues into a single async generator
                    # so StreamProcessor can consume it.
                    async def merged_events():
                        while True:
                            get_agent = asyncio.create_task(agent_event_queue.get())
                            get_form = asyncio.create_task(form_event_queue.get())

                            done_set, pending_set = await asyncio.wait(
                                {get_agent, get_form},
                                return_when=asyncio.FIRST_COMPLETED,
                            )
                            for t in pending_set:
                                t.cancel()
                                try:
                                    await t
                                except asyncio.CancelledError:
                                    pass

                            for completed_task in done_set:
                                event = completed_task.result()
                                if event is None:
                                    return  # agent done
                                yield event

                    # SSE event name mapping
                    SSE_KEYS = {
                        "content": "chunk",
                        "tool_call": "tool_call",
                        "tool_result": "tool_result",
                        "reasoning": "reasoning",
                        "log": "log",
                        "usage": "usage",
                    }

                    async for event in processor.process(merged_events()):
                        if isinstance(event, dict) and event.get("type") == "form_request":
                            yield f"data: {json.dumps({'form_request': event['payload']})}\n\n"
                            continue

                        if isinstance(event, dict):
                            etype = event.get("type")
                            sse_key = SSE_KEYS.get(etype)
                            if sse_key:
                                # content → {"chunk": "text"}, others → {"tool_call": {...}}
                                payload = event["content"] if etype in ("content", "reasoning", "log") else event
                                yield f"data: {json.dumps({sse_key: payload})}\n\n"
                        else:
                            yield f"data: {json.dumps({'chunk': event})}\n\n"

                    r = processor.result
                    if r.content or r.tool_calls:
                        async with AsyncSessionLocal() as local_db:
                            assistant_msg = ChatMessage(
                                session_id=session.id,
                                role="assistant",
                                content=r.content,
                                tool_calls=r.tool_calls_json(),
                                logs=r.logs_json(),
                                token_usage=r.usage_json(),
                            )
                            local_db.add(assistant_msg)
                            await local_db.commit()

                    yield f"data: {json.dumps({'session_id': session.id})}\n\n"
                    yield f"data: {json.dumps({'done': True})}\n\n"

                except Exception as e:
                    r = processor.result
                    async with AsyncSessionLocal() as local_db:
                        assistant_msg = ChatMessage(
                            session_id=session.id,
                            role="assistant",
                            content=r.content,
                            status="error",
                            error_message=str(e),
                            token_usage=r.usage_json(),
                        )
                        local_db.add(assistant_msg)
                        await local_db.commit()
                    yield f"data: {json.dumps({'error': str(e)})}\n\n"

                finally:
                    agent_task.cancel()
                    try:
                        await agent_task
                    except asyncio.CancelledError:
                        pass
                    form_registry.unregister_session_queue(session.id)

            return StreamingResponse(generate(), media_type="text/event-stream")
        else:
            # Non-streaming response (await the async call)
            response = await user_agent.process_message(
                user_message=context_message.strip(),
                stream=False,
                chat_history=chat_history,
                patient_id=patient.id if patient else None,
                patient_name=patient.name if patient else None,
            )

            # 3. Save Assistant Message
            assistant_msg = ChatMessage(
                session_id=session.id,
                role="assistant",
                content=response
            )
            db.add(assistant_msg)
            await db.commit()

            return ChatResponse(
                content=response,
                timestamp="",  # TODO: Add timestamp
                user_id=request.user_id,
                session_id=session.id
            )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/chat/send", response_model=ChatTaskResponse)
async def send_chat_message(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    """Send chat message and dispatch background task for processing.

    This endpoint immediately returns a task_id and message_id,
    then processes the message in the background via an asyncio task.

    Args:
        request: Chat request with message, user_id, and optional context

    Returns:
        ChatTaskResponse with task_id, message_id, and session_id
    """
    try:
        if not request.message or not request.message.strip():
            raise HTTPException(status_code=400, detail="Message cannot be empty")

        # 1. Manage Chat Session
        session = None
        if request.session_id:
            result = await db.execute(select(ChatSession).where(ChatSession.id == request.session_id))
            session = result.scalar_one_or_none()

        if not session:
            # Create new session
            session = ChatSession(
                title=request.message[:50] + "..." if len(request.message) > 50 else request.message,
            )
            db.add(session)
            await db.commit()
            await db.refresh(session)

        # 2. Save User Message
        user_msg = ChatMessage(
            session_id=session.id,
            role="user",
            content=request.message,
            status="completed"  # User messages are always completed
        )
        db.add(user_msg)
        await db.commit()
        await db.refresh(user_msg)

        # 3. Create Assistant Message with status='pending'
        assistant_msg = ChatMessage(
            session_id=session.id,
            role="assistant",
            content="",  # Will be filled by background task
            status="pending"
        )
        db.add(assistant_msg)
        await db.commit()
        await db.refresh(assistant_msg)

        # 4. Dispatch asyncio background task
        bg_task = asyncio.create_task(_run_agent_background(
            message_id=assistant_msg.id,
            session_id=session.id,
            user_id=request.user_id or "default",
            user_message=request.message,
            patient_id=request.patient_id,
            record_id=request.record_id,
            visit_id=request.visit_id,
        ))
        broadcast.register_task(assistant_msg.id, bg_task)

        # 5. Record pseudo task_id (message_id used as identifier)
        assistant_msg.task_id = str(assistant_msg.id)
        await db.commit()

        return ChatTaskResponse(
            task_id=str(assistant_msg.id),
            message_id=assistant_msg.id,
            session_id=session.id,
            status="pending"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/chat/tasks/{task_id}/status", response_model=TaskStatusResponse)
async def get_task_status(task_id: str, db: AsyncSession = Depends(get_db)):
    """Get status of a background task by looking up the message in DB.

    Args:
        task_id: Task ID (equals message_id as string)

    Returns:
        TaskStatusResponse with task status and message preview
    """
    try:
        # Find message by task_id
        stmt = select(ChatMessage).where(ChatMessage.task_id == task_id)
        result = await db.execute(stmt)
        message = result.scalar_one_or_none()

        if not message:
            raise HTTPException(status_code=404, detail="Message not found for this task")

        # Get content preview
        content_preview = None
        if message.content:
            content_preview = message.content[:100] + "..." if len(message.content) > 100 else message.content

        status_map = {
            "pending": "PENDING",
            "streaming": "STARTED",
            "completed": "SUCCESS",
            "error": "FAILURE",
            "interrupted": "FAILURE",
        }
        task_status = status_map.get(message.status or "pending", "PENDING")

        return TaskStatusResponse(
            task_id=task_id,
            status=task_status,
            message_id=message.id,
            content_preview=content_preview,
            error=message.error_message,
            result=message.content if message.status == "completed" else None
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting task status: {str(e)}")


@router.post("/api/chat/messages/{message_id}/cancel")
async def cancel_message(message_id: int, db: AsyncSession = Depends(get_db)):
    """Cancel a running background agent task for a message."""
    cancelled = broadcast.cancel_task(message_id)

    # Mark message as interrupted in DB regardless of whether task was found
    # (it may have already completed but the client doesn't know yet)
    async with AsyncSessionLocal() as cancel_db:
        result = await cancel_db.execute(select(ChatMessage).where(ChatMessage.id == message_id))
        msg = result.scalar_one_or_none()
        if msg and msg.status not in ("completed", "error", "interrupted"):
            msg.status = "interrupted"
            msg.error_message = "Cancelled by user"
            msg.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
            await cancel_db.commit()

    # Notify subscribers so the SSE stream closes
    await broadcast.publish(message_id, {"type": "done"})

    return {"cancelled": cancelled, "message_id": message_id}


@router.get("/api/chat/messages/{message_id}/stream")
async def stream_message_updates(message_id: int, db: AsyncSession = Depends(get_db)):
    """Stream updates for a specific message via Server-Sent Events.

    Uses in-memory broadcast for real-time updates from background tasks.
    Falls back to DB state if the task already completed.
    """
    logger.info("Starting stream for message %d", message_id)

    async def generate():
        # 1. Check initial DB state
        async with AsyncSessionLocal() as local_db:
            result = await local_db.execute(
                select(ChatMessage).where(ChatMessage.id == message_id)
            )
            message = result.scalar_one_or_none()

            if not message:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Message not found'})}\n\n"
                return

            # Already finished — return final state and close
            if message.status in ("completed", "error", "interrupted"):
                yield f"data: {json.dumps({'type': 'status', 'status': message.status, 'content': message.content, 'tool_calls': json.loads(message.tool_calls) if message.tool_calls else None, 'reasoning': message.reasoning, 'logs': json.loads(message.logs) if message.logs else None, 'patient_references': json.loads(message.patient_references) if message.patient_references else None, 'error_message': message.error_message, 'usage': json.loads(message.token_usage) if message.token_usage else None})}\n\n"
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                return

            # Send current partial content so reconnecting clients resume visually
            if message.content:
                yield f"data: {json.dumps({'type': 'status', 'status': message.status, 'content': message.content})}\n\n"

        # 2. Subscribe to in-memory broadcast
        queue = broadcast.subscribe(message_id)
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield f"data: {json.dumps(event)}\n\n"
                    if event.get("type") in ("done", "error"):
                        break
                except asyncio.TimeoutError:
                    # Keepalive + DB fallback check in case we missed the done event
                    async with AsyncSessionLocal() as check_db:
                        result = await check_db.execute(
                            select(ChatMessage).where(ChatMessage.id == message_id)
                        )
                        msg = result.scalar_one_or_none()
                        if msg and msg.status in ("completed", "error", "interrupted"):
                            yield f"data: {json.dumps({'type': 'done'})}\n\n"
                            break
                    yield f"data: {json.dumps({'type': 'keepalive'})}\n\n"

        except asyncio.CancelledError:
            logger.info("Stream cancelled for message %d", message_id)
        except Exception as e:
            logger.error("Stream error for message %d: %s", message_id, e, exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        finally:
            broadcast.unsubscribe(message_id, queue)

    return StreamingResponse(generate(), media_type="text/event-stream")
