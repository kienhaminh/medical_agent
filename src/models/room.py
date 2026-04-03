"""Room model — one clinical exam room per row, one patient at a time."""
from typing import Optional

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Room(Base):
    """Room model — one physical exam room within a department, occupied by at most one visit."""

    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(primary_key=True)
    room_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    department_name: Mapped[str] = mapped_column(String(50), ForeignKey("departments.name"), index=True)
    current_visit_id: Mapped[Optional[int]] = mapped_column(ForeignKey("visits.id"), nullable=True)
