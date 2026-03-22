"""Imaging and ImageGroup models."""
from datetime import datetime
from typing import List, Optional

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Imaging(Base):
    """Imaging model for storing medical images."""
    __tablename__ = "imaging"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    image_type: Mapped[str] = mapped_column(String(50))  # x-ray, t1, t1ce, t2, flair
    original_url: Mapped[str] = mapped_column(Text)
    preview_url: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    patient: Mapped["Patient"] = relationship(back_populates="imaging")

    group_id: Mapped[Optional[int]] = mapped_column(ForeignKey("image_groups.id"), nullable=True, index=True)
    group: Mapped[Optional["ImageGroup"]] = relationship(back_populates="images")


class ImageGroup(Base):
    """Image group model for organizing related medical images."""
    __tablename__ = "image_groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    patient: Mapped["Patient"] = relationship(back_populates="image_groups")
    images: Mapped[List["Imaging"]] = relationship(back_populates="group")
