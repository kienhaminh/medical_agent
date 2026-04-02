"""Models package - exports all database models."""
from .base import (
    Base,
    AsyncSessionLocal,
    SessionLocal,
    engine,
    sync_engine,
    get_db,
    init_db,
    DATABASE_URL,
    ASYNC_DATABASE_URL,
    SYNC_DATABASE_URL,
)
from .patient import Patient
from .allergy import Allergy
from .medication import Medication
from .vital_sign import VitalSign
from .intake_submission import IntakeSubmission
from .medical_record import MedicalRecord
from .imaging import Imaging, ImageGroup
from .chat import ChatSession, ChatMessage
from .visit import Visit, VisitStatus
from .case_thread import CaseThread, CaseMessage
from .department import Department
from .user import User, UserRole

__all__ = [
    # Base
    "Base",
    "AsyncSessionLocal",
    "SessionLocal",
    "engine",
    "sync_engine",
    "get_db",
    "init_db",
    "DATABASE_URL",
    "ASYNC_DATABASE_URL",
    "SYNC_DATABASE_URL",
    # Models
    "Patient",
    "Allergy",
    "Medication",
    "VitalSign",
    "IntakeSubmission",
    "MedicalRecord",
    "Imaging",
    "ImageGroup",
    "ChatSession",
    "ChatMessage",
    # Visit models
    "Visit",
    "VisitStatus",
    # Case thread models
    "CaseThread",
    "CaseMessage",
    # Department models
    "Department",
    # User models
    "User",
    "UserRole",
]
