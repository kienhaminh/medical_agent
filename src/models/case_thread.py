"""CaseThread and CaseMessage models — specialist team consultation threads."""
import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class CaseThread(Base):
    """A specialist team consultation thread for one patient case."""

    __tablename__ = "case_threads"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    visit_id: Mapped[Optional[int]] = mapped_column(ForeignKey("visits.id"), nullable=True, index=True)
    created_by: Mapped[str] = mapped_column(String(100))  # e.g. "doctor:session_42"
    trigger: Mapped[str] = mapped_column(String(20))  # "manual" | "auto"
    status: Mapped[str] = mapped_column(String(20), default="open")  # "open" | "converged" | "closed"
    max_rounds: Mapped[int] = mapped_column(Integer, default=3)
    current_round: Mapped[int] = mapped_column(Integer, default=0)
    case_summary: Mapped[str] = mapped_column(Text)  # Chief's structured brief
    synthesis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Chief's final output
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())

    messages: Mapped[List["CaseMessage"]] = relationship(
        back_populates="thread",
        cascade="all, delete-orphan",
        order_by="CaseMessage.created_at",
    )


class CaseMessage(Base):
    """A single message in a CaseThread — from a specialist or the Chief."""

    __tablename__ = "case_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    thread_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("case_threads.id", ondelete="CASCADE"), index=True
    )
    round: Mapped[int] = mapped_column(Integer)
    sender_type: Mapped[str] = mapped_column(String(20))  # "specialist" | "chief"
    specialist_role: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    content: Mapped[str] = mapped_column(Text)
    agrees_with: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    challenges: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    thread: Mapped["CaseThread"] = relationship(back_populates="messages")
