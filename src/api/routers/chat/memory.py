"""Memory and Celery health routes."""
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


@router.get("/api/health/celery")
async def check_celery_health():
    """Check Celery worker health status."""
    try:
        from ....tasks import celery_app

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
