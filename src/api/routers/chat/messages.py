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

from src.models import get_db, Patient, MedicalRecord, ChatSession, ChatMessage, AsyncSessionLocal
from src.models.agent import SubAgent
from src.config.settings import load_config
from ...models import (
    ChatRequest, ChatResponse, ChatTaskResponse, TaskStatusResponse,
    FormResponseRequest,
)
from ...dependencies import get_or_create_agent
from ....tasks.agent_tasks import process_agent_message
from src.tools.form_request_registry import form_registry, current_session_id_var
from src.forms.vault import save_intake

logger = logging.getLogger(__name__)

# Load configuration
config = load_config()

router = APIRouter()


@router.post("/api/chat/{session_id}/form-response")
async def submit_form_response(session_id: int, body: FormResponseRequest):
    """Receive patient form submission and unblock the waiting ask_user tool.

    Validates the form_id, processes PII via the vault (for patient_intake),
    stores the opaque result, then fires the asyncio.Event so the tool returns.
    """
    template = form_registry.get_form_template(body.form_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Form not found or expired")

    if template == "patient_intake":
        try:
            patient_id, intake_id = await save_intake(body.answers)
            result = f"intake_completed. patient_id={patient_id}, intake_id={intake_id}"
        except Exception as e:
            logger.error("Vault save failed: %s", e, exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to save intake data")
    elif template == "confirm_visit":
        confirmed = body.answers.get("confirmed", "false").lower()
        result = "confirmed" if confirmed in ("true", "yes", "1") else "declined"
    else:
        raise HTTPException(status_code=400, detail=f"Unknown template: {template}")

    form_registry.resolve_form(body.form_id, result)
    return {"status": "ok"}


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
            # Look up agent by role if specified
            agent_id = None
            if request.agent_role:
                result = await db.execute(
                    select(SubAgent).where(SubAgent.role == request.agent_role)
                )
                agent = result.scalar_one_or_none()
                if agent:
                    agent_id = agent.id

            session = ChatSession(
                title=request.message[:50] + "..." if len(request.message) > 50 else request.message,
                agent_id=agent_id,
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

        # Get user-specific agent
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

        # Load session agent's system prompt if linked
        agent_system_prompt = None
        if session and session.agent_id:
            result = await db.execute(
                select(SubAgent).where(SubAgent.id == session.agent_id)
            )
            session_agent = result.scalar_one_or_none()
            if session_agent and session_agent.system_prompt:
                agent_system_prompt = session_agent.system_prompt

        # If streaming is requested
        if request.stream:
            async def generate():
                full_response = ""
                all_patient_references = []
                total_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
                tool_calls_buffer = []
                logs_buffer = []

                # --- form side-channel setup ---
                form_event_queue: asyncio.Queue = asyncio.Queue()
                form_registry.register_session_queue(session.id, form_event_queue)
                current_session_id_var.set(session.id)
                # --------------------------------

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
                            system_prompt_override=agent_system_prompt,
                        )
                        async for evt in stream:
                            await agent_event_queue.put(evt)
                        await agent_event_queue.put(None)  # sentinel

                    agent_task = asyncio.create_task(drain_agent())

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

                        # Process ALL completed tasks — done_set may contain more than
                        # one when both queues are ready in the same event loop turn.
                        agent_done = False
                        for completed_task in done_set:
                            event = completed_task.result()

                            if event is None:
                                agent_done = True
                                continue

                            # Form side-channel event — emit and continue
                            if isinstance(event, dict) and event.get("type") == "form_request":
                                yield f"data: {json.dumps({'form_request': event['payload']})}\n\n"
                                continue

                            # Regular agent events (unchanged logic)
                            if isinstance(event, dict):
                                if event["type"] == "content":
                                    chunk_content = event["content"]
                                    full_response += chunk_content
                                    yield f"data: {json.dumps({'chunk': chunk_content})}\n\n"
                                elif event["type"] == "tool_call":
                                    tool_calls_buffer.append(event)
                                    yield f"data: {json.dumps({'tool_call': event})}\n\n"
                                elif event["type"] == "tool_result":
                                    for tc in tool_calls_buffer:
                                        if tc.get("id") == event.get("id"):
                                            tc["result"] = event.get("result")
                                    logs_buffer.append({
                                        "timestamp": datetime.now(timezone.utc).isoformat(),
                                        "type": "tool_result",
                                        "content": event,
                                    })
                                    yield f"data: {json.dumps({'tool_result': event})}\n\n"
                                elif event["type"] == "reasoning":
                                    yield f"data: {json.dumps({'reasoning': event['content']})}\n\n"
                                elif event["type"] == "log":
                                    logs_buffer.append({
                                        "timestamp": datetime.now(timezone.utc).isoformat(),
                                        "type": "log",
                                        "content": event["content"],
                                    })
                                    yield f"data: {json.dumps({'log': event['content']})}\n\n"
                                elif event["type"] == "patient_references":
                                    all_patient_references = event["patient_references"]
                                    yield f"data: {json.dumps({'patient_references': event['patient_references']})}\n\n"
                                elif event["type"] == "usage":
                                    usage = event["usage"]
                                    total_usage["prompt_tokens"] += usage.get("prompt_tokens", 0)
                                    total_usage["completion_tokens"] += usage.get("completion_tokens", 0)
                                    total_usage["total_tokens"] += usage.get("total_tokens", 0)
                                    yield f"data: {json.dumps({'usage': event['usage']})}\n\n"
                            else:
                                full_response = event
                                yield f"data: {json.dumps({'chunk': event})}\n\n"

                        if agent_done:
                            break

                    if full_response or tool_calls_buffer:
                        async with AsyncSessionLocal() as local_db:
                            assistant_msg = ChatMessage(
                                session_id=session.id,
                                role="assistant",
                                content=full_response,
                                tool_calls=json.dumps(tool_calls_buffer) if tool_calls_buffer else None,
                                logs=json.dumps(logs_buffer) if logs_buffer else None,
                                patient_references=json.dumps(all_patient_references) if all_patient_references else None,
                                token_usage=json.dumps(total_usage) if total_usage["total_tokens"] > 0 else None,
                            )
                            local_db.add(assistant_msg)
                            await local_db.commit()

                    yield f"data: {json.dumps({'session_id': session.id})}\n\n"
                    yield f"data: {json.dumps({'done': True})}\n\n"

                except Exception as e:
                    async with AsyncSessionLocal() as local_db:
                        assistant_msg = ChatMessage(
                            session_id=session.id,
                            role="assistant",
                            content=full_response,
                            status="error",
                            error_message=str(e),
                            patient_references=json.dumps(all_patient_references) if all_patient_references else None,
                            token_usage=json.dumps(total_usage) if total_usage["total_tokens"] > 0 else None,
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
                system_prompt_override=agent_system_prompt,
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
            # Resolve agent_role to agent_id if specified
            agent_id = None
            if request.agent_role:
                result = await db.execute(
                    select(SubAgent).where(SubAgent.role == request.agent_role)
                )
                agent = result.scalar_one_or_none()
                if agent:
                    agent_id = agent.id

            # Create new session
            session = ChatSession(
                title=request.message[:50] + "..." if len(request.message) > 50 else request.message,
                agent_id=agent_id,
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
            agent_id=session.agent_id,
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
