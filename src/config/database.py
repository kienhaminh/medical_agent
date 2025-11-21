import os
from typing import List, Optional
from datetime import datetime
from sqlalchemy import String, Text, DateTime, ForeignKey, Boolean, func
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector

# Database URL
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql+asyncpg://postgres:postgres@localhost:5432/medinexus"
)

# Async Engine
engine = create_async_engine(DATABASE_URL, echo=False)

# Session Factory
AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

class Base(DeclarativeBase):
    pass

# --- Models ---

class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    dob: Mapped[str] = mapped_column(String(20)) # Date of Birth
    gender: Mapped[str] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    
    records: Mapped[List["MedicalRecord"]] = relationship(back_populates="patient", cascade="all, delete-orphan")

class MedicalRecord(Base):
    __tablename__ = "medical_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    record_type: Mapped[str] = mapped_column(String(50)) # "text", "image", "pdf"
    content: Mapped[str] = mapped_column(Text) # Text content or file path/URL
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    embedding: Mapped[Optional[List[float]]] = mapped_column(Vector(768), nullable=True) # For semantic search
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    patient: Mapped["Patient"] = relationship(back_populates="records")

class ToolConfig(Base):
    __tablename__ = "tool_configs"

    name: Mapped[str] = mapped_column(String(100), primary_key=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())

# --- Dependency ---

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

async def init_db():
    # Create pgvector extension first
    async with engine.begin() as conn:
        await conn.execute(func.text("CREATE EXTENSION IF NOT EXISTS vector"))
    
    # Dispose engine to force new connections that will load the new 'vector' type
    await engine.dispose()
    
# Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# --- Synchronous Database Access (for Tools) ---
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

# Sync Database URL (same as async but with psycopg2 or similar if needed, 
# but sqlalchemy can often use the same URL string if the driver is handled. 
# However, asyncpg is async only. We need a sync driver like psycopg2 or default.)
# We'll try to infer a sync URL or just use a default one for now.
# Assuming standard postgres URL format.
SYNC_DATABASE_URL = DATABASE_URL.replace("+asyncpg", "")

sync_engine = create_engine(SYNC_DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=sync_engine)

class CustomTool(Base):
    __tablename__ = "custom_tools"

    name: Mapped[str] = mapped_column(String(100), primary_key=True)
    description: Mapped[str] = mapped_column(Text)
    code: Mapped[str] = mapped_column(Text)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
