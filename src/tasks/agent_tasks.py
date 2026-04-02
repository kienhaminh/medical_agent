"""Background tasks for agent message processing."""
import asyncio
import json
from datetime import datetime, UTC
from typing import Optional


from . import celery_app
from src.models import AsyncSessionLocal, ChatMessage, ChatSession, Patient, MedicalRecord
from src.config.settings import load_config
from ..api.dependencies import get_or_create_agent
from ..agent.stream_processor import StreamProcessor
import logging
from sqlalchemy import select
import src.tools  # Register tools
import src.skills.builtin  # Register skill search tools
import redis.asyncio as redis
import os

# Load configuration
config = load_config()

logger = logging.getLogger(__name__)
logger.info(f"Loaded tools from {src.tools.__name__}")





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
    # Use asyncio.run() which properly manages the event loop
    return asyncio.run(
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


async def _process_message_async(
    task_id: str,
    session_id: int,
    message_id: int,
    user_id: str,
    user_message: str,
    patient_id: Optional[int] = None,
    record_id: Optional[int] = None,
):
    """Async processing logic for agent message background task."""
    
    # Initialize Redis
    redis_client = redis.from_url(config.redis_url)

    processor = StreamProcessor()
    channel = f"chat:message:{message_id}"

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

            await redis_client.publish(channel, json.dumps({"type": "status", "status": "streaming"}))

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

            for msg in existing_messages:
                if msg.id != message_id and msg.content and msg.content.strip():
                    chat_history.append({"role": msg.role, "content": msg.content})

            # 4. Get agent and process message
            user_agent = get_or_create_agent(user_id)
            stream = await user_agent.process_message(
                user_message=context_message.strip(),
                stream=True,
                chat_history=chat_history,
            )

            # 5. Process streaming events via shared processor
            async for event in processor.process(stream):
                chunk_count += 1

                # Publish event to Redis
                if isinstance(event, dict):
                    await redis_client.publish(channel, json.dumps(event))

                # Incremental persistence
                time_since_last_save = (datetime.utcnow() - last_save_time).total_seconds()
                if time_since_last_save >= SAVE_INTERVAL_SECONDS or chunk_count >= SAVE_CHUNK_THRESHOLD:
                    r = processor.result
                    await _update_message_content(
                        db=db,
                        message_id=message_id,
                        result=r,
                    )
                    last_save_time = datetime.utcnow()
                    chunk_count = 0

            # 6. Final save with completed status
            r = processor.result
            result = await db.execute(
                select(ChatMessage).where(ChatMessage.id == message_id)
            )
            message = result.scalar_one_or_none()
            if message:
                message.content = r.content
                message.tool_calls = r.tool_calls_json()
                message.reasoning = r.reasoning if r.reasoning else None
                message.logs = r.logs_json()
                message.token_usage = r.usage_json()
                message.status = "completed"
                message.completed_at = datetime.utcnow()
                message.last_updated_at = datetime.utcnow()
                await db.commit()

            await redis_client.publish(channel, json.dumps({"type": "done"}))

            return {
                "message_id": message_id,
                "status": "completed",
                "content_length": len(r.content),
                "tool_calls_count": len(r.tool_calls),
                "logs_count": len(r.logs),
            }

    except asyncio.CancelledError:
        save_interrupted = True
        await redis_client.publish(channel, json.dumps({"type": "error", "message": "Task was cancelled"}))
        return {"message_id": message_id, "status": "interrupted", "content_length": len(processor.result.content)}

    except Exception as e:
        save_error = e
        await redis_client.publish(channel, json.dumps({"type": "error", "message": str(e)}))
        raise

    finally:
        await redis_client.aclose()
        if save_interrupted or save_error:
            try:
                r = processor.result
                async with AsyncSessionLocal() as error_db:
                    result = await error_db.execute(
                        select(ChatMessage).where(ChatMessage.id == message_id)
                    )
                    message = result.scalar_one_or_none()
                    if message:
                        message.content = r.content
                        message.tool_calls = r.tool_calls_json()
                        message.reasoning = r.reasoning if r.reasoning else None
                        message.logs = r.logs_json()
                        message.token_usage = r.usage_json()
                        message.status = "interrupted" if save_interrupted else "error"
                        message.error_message = "Task was cancelled" if save_interrupted else str(save_error)
                        message.completed_at = datetime.utcnow()
                        message.last_updated_at = datetime.utcnow()
                        await error_db.commit()
            except Exception as final_error:
                logger.error("Failed to save error state: %s", final_error)


async def _update_message_content(db, message_id: int, result):
    """Update message content incrementally from a StreamResult."""
    db_result = await db.execute(
        select(ChatMessage).where(ChatMessage.id == message_id)
    )
    message = db_result.scalar_one_or_none()
    if message:
        message.content = result.content
        message.tool_calls = result.tool_calls_json()
        message.reasoning = result.reasoning if result.reasoning else None
        message.logs = result.logs_json()
        message.token_usage = result.usage_json()
        message.last_updated_at = datetime.utcnow()
        await db.commit()


@celery_app.task(
    bind=True,
    max_retries=3,
    name="src.tasks.agent_tasks.generate_patient_health_summary"
)
def generate_patient_health_summary(
    self,
    patient_id: int,
):
    """Generate AI health summary for a patient in background.
    
    Args:
        patient_id: Patient ID to generate summary for
    """
    return asyncio.run(
        _generate_health_summary_async(
            task_id=self.request.id,
            patient_id=patient_id,
        )
    )


async def _generate_health_summary_async(
    task_id: str,
    patient_id: int,
):
    """Async processing logic for health summary generation."""

    # Initialize Redis
    redis_client = redis.from_url(config.redis_url)

    channel = f"patient:health_summary:{patient_id}"
    summary_content = ""

    # Persistence control for incremental saves
    last_save_time = datetime.now(UTC)
    chunk_count = 0
    SAVE_INTERVAL_SECONDS = 5
    SAVE_CHUNK_THRESHOLD = 20

    save_error = None

    try:
        async with AsyncSessionLocal() as db:
            # 1. Mark patient as generating and set task_id
            result = await db.execute(
                select(Patient).where(Patient.id == patient_id)
            )
            patient = result.scalar_one_or_none()
            if not patient:
                raise ValueError(f"Patient {patient_id} not found")

            patient.health_summary_status = "generating"
            patient.health_summary_task_id = task_id
            await db.commit()

            # Publish start event
            start_event = {"type": "status", "status": "generating"}
            logger.info(f"Publishing start event to {channel}: {start_event}")
            await redis_client.publish(channel, json.dumps(start_event))

            # 2. Fetch all medical records
            records_result = await db.execute(
                select(MedicalRecord)
                .where(MedicalRecord.patient_id == patient_id)
                .order_by(MedicalRecord.created_at.desc())
            )
            records = records_result.scalars().all()

            # 3. Build context from patient data and records
            context_parts = [
                f"Patient Information:",
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
                        # Truncate very long content
                        content = record.content[:2000] + "..." if len(record.content) > 2000 else record.content
                        context_parts.append(f"Content:\n{content}")
                    elif record.record_type in ["image", "pdf"]:
                        import os as os_module
                        context_parts.append(f"File: {os_module.path.basename(record.content)}")
            else:
                context_parts.append("No medical records available.")

            patient_context = "\n".join(context_parts)

            # 4. Create prompt for AI agent
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

            # 5. Get agent and process message
            agent = get_or_create_agent("health_summary_generator")

            # Process the message with streaming
            stream = await agent.process_message(
                user_message=prompt,
                stream=True,
                chat_history=[]  # No history needed for one-off generation
            )

            # 6. Process streaming events with incremental persistence
            summary_processor = StreamProcessor()
            async for event in summary_processor.process(stream):
                if isinstance(event, dict) and event.get("type") == "content":
                    chunk_count += 1
                    summary_content = summary_processor.result.content

                    # Cache accumulated content in Redis for resume support
                    content_key = f"patient:health_summary:{patient_id}:content"
                    await redis_client.set(content_key, summary_content, ex=3600)

                    # Publish content chunks
                    await redis_client.publish(channel, json.dumps({
                        "type": "chunk",
                        "content": event["content"],
                    }))

                    # Incremental database save
                    time_since_last_save = (datetime.now(UTC) - last_save_time).total_seconds()
                    if time_since_last_save >= SAVE_INTERVAL_SECONDS or chunk_count >= SAVE_CHUNK_THRESHOLD:
                        try:
                            result = await db.execute(
                                select(Patient).where(Patient.id == patient_id)
                            )
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

        # 7. Final save with completed status - use fresh DB session
        logger.info(f"Stream completed for patient {patient_id}, performing final save...")
        async with AsyncSessionLocal() as final_db:
            result = await final_db.execute(
                select(Patient).where(Patient.id == patient_id)
            )
            patient = result.scalar_one_or_none()
            if patient:
                patient.health_summary = summary_content
                patient.health_summary_updated_at = datetime.now(UTC).replace(tzinfo=None)
                patient.health_summary_status = "completed"
                await final_db.commit()
                logger.info(f"Final save successful for patient {patient_id}: {len(summary_content)} chars, status=completed")
            else:
                logger.error(f"Patient {patient_id} not found during final save!")

        # Publish done event
        done_event = {"type": "done"}
        logger.info(f"Publishing done event to {channel}: {done_event}")
        await redis_client.publish(channel, json.dumps(done_event))

        # Clean up content cache
        content_key = f"patient:health_summary:{patient_id}:content"
        await redis_client.delete(content_key)

        return {
            "patient_id": patient_id,
            "status": "completed",
            "summary_length": len(summary_content),
        }

    except Exception as e:
        logger.error(f"Error generating health summary for patient {patient_id}: {e}", exc_info=True)
        save_error = e
        # Update patient with error status BUT save accumulated content
        try:
            async with AsyncSessionLocal() as error_db:
                result = await error_db.execute(
                    select(Patient).where(Patient.id == patient_id)
                )
                patient = result.scalar_one_or_none()
                if patient:
                    # Save whatever content we accumulated before the error
                    if summary_content:
                        patient.health_summary = summary_content
                        patient.health_summary_updated_at = datetime.now(UTC).replace(tzinfo=None)
                        logger.info(f"Saved partial content on error for patient {patient_id}: {len(summary_content)} chars")
                    patient.health_summary_status = "error"
                    await error_db.commit()

                # Clean up content cache on error too
                try:
                    content_key = f"patient:health_summary:{patient_id}:content"
                    await redis_client.delete(content_key)
                except Exception:
                    pass

                # Publish error event
                await redis_client.publish(channel, json.dumps({
                    "type": "error",
                    "message": str(e)
                }))
        except Exception as final_error:
            logger.error(f"Failed to save error state for patient {patient_id}: {final_error}", exc_info=True)
        raise

    finally:
        await redis_client.aclose()
