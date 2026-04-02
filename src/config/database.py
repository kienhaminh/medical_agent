"""Database configuration - compatibility layer.

This module re-exports from src.models for backwards compatibility.
New code should import directly from src.models.
"""
from src.models import (
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
    Patient,
    MedicalRecord,
    Imaging,
    ImageGroup,
    ChatSession,
    ChatMessage,
)

__all__ = [
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
    "Patient",
    "MedicalRecord",
    "Imaging",
    "ImageGroup",
    "ChatSession",
    "ChatMessage",
]
