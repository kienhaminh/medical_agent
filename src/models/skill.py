"""Skill model for database-driven skills."""
from datetime import datetime
from typing import List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Skill(Base):
    """Skill model for storing user-defined and system skills."""
    __tablename__ = "skills"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    description: Mapped[str] = mapped_column(Text)
    
    # Skill metadata (stored as JSON for flexibility)
    when_to_use: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    when_not_to_use: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    keywords: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    examples: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    
    # Source information
    source_type: Mapped[str] = mapped_column(String(20), default="filesystem")  # filesystem, database, plugin, external
    source_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)  # Path or URL
    
    # Status and versioning
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    version: Mapped[str] = mapped_column(String(20), default="1.0.0")
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)  # System skills can't be deleted
    
    # Hot-reload tracking
    last_loaded_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    file_hash: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)  # MD5 hash for change detection
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    tools: Mapped[List["SkillTool"]] = relationship(
        back_populates="skill",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    
    # Relationship to sub-agents that use this skill
    assigned_agents: Mapped[List["SubAgent"]] = relationship(
        secondary="agent_skills",
        back_populates="skills"
    )
    
    def to_dict(self) -> dict:
        """Convert skill to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "when_to_use": self.when_to_use or [],
            "when_not_to_use": self.when_not_to_use or [],
            "keywords": self.keywords or [],
            "examples": self.examples or [],
            "source_type": self.source_type,
            "source_path": self.source_path,
            "enabled": self.enabled,
            "version": self.version,
            "is_system": self.is_system,
            "tool_count": len(self.tools) if self.tools else 0,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class SkillTool(Base):
    """Tool model for skills - supports both code and config-based tools."""
    __tablename__ = "skill_tools"

    id: Mapped[int] = mapped_column(primary_key=True)
    skill_id: Mapped[int] = mapped_column(ForeignKey("skills.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text)
    
    # Tool implementation type
    implementation_type: Mapped[str] = mapped_column(String(20), default="code")  # code, config, api, composite
    
    # For code-based tools
    code: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    # For config-based tools (stored as JSON)
    config: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # Example config:
    # {
    #     "type": "api",
    #     "endpoint": "https://api.example.com/search",
    #     "method": "GET",
    #     "parameters": [...],
    #     "headers": {...}
    # }
    
    # Schema for parameters
    parameters_schema: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    # Status
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    order: Mapped[int] = mapped_column(Integer, default=0)  # For ordering tools within a skill
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())
    
    # Relationships
    skill: Mapped["Skill"] = relationship(back_populates="tools")
    
    def to_dict(self) -> dict:
        """Convert tool to dictionary."""
        return {
            "id": self.id,
            "skill_id": self.skill_id,
            "skill_name": self.skill.name if self.skill else None,
            "name": self.name,
            "description": self.description,
            "implementation_type": self.implementation_type,
            "config": self.config,
            "parameters_schema": self.parameters_schema,
            "enabled": self.enabled,
            "order": self.order,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# Association table for many-to-many relationship between SubAgent and Skill
class AgentSkill(Base):
    """Association table linking SubAgents to Skills."""
    __tablename__ = "agent_skills"
    
    agent_id: Mapped[int] = mapped_column(ForeignKey("sub_agents.id"), primary_key=True)
    skill_id: Mapped[int] = mapped_column(ForeignKey("skills.id"), primary_key=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    config: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # Skill-specific config for this agent
