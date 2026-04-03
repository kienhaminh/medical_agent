"""Chat session management routes."""
import logging
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.models import get_db, ChatSession, ChatMessage
from ...models import (
    ChatSessionResponse, ChatMessageResponse,
)
from ...dependencies import get_agent

logger = logging.getLogger(__name__)
router = APIRouter()


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

            # Get preview from last message
            preview = None
            if messages:
                last_msg = messages[-1]
                preview = last_msg.content[:50] + "..." if len(last_msg.content) > 50 else last_msg.content

            response.append(ChatSessionResponse(
                id=session.id,
                title=session.title,
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

        # Delete messages first, then session
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
        agent = get_agent()
        if hasattr(agent, 'context'):
            agent.context.clear()
            return {"message": f"Chat history cleared for user {user_id}", "status": "ok"}
        # If using LangGraphAgent, it might handle history differently (via Checkpointer)
        # For now, just return ok
        return {"message": "No history found or cleared", "status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error clearing history: {str(e)}")
