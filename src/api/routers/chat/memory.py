"""Memory routes."""
import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException

from ...dependencies import memory_manager

logger = logging.getLogger(__name__)
router = APIRouter()


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

        return {
            "user_id": user_id,
            "export_date": datetime.now().isoformat(),
            "total_memories": len(memories),
            "memories": memories,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error exporting memories: {str(e)}")
