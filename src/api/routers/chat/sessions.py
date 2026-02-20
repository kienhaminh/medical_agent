"""Chat session management routes."""
import logging
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from src.models import get_db, ChatSession, ChatMessage
from ..models import ChatSessionResponse, ChatMessageResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/api/chat/sessions", response_model=list[ChatSessionResponse])
async def get_chat_sessions(db: AsyncSession = Depends(get_db)):
    """Get all chat sessions ordered by most recent."""
    try:
        result = await db.execute(
            select(ChatSession)
            .order_by(desc(ChatSession.updated_at))
        )
        sessions = result.scalars().all()
        
        return [
            ChatSessionResponse(
                id=session.id,
                title=session.title,
                agent_id=session.agent_id,
                created_at=session.created_at,
                updated_at=session.updated_at
            )
            for session in sessions
        ]
    except Exception as e:
        logger.error(f"Error fetching chat sessions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch sessions: {str(e)}")


@router.get("/api/chat/sessions/{session_id}/messages", response_model=list[ChatMessageResponse])
async def get_session_messages(session_id: int, db: AsyncSession = Depends(get_db)):
    """Get all messages for a specific chat session."""
    try:
        result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at)
        )
        messages = result.scalars().all()
        
        return [
            ChatMessageResponse(
                id=msg.id,
                session_id=msg.session_id,
                role=msg.role,
                content=msg.content,
                created_at=msg.created_at,
                status=msg.status,
                task_id=msg.task_id,
                tool_calls=msg.tool_calls,
                reasoning=msg.reasoning,
                patient_references=msg.patient_references
            )
            for msg in messages
        ]
    except Exception as e:
        logger.error(f"Error fetching session messages: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch messages: {str(e)}")


@router.delete("/api/chat/sessions/{session_id}")
async def delete_chat_session(session_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a chat session and all its messages."""
    try:
        result = await db.execute(
            select(ChatSession).where(ChatSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        await db.delete(session)
        await db.commit()
        
        return {"message": "Session deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting chat session: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete session: {str(e)}")


@router.delete("/api/chat/history")
async def clear_history(user_id: str = "default"):
    """Clear all chat history for a user.
    
    Note: This currently clears all sessions globally. 
    User-specific session filtering should be added.
    """
    try:
        # TODO: Implement user-specific session filtering
        # For now, return a message indicating this needs implementation
        return {
            "message": "History clearing not yet implemented for user-specific filtering",
            "user_id": user_id
        }
    except Exception as e:
        logger.error(f"Error clearing history: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clear history: {str(e)}")
