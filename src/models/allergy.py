"""Allergy model — known patient allergies with clinical severity."""
from datetime import date

from sqlalchemy import Date, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Allergy(Base):
    """A known allergy for a patient."""
    __tablename__ = "allergies"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    allergen: Mapped[str] = mapped_column(String(200))
    reaction: Mapped[str] = mapped_column(String(200))
    severity: Mapped[str] = mapped_column(String(20))  # mild | moderate | severe
    recorded_at: Mapped[date] = mapped_column(Date)

    patient: Mapped["Patient"] = relationship(back_populates="allergies")
