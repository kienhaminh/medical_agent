"""VisitStep model — one row per patient itinerary stop."""
import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class StepStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    DONE = "done"


class VisitStep(Base):
    """A single stop in the patient's visit itinerary.

    Created by set_itinerary tool. First agent-provided step starts as
    ACTIVE; a Registration step is auto-prepended as DONE.
    """
    __tablename__ = "visit_steps"

    id: Mapped[int] = mapped_column(primary_key=True)
    visit_id: Mapped[int] = mapped_column(ForeignKey("visits.id"), index=True)
    step_order: Mapped[int] = mapped_column(Integer)
    # department FK is nullable — steps like "Blood Test Lab" may not map to a dept row
    department: Mapped[Optional[str]] = mapped_column(
        String(50), ForeignKey("departments.name"), nullable=True
    )
    label: Mapped[str] = mapped_column(String(200))
    description: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)
    room: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(
        Enum(StepStatus, values_callable=lambda x: [e.value for e in x]),
        default=StepStatus.PENDING.value,
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    visit: Mapped["Visit"] = relationship(back_populates="steps")
