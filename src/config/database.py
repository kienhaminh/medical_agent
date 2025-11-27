import os
from typing import List, Optional
from datetime import datetime
from sqlalchemy import String, Text, DateTime, ForeignKey, Boolean, func, UniqueConstraint, Integer
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL", "")

ASYNC_DATABASE_URL = DATABASE_URL.replace("+psycopg2", "+asyncpg") if "+psycopg2" in DATABASE_URL else DATABASE_URL

# Async Engine
# Use NullPool to avoid sharing connections across event loops in Celery workers
from sqlalchemy.pool import NullPool

engine = create_async_engine(
    ASYNC_DATABASE_URL,
    echo=False,
    poolclass=NullPool,  # Don't pool connections to avoid event loop conflicts in Celery
    pool_pre_ping=True,  # Verify connections before using them
)

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
    
    # AI-generated health summary
    health_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    health_summary_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    health_summary_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # 'pending' | 'generating' | 'completed' | 'error'
    health_summary_task_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # Celery task ID
    embedding: Mapped[Optional[List[float]]] = mapped_column(Vector(768), nullable=True) # For semantic search
    
    records: Mapped[List["MedicalRecord"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    imaging: Mapped[List["Imaging"]] = relationship(back_populates="patient", cascade="all, delete-orphan")
    image_groups: Mapped[List["ImageGroup"]] = relationship(back_populates="patient", cascade="all, delete-orphan")

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

class Imaging(Base):
    __tablename__ = "imaging"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    title: Mapped[str] = mapped_column(String(200))
    image_type: Mapped[str] = mapped_column(String(50)) # x-ray, t1, t1ce, t2, flair
    original_url: Mapped[str] = mapped_column(Text)
    preview_url: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    patient: Mapped["Patient"] = relationship(back_populates="imaging")

    group_id: Mapped[Optional[int]] = mapped_column(ForeignKey("image_groups.id"), nullable=True)
    group: Mapped[Optional["ImageGroup"]] = relationship(back_populates="images")

class ImageGroup(Base):
    __tablename__ = "image_groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    name: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    patient: Mapped["Patient"] = relationship(back_populates="image_groups")
    images: Mapped[List["Imaging"]] = relationship(back_populates="group")

# --- Dependency ---

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

async def init_db():
    """Initialize database with pgvector extension and create tables."""
    from sqlalchemy import text
    
    # Create pgvector extension first (Supabase has this available)
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    
    # Dispose engine to force new connections that will load the new 'vector' type
    await engine.dispose()
    
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# --- Synchronous Database Access (for Tools) ---
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

# Sync Engine
# NOTE: We must use the synchronous driver string (without +asyncpg)
SYNC_DATABASE_URL = DATABASE_URL.replace("+asyncpg", "+psycopg2") if "+asyncpg" in DATABASE_URL else DATABASE_URL

sync_engine = create_engine(
    SYNC_DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=sync_engine)

class Tool(Base):
    __tablename__ = "tools"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    symbol: Mapped[str] = mapped_column(String(100), unique=True)  # snake_case identifier
    description: Mapped[str] = mapped_column(Text)
    tool_type: Mapped[str] = mapped_column(String(20), default="function")  # 'function' or 'api'
    code: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # For function type
    api_endpoint: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # For api type
    api_request_payload: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON schema for request
    api_request_example: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON example for request
    api_response_payload: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON schema for response
    api_response_example: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON example for response
    scope: Mapped[str] = mapped_column(String(20), default="global")  # 'global' or 'assignable'
    assigned_agent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("sub_agents.id"), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    test_passed: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    agent: Mapped[Optional["SubAgent"]] = relationship(back_populates="tools")

class SubAgent(Base):
    """Sub-agent model for multi-agent system."""
    __tablename__ = "sub_agents"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    role: Mapped[str] = mapped_column(String(50))  # 'imaging', 'lab_results', 'drug_interaction', 'clinical_text'
    description: Mapped[str] = mapped_column(Text)
    system_prompt: Mapped[str] = mapped_column(Text)  # Fully editable agent instructions
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    color: Mapped[str] = mapped_column(String(20))  # Hex color for UI theming
    icon: Mapped[str] = mapped_column(String(50))  # Lucide icon name
    is_template: Mapped[bool] = mapped_column(Boolean, default=False)  # Is this a predefined template?
    parent_template_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("sub_agents.id"), nullable=True)  # Cloned from which template?
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    tools: Mapped[List["Tool"]] = relationship(
        back_populates="agent",
        cascade="all, delete-orphan"
    )

    # Self-referential for template cloning
    cloned_agents: Mapped[List["SubAgent"]] = relationship(
        foreign_keys=[parent_template_id],
        remote_side=[id]
    )

class ChatSession(Base):
    """Chat session model for storing conversation history."""
    __tablename__ = "chat_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))  # Auto-generated or user-provided
    agent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("sub_agents.id"), nullable=True)  # Which agent handled this
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    messages: Mapped[List["ChatMessage"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at"
    )
    agent: Mapped[Optional["SubAgent"]] = relationship()

class ChatMessage(Base):
    """Individual messages within a chat session."""
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("chat_sessions.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String(20))  # 'user', 'assistant', 'system'
    content: Mapped[str] = mapped_column(Text)
    tool_calls: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON string of tool calls
    reasoning: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Agent's reasoning
    patient_references: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON string of patient references
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    # Background task execution fields
    status: Mapped[str] = mapped_column(String(20), default="completed")  # 'pending', 'streaming', 'completed', 'error', 'interrupted'
    task_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # Celery task ID
    logs: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON array of LogItem[]
    streaming_started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    token_usage: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON string of TokenUsage
    last_updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    session: Mapped["ChatSession"] = relationship(back_populates="messages")
