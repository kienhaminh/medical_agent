"""Imaging and ImageGroup models."""
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import DateTime, ForeignKey, JSON, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

# Use JSONB on PostgreSQL for indexing support; fall back to JSON on SQLite (tests)
_JSONB = JSON().with_variant(JSONB(), "postgresql")

from .base import Base


class Imaging(Base):
    """Imaging model for storing medical images per patient.

    Each record holds:
    - preview_url: JPG preview for display
    - original_url: path/URL to the .nii.gz source file
    - segmentation_result: raw JSON output returned by the MCP segmentation server
    """
    __tablename__ = "imaging"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    image_type: Mapped[str] = mapped_column(String(50))  # x-ray, t1, t1ce, t2, flair
    # JPG preview shown in the UI
    preview_url: Mapped[str] = mapped_column(Text)
    # Original .nii.gz file sent to the MCP segmentation server
    original_url: Mapped[str] = mapped_column(Text)
    # Full JSON payload returned by the segmentation MCP (null until segmentation runs)
    segmentation_result: Mapped[Optional[Dict[str, Any]]] = mapped_column(_JSONB, nullable=True)
    # Axial slice index used for the segmentation overlay (-1 = not yet set / auto-select)
    slice_index: Mapped[Optional[int]] = mapped_column(nullable=True)
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
