"""Order model — tracks lab and imaging orders created by doctors during visits."""
import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class OrderType(str, enum.Enum):
    LAB = "lab"
    IMAGING = "imaging"


class OrderStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Order(Base):
    """A lab or imaging order placed by a doctor during a patient visit."""
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    visit_id: Mapped[int] = mapped_column(ForeignKey("visits.id"), index=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    order_type: Mapped[str] = mapped_column(
        Enum(OrderType, values_callable=lambda x: [e.value for e in x]),
    )
    order_name: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(
        Enum(OrderStatus, values_callable=lambda x: [e.value for e in x]),
        default=OrderStatus.PENDING.value,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ordered_by: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=func.now(), onupdate=func.now()
    )
