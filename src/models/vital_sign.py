"""VitalSign model — point-in-time vitals, optionally tied to a visit."""
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class VitalSign(Base):
    """A set of vitals readings recorded at one point in time."""
    __tablename__ = "vital_signs"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    visit_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("visits.id"), nullable=True, index=True
    )
    recorded_at: Mapped[datetime] = mapped_column(DateTime)
    systolic_bp: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    diastolic_bp: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    heart_rate: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    temperature: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    respiratory_rate: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    oxygen_saturation: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    weight_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    height_cm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    patient: Mapped["Patient"] = relationship(backref="vital_signs")
