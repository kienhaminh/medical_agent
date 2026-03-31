"""Case threads API — retrieve specialist consultation threads."""
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import get_db
from src.models.case_thread import CaseThread, CaseMessage

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Case Threads"])


@router.get("/api/case-threads/{thread_id}")
async def get_case_thread(thread_id: str, db: AsyncSession = Depends(get_db)):
    """Return a CaseThread with all its messages ordered by round / created_at.

    Used by the frontend to render the expandable specialist discussion view.

    Returns 404 if the thread_id does not exist.
    """
    result = await db.execute(select(CaseThread).where(CaseThread.id == thread_id))
    thread = result.scalar_one_or_none()
    if thread is None:
        raise HTTPException(status_code=404, detail="Thread not found")

    msgs_result = await db.execute(
        select(CaseMessage)
        .where(CaseMessage.thread_id == thread_id)
        .order_by(CaseMessage.round, CaseMessage.created_at)
    )
    messages = msgs_result.scalars().all()

    return {
        "id": thread.id,
        "patient_id": thread.patient_id,
        "visit_id": thread.visit_id,
        "created_by": thread.created_by,
        "trigger": thread.trigger,
        "status": thread.status,
        "max_rounds": thread.max_rounds,
        "current_round": thread.current_round,
        "case_summary": thread.case_summary,
        "synthesis": thread.synthesis,
        "created_at": thread.created_at.isoformat() if thread.created_at else None,
        "updated_at": thread.updated_at.isoformat() if thread.updated_at else None,
        "messages": [
            {
                "id": m.id,
                "round": m.round,
                "sender_type": m.sender_type,
                "specialist_role": m.specialist_role,
                "content": m.content,
                "agrees_with": m.agrees_with,
                "challenges": m.challenges,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ],
    }
