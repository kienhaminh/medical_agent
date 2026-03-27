"""User model for authentication and role-based access control."""
import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Enum, String, func
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class UserRole(str, enum.Enum):
    """User roles for access control."""
    DOCTOR = "doctor"
    OFFICER = "officer"
    ADMIN = "admin"


class User(Base):
    """User model — staff accounts with role-based access."""
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(
        Enum(UserRole, values_callable=lambda x: [e.value for e in x]),
    )
    department: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
