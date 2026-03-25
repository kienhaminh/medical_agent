"""Visit model for tracking patient encounters."""
import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Index, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class VisitStatus(str, enum.Enum):
    """Visit lifecycle states."""
    INTAKE = "intake"
    TRIAGED = "triaged"
    AUTO_ROUTED = "auto_routed"
    PENDING_REVIEW = "pending_review"
    ROUTED = "routed"
    IN_DEPARTMENT = "in_department"
    COMPLETED = "completed"


# Confidence threshold for auto-routing
AUTO_ROUTE_THRESHOLD = 0.7


class Visit(Base):
    """Visit model — tracks a single patient encounter through the hospital."""
    __tablename__ = "visits"

    id: Mapped[int] = mapped_column(primary_key=True)
    visit_id: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    status: Mapped[str] = mapped_column(
        Enum(VisitStatus, values_callable=lambda x: [e.value for e in x]),
        default=VisitStatus.INTAKE.value,
    )
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    routing_suggestion: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    routing_decision: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    chief_complaint: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    intake_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    intake_session_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("chat_sessions.id"), nullable=True
    )
    reviewed_by: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    # Department tracking — which department the patient is currently in and their queue position
    current_department: Mapped[Optional[str]] = mapped_column(
        String(50), ForeignKey("departments.name"), nullable=True
    )
    queue_position: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), onupdate=func.now()
    )

    # Relationships
    patient: Mapped["Patient"] = relationship()
    intake_session: Mapped[Optional["ChatSession"]] = relationship()

    __table_args__ = (
        Index("ix_visits_status", "status"),
        Index("ix_visits_created_at", "created_at"),
    )
