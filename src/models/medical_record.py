"""MedicalRecord model."""
from datetime import datetime
from typing import List, Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector

from .base import Base


class MedicalRecord(Base):
    """Medical record model for storing patient medical records."""
    __tablename__ = "medical_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    record_type: Mapped[str] = mapped_column(String(50))  # "text", "image", "pdf"
    content: Mapped[str] = mapped_column(Text)  # Text content or file path/URL
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    embedding: Mapped[Optional[List[float]]] = mapped_column(Vector(768), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    patient: Mapped["Patient"] = relationship(back_populates="records")
