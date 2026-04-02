"""Privacy vault for patient intake PII."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class IntakeSubmission(Base):
    """Stores raw patient intake PII, keyed by opaque UUID.

    The agent never receives these values — it only receives the
    (patient_id, intake_id) pair returned by vault.save_intake().
    """
    __tablename__ = "intake_submissions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), nullable=False, index=True)

    # Personal info
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    dob: Mapped[str] = mapped_column(String(20))
    gender: Mapped[str] = mapped_column(String(20))

    # Contact
    phone: Mapped[str] = mapped_column(String(30))
    email: Mapped[Optional[str]] = mapped_column(String(254), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Visit
    chief_complaint: Mapped[str] = mapped_column(Text)
    symptoms: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Insurance — no longer collected; kept for future use
    insurance_provider: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    policy_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Emergency contact — no longer collected; kept for future use
    emergency_contact_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    emergency_contact_relationship: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    emergency_contact_phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)

    # JSON blob for dynamic fields that don't map to fixed columns above.
    extra_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # No back_populates on Patient — intake submissions are write-only from
    # the agent's perspective. The agent only ever receives opaque IDs.
    patient: Mapped["Patient"] = relationship("Patient")
