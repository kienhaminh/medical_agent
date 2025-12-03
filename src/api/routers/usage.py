from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json

from ...config.database import get_db, ChatMessage

router = APIRouter()

@router.get("/api/usage/stats")
async def get_usage_stats(db: AsyncSession = Depends(get_db)):
    """Get aggregated token usage statistics."""
    try:
        # Fetch all messages with token usage
        stmt = select(ChatMessage).where(ChatMessage.token_usage.isnot(None))
        result = await db.execute(stmt)
        messages = result.scalars().all()
        
        total_prompt_tokens = 0
        total_completion_tokens = 0
        total_tokens = 0
        
        for msg in messages:
            if msg.token_usage:
                try:
                    usage = json.loads(msg.token_usage)
                    total_prompt_tokens += usage.get("prompt_tokens", 0)
                    total_completion_tokens += usage.get("completion_tokens", 0)
                    total_tokens += usage.get("total_tokens", 0)
                except Exception:
                    continue
                    
        return {
            "prompt_tokens": total_prompt_tokens,
            "completion_tokens": total_completion_tokens,
            "total_tokens": total_tokens,
            "message_count": len(messages)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating usage stats: {str(e)}")

@router.get("/api/usage/errors")
async def get_error_logs(limit: int = 50, db: AsyncSession = Depends(get_db)):
    """Get recent error logs from chat messages."""
    try:
        from sqlalchemy import desc
        
        # Fetch messages with errors
        stmt = select(ChatMessage).where(
            (ChatMessage.status == 'error') | 
            (ChatMessage.error_message.isnot(None))
        ).order_by(desc(ChatMessage.created_at)).limit(limit)
        
        result = await db.execute(stmt)
        messages = result.scalars().all()
        
        errors = []
        for msg in messages:
            errors.append({
                "id": msg.id,
                "timestamp": msg.created_at.isoformat(),
                "level": "error",
                "message": msg.error_message or "Unknown error",
                "component": "Chat Agent",
                "details": f"Session ID: {msg.session_id}",
                "session_id": msg.session_id
            })
            
        return errors
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching error logs: {str(e)}")
