"""Background tasks for agent message processing."""
import asyncio
import json
from datetime import datetime
from typing import Optional, List, Dict


from . import celery_app
from ..config.database import AsyncSessionLocal, ChatMessage, ChatSession, Patient, MedicalRecord
from ..api.dependencies import get_or_create_agent
import logging
from sqlalchemy import select
import src.tools.builtin  # Register builtin tools

logger = logging.getLogger(__name__)
logger.info(f"Loaded builtin tools from {src.tools.builtin.__name__}")





@celery_app.task(
    bind=True,
    max_retries=3,
    name="src.tasks.agent_tasks.process_agent_message"
)
def process_agent_message(
    self,
    session_id: int,
    message_id: int,
    user_id: str,
    user_message: str,
    patient_id: Optional[int] = None,
    record_id: Optional[int] = None,
):
    """Process agent message in background with incremental persistence.

    Args:
        session_id: Chat session ID
        message_id: Assistant message ID (pre-created with status='pending')
        user_id: User ID for agent retrieval
        user_message: User's message content
        patient_id: Optional patient ID for context
        record_id: Optional medical record ID for context
    """
    # Create and set a new event loop for this task
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(
            _process_message_async(
                task_id=self.request.id,
                session_id=session_id,
                message_id=message_id,
                user_id=user_id,
                user_message=user_message,
                patient_id=patient_id,
                record_id=record_id,
            )
        )
    finally:
        loop.close()


async def _process_message_async(
    task_id: str,
    session_id: int,
    message_id: int,
    user_id: str,
    user_message: str,
    patient_id: Optional[int] = None,
    record_id: Optional[int] = None,
):
    """Async processing logic for agent message."""

    # Initialize accumulators
    full_response = ""
    tool_calls_buffer: List[Dict] = []
    logs_buffer: List[Dict] = []
    reasoning_content = ""
    all_patient_references = []
    total_usage = {
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "total_tokens": 0
    }

    # Persistence control
    last_save_time = datetime.utcnow()
    chunk_count = 0
    SAVE_INTERVAL_SECONDS = 5
    SAVE_CHUNK_THRESHOLD = 50

    # Track if we need to save error state
    save_error = None
    save_interrupted = False

    try:
        async with AsyncSessionLocal() as db:
            # 1. Mark message as streaming and set task_id
            result = await db.execute(
                select(ChatMessage).where(ChatMessage.id == message_id)
            )
            message = result.scalar_one_or_none()
            if not message:
                raise ValueError(f"Message {message_id} not found")

            message.status = "streaming"
            message.task_id = task_id
            message.streaming_started_at = datetime.utcnow()
            message.last_updated_at = datetime.utcnow()
            await db.commit()

            # 2. Build context message with patient/record info
            context_message = user_message
            if patient_id:
                result = await db.execute(select(Patient).where(Patient.id == patient_id))
                patient = result.scalar_one_or_none()
                if patient:
                    context_message = f"Context: Patient {patient.name} (DOB: {patient.dob}, Gender: {patient.gender}).\n\n"

                    if record_id:
                        result = await db.execute(
                            select(MedicalRecord).where(MedicalRecord.id == record_id)
                        )
                        record = result.scalar_one_or_none()
                        if record:
                            context_message += f"Focus Record: {record.record_type}\n"
                            if record.record_type == "text":
                                context_message += f"Content: {record.content}\n"
                            elif record.record_type == "image":
                                context_message += f"Image File: {record.content}\n"
                                if record.summary:
                                    context_message += f"Metadata: {record.summary}\n"
                            elif record.record_type == "pdf":
                                context_message += f"PDF File: {record.content}\n"
                                if record.summary:
                                    context_message += f"Metadata: {record.summary}\n"

                    context_message += f"User Query: {user_message}"

            # 3. Load chat history
            chat_history = []
            stmt = select(ChatMessage).where(
                ChatMessage.session_id == session_id
            ).order_by(ChatMessage.created_at)
            result = await db.execute(stmt)
            existing_messages = result.scalars().all()

            # Exclude the current assistant message and any messages without content
            for msg in existing_messages:
                if msg.id != message_id and msg.content and msg.content.strip():
                    chat_history.append({
                        "role": msg.role,
                        "content": msg.content
                    })

            # 4. Get agent and process message
            user_agent = get_or_create_agent(user_id)
            stream = await user_agent.process_message(
                user_message=context_message.strip(),
                stream=True,
                chat_history=chat_history,
            )

            # 5. Process streaming events with incremental persistence
            async for event in stream:
                chunk_count += 1

                if isinstance(event, dict):
                    # Handle different event types
                    if event["type"] == "content":
                        full_response += event['content']

                    elif event["type"] == "tool_call":
                        tool_calls_buffer.append(event)

                    elif event["type"] == "tool_result":
                        # Update tool calls buffer with result
                        for tc in tool_calls_buffer:
                            if tc.get("id") == event.get("id"):
                                tc["result"] = event.get("result")

                        # Append tool results to logs
                        logs_buffer.append({
                            "timestamp": datetime.utcnow().isoformat(),
                            "type": "tool_result",
                            "content": event
                        })

                    elif event["type"] == "reasoning":
                        reasoning_content += event['content']

                    elif event["type"] == "log":
                        logs_buffer.append({
                            "timestamp": datetime.utcnow().isoformat(),
                            "type": "log",
                            "content": event['content']
                        })

                    elif event["type"] == "patient_references":
                        all_patient_references = event['patient_references']

                    elif event["type"] == "usage":
                        logger.info("✅✅✅ USAGE EVENT RECEIVED IN AGENT_TASKS: %s", event)
                        usage = event.get('usage', {})
                        # Handle different usage formats
                        if isinstance(usage, dict):
                            # Standard format: prompt_tokens, completion_tokens, total_tokens
                            total_usage["prompt_tokens"] += usage.get("prompt_tokens", usage.get("input_tokens", 0))
                            total_usage["completion_tokens"] += usage.get("completion_tokens", usage.get("output_tokens", 0))
                            total_usage["total_tokens"] += usage.get("total_tokens", 0)
                            logger.info("✅ Updated total_usage: %s", total_usage)

                else:
                    # Fallback for string chunks
                    full_response = event

                # 6. Incremental persistence logic
                time_since_last_save = (datetime.utcnow() - last_save_time).total_seconds()
                should_save = (
                    time_since_last_save >= SAVE_INTERVAL_SECONDS or
                    chunk_count >= SAVE_CHUNK_THRESHOLD
                )

                if should_save:
                    await _update_message_content(
                        db=db,
                        message_id=message_id,
                        content=full_response,
                        tool_calls=tool_calls_buffer,
                        reasoning=reasoning_content,
                        logs=logs_buffer,
                        patient_references=all_patient_references,
                        token_usage=total_usage if total_usage["total_tokens"] > 0 else None,
                    )
                    last_save_time = datetime.utcnow()
                    chunk_count = 0

            # 7. Final save with completed status
            result = await db.execute(
                select(ChatMessage).where(ChatMessage.id == message_id)
            )
            message = result.scalar_one_or_none()
            if message:
                message.content = full_response
                message.tool_calls = json.dumps(tool_calls_buffer) if tool_calls_buffer else None
                message.reasoning = reasoning_content if reasoning_content else None
                message.logs = json.dumps(logs_buffer) if logs_buffer else None
                message.patient_references = json.dumps(all_patient_references) if all_patient_references else None
                message.token_usage = json.dumps(total_usage) if total_usage["total_tokens"] > 0 else None
                message.status = "completed"
                message.completed_at = datetime.utcnow()
                message.last_updated_at = datetime.utcnow()
                await db.commit()

            return {
                "message_id": message_id,
                "status": "completed",
                "content_length": len(full_response),
                "tool_calls_count": len(tool_calls_buffer),
                "logs_count": len(logs_buffer),
            }

    except asyncio.CancelledError:
        # Task was cancelled - mark for saving
        save_interrupted = True
        return {
            "message_id": message_id,
            "status": "interrupted",
            "content_length": len(full_response),
        }

    except Exception as e:
        # Error occurred - mark for saving
        save_error = e
        raise

    finally:
        # Save error/interrupted state outside of main db context
        if save_interrupted or save_error:
            try:
                async with AsyncSessionLocal() as error_db:
                    result = await error_db.execute(
                        select(ChatMessage).where(ChatMessage.id == message_id)
                    )
                    message = result.scalar_one_or_none()
                    if message:
                        message.content = full_response
                        message.tool_calls = json.dumps(tool_calls_buffer) if tool_calls_buffer else None
                        message.reasoning = reasoning_content if reasoning_content else None
                        message.logs = json.dumps(logs_buffer) if logs_buffer else None
                        message.patient_references = json.dumps(all_patient_references) if all_patient_references else None
                        message.token_usage = json.dumps(total_usage) if total_usage["total_tokens"] > 0 else None

                        if save_interrupted:
                            message.status = "interrupted"
                            message.error_message = "Task was cancelled"
                        elif save_error:
                            message.status = "error"
                            message.error_message = str(save_error)

                        message.completed_at = datetime.utcnow()
                        message.last_updated_at = datetime.utcnow()
                        await error_db.commit()
            except Exception as final_error:
                # If even the finally block fails, log it but don't raise
                print(f"Failed to save error state: {final_error}")


async def _update_message_content(
    db,
    message_id: int,
    content: str,
    tool_calls: List[Dict],
    reasoning: str,
    logs: List[Dict],
    patient_references: List,
    token_usage: Optional[Dict] = None,
):
    """Update message content incrementally."""
    result = await db.execute(
        select(ChatMessage).where(ChatMessage.id == message_id)
    )
    message = result.scalar_one_or_none()
    if message:
        message.content = content
        message.tool_calls = json.dumps(tool_calls) if tool_calls else None
        message.reasoning = reasoning if reasoning else None
        message.logs = json.dumps(logs) if logs else None
        message.patient_references = json.dumps(patient_references) if patient_references else None
        message.token_usage = json.dumps(token_usage) if token_usage and token_usage.get("total_tokens", 0) > 0 else None
        message.last_updated_at = datetime.utcnow()
        await db.commit()
