"""Chat message handling routes — main chat, send, task status, and message streaming."""
import os
import json
import asyncio
import logging
from datetime import datetime, timezone

import redis.asyncio as redis
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.models import get_db, Patient, MedicalRecord, ChatSession, ChatMessage, AsyncSessionLocal, VitalSign
from src.config.settings import load_config
from ...models import (
    ChatRequest, ChatResponse, ChatTaskResponse, TaskStatusResponse,
    FormResponseRequest,
)
from ...dependencies import get_or_create_agent, get_intake_agent
from ....tasks.agent_tasks import process_agent_message
from src.tools.form_request_registry import form_registry, current_session_id_var
from src.forms.vault import save_intake, identify_patient
from src.forms.field_classification import PII_FIELDS, SAFE_FIELDS, PATIENT_IDENTITY_FIELDS
from src.agent.stream_processor import StreamProcessor

logger = logging.getLogger(__name__)

# Load configuration
config = load_config()

router = APIRouter()


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
            # Persist patient_id for subsequent steps in this session.
            form_registry.accumulate_answers(session_id, {"__patient_id": str(patient_id)})
        except Exception as e:
            logger.error("identify_patient failed: %s", e, exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to identify patient")
    else:
        # Recover patient_id established in a previous step of this session.
        accumulated = form_registry.get_accumulated_answers(session_id)
        pid_str = accumulated.get("__patient_id")
        if pid_str:
            patient_id = int(pid_str)

    # --- Step 2: create VitalSign when height/weight are provided ---
    height_cm_str = answers.get("height_cm", "").strip()
    weight_kg_str = answers.get("weight_kg", "").strip()
    if patient_id and (height_cm_str or weight_kg_str):
        try:
            async with AsyncSessionLocal() as db:
                vital = VitalSign(
                    patient_id=patient_id,
                    recorded_at=datetime.now(timezone.utc),
                    height_cm=float(height_cm_str) if height_cm_str else None,
                    weight_kg=float(weight_kg_str) if weight_kg_str else None,
                )
                db.add(vital)
                await db.commit()
            result_parts.append("vitals_recorded=true")
        except Exception as e:
            logger.error("VitalSign creation failed: %s", e, exc_info=True)

    # --- Step 3: persist intake data ---
    pii_answers = {k: v for k, v in answers.items() if k in PII_FIELDS}
    has_clinical = bool(answers.get("chief_complaint") or answers.get("symptoms"))

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
            user_agent = get_or_create_agent(request.user_id)

        # Fetch patient info if provided
        patient = None
        context_message = request.message
        if request.patient_id:
            # Fetch patient info
            result = await db.execute(select(Patient).where(Patient.id == request.patient_id))
            patient = result.scalar_one_or_none()
            if patient:
                context_message = f"Context: Patient {patient.name} (DOB: {patient.dob}, Gender: {patient.gender}).\n\n"

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
    then processes the message in the background via Celery.

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

        # 4. Dispatch Celery Task
        task = process_agent_message.delay(
            session_id=session.id,
            message_id=assistant_msg.id,
            user_id=request.user_id or "default",
            user_message=request.message,
            patient_id=request.patient_id,
            record_id=request.record_id,
        )

        # 5. Update assistant message with task_id
        assistant_msg.task_id = task.id
        await db.commit()

        return ChatTaskResponse(
            task_id=task.id,
            message_id=assistant_msg.id,
            session_id=session.id,
            status="pending"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/chat/tasks/{task_id}/status", response_model=TaskStatusResponse)
async def get_task_status(task_id: str, db: AsyncSession = Depends(get_db)):
    """Get status of a Celery task.

    Args:
        task_id: Celery task ID

    Returns:
        TaskStatusResponse with task status and message preview
    """
    try:
        from celery.result import AsyncResult
        from ....tasks import celery_app

        # Get task result from Celery
        task_result = AsyncResult(task_id, app=celery_app)

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

        return TaskStatusResponse(
            task_id=task_id,
            status=task_result.status,  # PENDING, STARTED, SUCCESS, FAILURE, RETRY
            message_id=message.id,
            content_preview=content_preview,
            error=message.error_message,
            result=task_result.result if task_result.successful() else None
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting task status: {str(e)}")


@router.get("/api/chat/messages/{message_id}/stream")
async def stream_message_updates(message_id: int, db: AsyncSession = Depends(get_db)):
    """Stream updates for a specific message via Server-Sent Events.

    Uses Redis Pub/Sub for real-time updates from background tasks.
    Falls back to DB check if task is already completed.

    Args:
        message_id: Message ID to stream updates for

    Returns:
        StreamingResponse with SSE updates
    """
    logger.info(f"Starting stream for message {message_id}")

    async def generate():
        logger.info(f"Inside generate for message {message_id}")
        try:
            # Initialize Redis
            redis_client = redis.from_url(config.redis_url)
            pubsub = redis_client.pubsub()

            # 1. Subscribe to Redis channel FIRST to avoid missing events
            channel = f"chat:message:{message_id}"
            logger.info(f"Subscribing to Redis channel: {channel}")
            await pubsub.subscribe(channel)
            logger.info(f"Subscribed to {channel}")

            logger.info(f"Checking DB for message {message_id}")
            # 2. Check initial state from DB
            async with AsyncSessionLocal() as local_db:
                result = await local_db.execute(
                    select(ChatMessage).where(ChatMessage.id == message_id)
                )
                message = result.scalar_one_or_none()

                if not message:
                    logger.error(f"Message {message_id} not found in DB")
                    await pubsub.unsubscribe()
                    yield f"data: {json.dumps({'error': 'Message not found'})}\n\n"
                    return

                logger.info(f"Message {message_id} found with status: {message.status}")

                # If already completed/error, send final state and exit
                if message.status in ['completed', 'error', 'interrupted']:
                    await pubsub.unsubscribe()
                    yield f"data: {json.dumps({
                        'type': 'status',
                        'status': message.status,
                        'content': message.content,
                        'tool_calls': json.loads(message.tool_calls) if message.tool_calls else None,
                        'reasoning': message.reasoning,
                        'logs': json.loads(message.logs) if message.logs else None,
                        'patient_references': json.loads(message.patient_references) if message.patient_references else None,
                        'error_message': message.error_message,
                        'usage': json.loads(message.token_usage) if message.token_usage else None
                    })}\n\n"
                    yield f"data: {json.dumps({'type': 'done'})}\n\n"
                    return

                # Send current content if any (for resuming)
                if message.content:
                    yield f"data: {json.dumps({
                        'type': 'status',
                        'status': message.status,
                        'content': message.content
                    })}\n\n"

            # Send a test event to verify stream is working
            test_event = json.dumps({'type': 'status', 'status': 'connected'})
            logger.info(f"Sending test event: {test_event}")
            yield f"data: {test_event}\n\n"

            # 3. Stream events
            logger.info(f"Starting event loop for message {message_id}")
            event_count = 0
            while True:
                message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)

                if message:
                    event_count += 1
                    logger.info(f"Received Redis message #{event_count}: {message}")
                    data = message['data']
                    if isinstance(data, bytes):
                        data = data.decode('utf-8')

                    # Yield the raw event data (it's already JSON from agent_tasks)
                    logger.info(f"Yielding event #{event_count}: {data[:100]}...")
                    yield f"data: {data}\n\n"

                    # Check for completion signal
                    try:
                        parsed = json.loads(data)
                        if parsed.get("type") in ["done", "error"]:
                            logger.info(f"Stream completed for message {message_id} with type: {parsed.get('type')}")
                            break
                    except Exception:
                        pass

                await asyncio.sleep(0.01)

        except asyncio.CancelledError:
            logger.info(f"Stream cancelled for message {message_id}")
        except Exception as e:
            logger.error(f"Stream error for message {message_id}: {e}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        finally:
            logger.info(f"Cleaning up stream for message {message_id}")
            try:
                await pubsub.unsubscribe()
                await redis_client.aclose()
            except Exception as e:
                logger.error(f"Error during cleanup: {e}")

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
    )
