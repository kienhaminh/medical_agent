import os
from typing import List, Optional
from datetime import datetime
from sqlalchemy import String, Text, DateTime, ForeignKey, Boolean, func, UniqueConstraint, Integer
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

class Tool(Base):
    __tablename__ = "tools"

    name: Mapped[str] = mapped_column(String(100), primary_key=True)
    description: Mapped[str] = mapped_column(Text)
    code: Mapped[str] = mapped_column(Text)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    scope: Mapped[str] = mapped_column(String(20), default="global")  # 'global', 'assignable', 'both'
    category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # 'medical', 'diagnostic', etc.
    assigned_agent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("sub_agents.id"), nullable=True)
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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    # Relationships
    session: Mapped["ChatSession"] = relationship(back_populates="messages")
