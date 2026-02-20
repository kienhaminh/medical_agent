"""Patient model."""
from datetime import datetime
from typing import List, Optional

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector

from .base import Base


class Patient(Base):
    """Patient model for storing patient information."""
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    dob: Mapped[str] = mapped_column(String(20))  # Date of Birth
    gender: Mapped[str] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    
    # AI-generated health summary
    health_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    health_summary_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    health_summary_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    health_summary_task_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    embedding: Mapped[Optional[List[float]]] = mapped_column(Vector(768), nullable=True)
    
    # Relationships
    records: Mapped[List["MedicalRecord"]] = relationship(
        back_populates="patient", 
        cascade="all, delete-orphan"
    )
    imaging: Mapped[List["Imaging"]] = relationship(
        back_populates="patient", 
        cascade="all, delete-orphan"
    )
    image_groups: Mapped[List["ImageGroup"]] = relationship(
        back_populates="patient", 
        cascade="all, delete-orphan"
    )
