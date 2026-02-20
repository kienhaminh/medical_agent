"""Patient routes - delegates to sub-modules."""
from fastapi import APIRouter

from .core import router as core_router
from .records import router as records_router
from .imaging import router as imaging_router

router = APIRouter()

# Include sub-routers
router.include_router(core_router)
router.include_router(records_router)
router.include_router(imaging_router)
