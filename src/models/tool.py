"""CustomTool model."""
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class CustomTool(Base):
    """Custom tool model for storing user-defined tools."""
    __tablename__ = "tools"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    symbol: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[str] = mapped_column(Text)
    tool_type: Mapped[str] = mapped_column(String(20), default="function")
    code: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    api_endpoint: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    api_request_payload: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    api_request_example: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    api_response_payload: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    api_response_example: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    scope: Mapped[str] = mapped_column(String(20), default="global")
    assigned_agent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("sub_agents.id"), nullable=True, index=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    test_passed: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    agent: Mapped[Optional["SubAgent"]] = relationship(back_populates="tools")
