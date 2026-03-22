"""SubAgent model."""
from datetime import datetime
from typing import List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class SubAgent(Base):
    """Sub-agent model for multi-agent system."""
    __tablename__ = "sub_agents"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    role: Mapped[str] = mapped_column(String(50))  # 'imaging', 'lab_results', etc.
    description: Mapped[str] = mapped_column(Text)
    system_prompt: Mapped[str] = mapped_column(Text)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    color: Mapped[str] = mapped_column(String(20))  # Hex color for UI
    icon: Mapped[str] = mapped_column(String(50))  # Lucide icon name
    is_template: Mapped[bool] = mapped_column(Boolean, default=False)
    parent_template_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("sub_agents.id"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())

    # Relationships
    tools: Mapped[List["CustomTool"]] = relationship(
        back_populates="agent",
        cascade="all, delete-orphan"
    )
    
    # Relationship to skills
    skills: Mapped[List["Skill"]] = relationship(
        secondary="agent_skills",
        back_populates="assigned_agents",
        lazy="selectin"
    )

    # Self-referential for template cloning
    cloned_agents: Mapped[List["SubAgent"]] = relationship(
        foreign_keys=[parent_template_id],
        remote_side=[id]
    )
