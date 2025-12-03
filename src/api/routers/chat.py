import os
import json
import logging
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select


import redis.asyncio as redis

logger = logging.getLogger(__name__)

from src.config.database import get_db, Patient, MedicalRecord, ChatSession, ChatMessage, AsyncSessionLocal
from src.config.settings import load_config
from ..models import (
    ChatRequest, ChatResponse, ChatSessionResponse, ChatMessageResponse,
    ChatTaskResponse, TaskStatusResponse
)
from ..dependencies import get_or_create_agent, memory_manager
from ...tasks.agent_tasks import process_agent_message

# Load configuration
config = load_config()

router = APIRouter()

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
            # Create new session
            session = ChatSession(
                title=request.message[:50] + "..." if len(request.message) > 50 else request.message,
                # agent_id could be set if we knew which agent is handling it primarily
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
                             # For now, just mention it's an image. 
                             # Future: Pass image to vision model.
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
                full_response = ""
                all_patient_references = []
                total_usage = {
                    "prompt_tokens": 0,
                    "completion_tokens": 0,
                    "total_tokens": 0
                }
                tool_calls_buffer = []
                logs_buffer = []
                try:
                    # Process message through agent with streaming (await to get async generator)
                    stream = await user_agent.process_message(
                        user_message=context_message.strip(),
                        stream=True,
                        chat_history=chat_history,
                        patient_id=patient.id if patient else None,
                        patient_name=patient.name if patient else None
                    )

                    # Stream each chunk as Server-Sent Events (async iteration)
                    async for event in stream:
                        if isinstance(event, dict):
                            if event["type"] == "content":
                                # Map content to chunk for backward compatibility
                                chunk_content = event['content']
                                full_response += chunk_content # Accumulate
                                yield f"data: {json.dumps({'chunk': chunk_content})}\n\n"
                            elif event["type"] == "tool_call":
                                tool_calls_buffer.append(event)
                                yield f"data: {json.dumps({'tool_call': event})}\n\n"
                            elif event["type"] == "tool_result":
                                # Update tool calls buffer with result
                                for tc in tool_calls_buffer:
                                    if tc.get("id") == event.get("id"):
                                        tc["result"] = event.get("result")
                                
                                logs_buffer.append({
                                    "timestamp": datetime.now(timezone.utc).isoformat(),
                                    "type": "tool_result",
                                    "content": event
                                })
                                yield f"data: {json.dumps({'tool_result': event})}\n\n"
                            elif event["type"] == "reasoning":
                                yield f"data: {json.dumps({'reasoning': event['content']})}\n\n"
                            elif event["type"] == "log":
                                logs_buffer.append({
                                    "timestamp": datetime.now(timezone.utc).isoformat(),
                                    "type": "log",
                                    "content": event['content']
                                })
                                yield f"data: {json.dumps({'log': event['content']})}\n\n"
                            elif event["type"] == "patient_references":
                                # Forward patient references to frontend
                                all_patient_references = event['patient_references']
                                yield f"data: {json.dumps({'patient_references': event['patient_references']})}\n\n"
                            elif event["type"] == "usage":
                                usage = event['usage']
                                total_usage["prompt_tokens"] += usage.get("prompt_tokens", 0)
                                total_usage["completion_tokens"] += usage.get("completion_tokens", 0)
                                total_usage["total_tokens"] += usage.get("total_tokens", 0)
                                yield f"data: {json.dumps({'usage': event['usage']})}\n\n"
                        else:
                            # Fallback for string chunks if any
                            # LangGraphAgent yields full content in 'values' mode, so we update full_response
                            full_response = event
                            yield f"data: {json.dumps({'chunk': event})}\n\n"

                    # 3. Save Assistant Message (after streaming is done)
                    if full_response or tool_calls_buffer:
                        # Create a new session for saving the message to avoid "session closed" errors
                        # in the streaming response callback
                        from src.config.database import AsyncSessionLocal
                        async with AsyncSessionLocal() as local_db:
                            assistant_msg = ChatMessage(
                                session_id=session.id,
                                role="assistant",
                                content=full_response,
                                tool_calls=json.dumps(tool_calls_buffer) if tool_calls_buffer else None,
                                logs=json.dumps(logs_buffer) if logs_buffer else None,
                                patient_references=json.dumps(all_patient_references) if all_patient_references else None,
                                token_usage=json.dumps(total_usage) if total_usage["total_tokens"] > 0 else None
                            )
                            local_db.add(assistant_msg)
                            await local_db.commit()

                    # Send session_id and done signal
                    yield f"data: {json.dumps({'session_id': session.id})}\n\n"
                    yield f"data: {json.dumps({'done': True})}\n\n"

                except Exception as e:
                    # Save error to database
                    from src.config.database import AsyncSessionLocal
                    async with AsyncSessionLocal() as local_db:
                        assistant_msg = ChatMessage(
                            session_id=session.id,
                            role="assistant",
                            content=full_response, # Save partial content
                            status="error",
                            error_message=str(e),
                            patient_references=json.dumps(all_patient_references) if all_patient_references else None,
                            token_usage=json.dumps(total_usage) if total_usage["total_tokens"] > 0 else None
                        )
                        local_db.add(assistant_msg)
                        await local_db.commit()

                    error_data = json.dumps({'error': str(e)})
                    yield f"data: {error_data}\n\n"

            return StreamingResponse(
                generate(),
                media_type="text/event-stream",
            )
        else:
            # Non-streaming response (await the async call)
            response = await user_agent.process_message(
                user_message=context_message.strip(),
                stream=False,
                chat_history=chat_history,
                patient_id=patient.id if patient else None,
                patient_name=patient.name if patient else None
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
                timestamp="", # TODO: Add timestamp
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
        from ...tasks import celery_app

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
    import asyncio
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
            from src.config.database import AsyncSessionLocal
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
                    except:
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

@router.get("/api/chat/sessions", response_model=list[ChatSessionResponse])
async def get_chat_sessions(db: AsyncSession = Depends(get_db)):
    """Get all chat sessions."""
    try:
        stmt = select(ChatSession).order_by(ChatSession.updated_at.desc())
        result = await db.execute(stmt)
        sessions = result.scalars().all()

        response = []
        for session in sessions:
            # Get message count
            msg_stmt = select(ChatMessage).where(ChatMessage.session_id == session.id)
            msg_result = await db.execute(msg_stmt)
            messages = msg_result.scalars().all()

            # Get agent name if applicable
            agent_name = None
            # if session.agent_id:
            #     agent = await db.get(SubAgent, session.agent_id)
            #     if agent:
            #         agent_name = agent.name

            # Get preview from last message
            preview = None
            if messages:
                last_msg = messages[-1]
                preview = last_msg.content[:50] + "..." if len(last_msg.content) > 50 else last_msg.content

            response.append(ChatSessionResponse(
                id=session.id,
                title=session.title,
                agent_id=session.agent_id,
                agent_name=agent_name,
                message_count=len(messages),
                preview=preview,
                tags=[],  # TODO: Extract tags from content
                created_at=session.created_at.isoformat(),
                updated_at=session.updated_at.isoformat()
            ))

        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching chat sessions: {str(e)}")

@router.get("/api/chat/sessions/{session_id}/messages", response_model=list[ChatMessageResponse])
async def get_session_messages(session_id: int, db: AsyncSession = Depends(get_db)):
    """Get all messages for a specific chat session."""
    try:
        # Check session exists
        stmt = select(ChatSession).where(ChatSession.id == session_id)
        result = await db.execute(stmt)
        session = result.scalar_one_or_none()

        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")

        # Get messages
        msg_stmt = select(ChatMessage).where(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at)
        msg_result = await db.execute(msg_stmt)
        messages = msg_result.scalars().all()

        return [
            ChatMessageResponse(
                id=msg.id,
                session_id=msg.session_id,
                role=msg.role,
                content=msg.content,
                tool_calls=msg.tool_calls,
                reasoning=msg.reasoning,
                patient_references=msg.patient_references,
                created_at=msg.created_at.isoformat(),
                status=msg.status,
                task_id=msg.task_id,
                logs=msg.logs,
                streaming_started_at=msg.streaming_started_at.isoformat() if msg.streaming_started_at else None,
                completed_at=msg.completed_at.isoformat() if msg.completed_at else None,
                error_message=msg.error_message,
                last_updated_at=msg.last_updated_at.isoformat() if msg.last_updated_at else None,
                token_usage=msg.token_usage
            )
            for msg in messages
        ]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching messages: {str(e)}")

@router.delete("/api/chat/sessions/{session_id}")
async def delete_chat_session(session_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a specific chat session."""
    try:
        # Check session exists
        stmt = select(ChatSession).where(ChatSession.id == session_id)
        result = await db.execute(stmt)
        session = result.scalar_one_or_none()

        if not session:
            raise HTTPException(status_code=404, detail="Chat session not found")

        # Delete session (cascade delete should handle messages if configured, otherwise delete messages first)
        # Assuming cascade delete is configured or we delete messages manually
        msg_stmt = select(ChatMessage).where(ChatMessage.session_id == session_id)
        msg_result = await db.execute(msg_stmt)
        messages = msg_result.scalars().all()
        
        for msg in messages:
            await db.delete(msg)
            
        await db.delete(session)
        await db.commit()

        return {"message": "Chat session deleted successfully", "id": session_id}
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting chat session: {str(e)}")

@router.delete("/api/chat/history")
async def clear_history(user_id: str = "default"):
    """Clear chat history for a user."""
    try:
        # This clears the in-memory context of the agent
        # It does NOT clear the database chat sessions
        agent = get_or_create_agent(user_id)
        if hasattr(agent, 'context'):
             agent.context.clear()
             return {"message": f"Chat history cleared for user {user_id}", "status": "ok"}
        # If using LangGraphAgent, it might handle history differently (via Checkpointer)
        # For now, just return ok
        return {"message": "No history found or cleared", "status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error clearing history: {str(e)}")

@router.get("/api/memory/stats/{user_id}")
async def get_memory_stats(user_id: str):
    """Get memory statistics for a user."""
    try:
        if not memory_manager:
            raise HTTPException(status_code=503, detail="Memory system not enabled")

        stats = memory_manager.get_memory_stats(user_id)
        return stats

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting memory stats: {str(e)}")

@router.get("/api/memory/export/{user_id}")
async def export_user_memories(user_id: str):
    """Export all memories for a user (GDPR right to data portability)."""
    try:
        if not memory_manager:
            raise HTTPException(status_code=503, detail="Memory system not enabled")

        memories = memory_manager.get_all_memories(user_id)

        from datetime import datetime

        return {
            "user_id": user_id,
            "export_date": datetime.now().isoformat(),
            "total_memories": len(memories),
            "memories": memories,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error exporting memories: {str(e)}")

@router.get("/api/health/celery")
async def check_celery_health():
    """Check Celery worker health status."""
    try:
        from celery.result import AsyncResult
        from ...tasks import celery_app

        # Get worker statistics
        inspector = celery_app.control.inspect()

        # Check active workers
        active_workers = inspector.active()
        registered_tasks = inspector.registered()

        if not active_workers:
            raise HTTPException(
                status_code=503,
                detail="No active Celery workers found. Please start workers with: ./start-celery-worker.sh"
            )

        # Count total workers
        worker_count = len(active_workers) if active_workers else 0

        # Count active tasks
        active_task_count = sum(len(tasks) for tasks in active_workers.values()) if active_workers else 0

        return {
            "status": "healthy",
            "workers": worker_count,
            "active_tasks": active_task_count,
            "registered_tasks": list(registered_tasks.values())[0] if registered_tasks else [],
            "redis_url": celery_app.conf.broker_url,
            "message": "Celery workers are running and accepting tasks"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Celery health check failed: {str(e)}"
        )
