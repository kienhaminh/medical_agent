"""Chat message handling routes."""
import json
import logging
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from celery.result import AsyncResult

from src.models import get_db, ChatSession, ChatMessage, AsyncSessionLocal
from ..models import ChatRequest, ChatTaskResponse, TaskStatusResponse
from ....tasks.agent_tasks import process_agent_message

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/api/chat/send", response_model=ChatTaskResponse)
async def send_chat_message(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    """Send a chat message for background processing.
    
    This endpoint queues the message for processing by a Celery worker
    and returns a task ID for polling status.
    """
    try:
        if not request.message or not request.message.strip():
            raise HTTPException(status_code=400, detail="Message cannot be empty")

        # 1. Manage Chat Session
        session = None
        if request.session_id:
            result = await db.execute(
                select(ChatSession).where(ChatSession.id == request.session_id)
            )
            session = result.scalar_one_or_none()
        
        if not session:
            session = ChatSession(
                title=request.message[:50] + "..." if len(request.message) > 50 else request.message
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
        await db.refresh(user_msg)

        # 3. Queue background task
        task = process_agent_message.delay(
            message=request.message,
            user_id=request.user_id,
            session_id=session.id,
            message_id=user_msg.id,
            patient_id=request.patient_id,
            record_id=request.record_id
        )

        return ChatTaskResponse(
            task_id=task.id,
            session_id=session.id,
            message_id=user_msg.id,
            status="pending"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending chat message: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send message: {str(e)}")


@router.get("/api/chat/tasks/{task_id}/status", response_model=TaskStatusResponse)
async def get_task_status(task_id: str, db: AsyncSession = Depends(get_db)):
    """Get the status of a background chat task."""
    try:
        task_result = AsyncResult(task_id)
        
        # Get message info if available
        message_id = None
        session_id = None
        
        if task_result.result and isinstance(task_result.result, dict):
            message_id = task_result.result.get("message_id")
            session_id = task_result.result.get("session_id")
        
        response = TaskStatusResponse(
            task_id=task_id,
            status=task_result.status.lower(),
            message_id=message_id,
            session_id=session_id
        )
        
        # Add result or error info
        if task_result.ready():
            if task_result.successful():
                result = task_result.result
                if isinstance(result, dict):
                    response.result = result
            else:
                response.error = str(task_result.result)
        
        return response
        
    except Exception as e:
        logger.error(f"Error getting task status: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get task status: {str(e)}")
