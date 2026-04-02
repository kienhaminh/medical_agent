"""Chat routes — delegates to sub-modules."""
from fastapi import APIRouter

from .sessions import router as sessions_router
from .messages import router as messages_router

router = APIRouter()

# Include sub-routers
router.include_router(sessions_router)
router.include_router(messages_router)
