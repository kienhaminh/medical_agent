"""API router for skills — filesystem-only, no database."""

import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)
from pydantic import BaseModel

from src.skills.registry import SkillRegistry
from src.api.error_handlers import raise_internal_error

router = APIRouter(tags=["Skills"])


# Request/Response models
class SkillInfo(BaseModel):
    """Skill information response model."""
    name: str
    description: str
    when_to_use: List[str]
    when_not_to_use: List[str]
    keywords: List[str]
    examples: List[str]
    source_type: str
    tool_count: int


class ReloadRequest(BaseModel):
    """Request model for reloading skills."""
    skill_name: Optional[str] = None  # If None, reload all


def get_skill_registry() -> SkillRegistry:
    """Get or create SkillRegistry singleton."""
    return SkillRegistry()


# ============================================================================
# Skill Read Operations (from in-memory registry)
# ============================================================================

@router.get("/api/skills", response_model=List[SkillInfo])
async def list_skills():
    """List all registered skills from the in-memory registry."""
    try:
        registry = get_skill_registry()
        return registry.list_skills()
    except Exception as e:
        raise_internal_error(logger, "Error listing skills", e)


@router.get("/api/skills/{name}", response_model=SkillInfo)
async def get_skill(name: str):
    """Get detailed information about a specific skill."""
    try:
        registry = get_skill_registry()
        skill = registry.get(name)

        if not skill:
            raise HTTPException(status_code=404, detail=f"Skill '{name}' not found")

        return skill.to_dict()
    except HTTPException:
        raise
    except Exception as e:
        raise_internal_error(logger, "Error getting skill", e)


# ============================================================================
# Hot Reload Operations (filesystem only)
# ============================================================================

@router.post("/api/skills/reload")
async def reload_skills(request: Optional[ReloadRequest] = None):
    """Reload skills from filesystem.

    If skill_name is provided, reload only that skill.
    Otherwise, auto-reload all changed filesystem skills.
    """
    try:
        registry = get_skill_registry()

        if request and request.skill_name:
            skill = await registry.reload_skill(request.skill_name)
            if skill:
                return {
                    "reloaded": [request.skill_name],
                    "message": f"Skill '{request.skill_name}' reloaded successfully"
                }
            else:
                raise HTTPException(
                    status_code=404,
                    detail=f"Skill '{request.skill_name}' not found or could not be reloaded"
                )
        else:
            count = await registry.auto_reload()
            return {
                "filesystem_reloaded": count,
                "message": f"Reloaded {count} changed skills from filesystem"
            }

    except HTTPException:
        raise
    except Exception as e:
        raise_internal_error(logger, "Error reloading skills", e)


@router.get("/api/skills/check-changes")
async def check_skill_changes():
    """Check which filesystem-based skills have changes."""
    try:
        registry = get_skill_registry()
        changed = await registry.check_for_changes()

        return {
            "changed_skills": changed,
            "count": len(changed)
        }
    except Exception as e:
        raise_internal_error(logger, "Error checking changes", e)


@router.post("/api/skills/discover")
async def discover_skills(paths: List[str], recursive: bool = False):
    """Discover skills from filesystem paths."""
    try:
        registry = get_skill_registry()
        count = registry.discover_skills(paths, recursive=recursive)

        return {
            "discovered": count,
            "paths": paths,
            "message": f"Discovered {count} skills from {len(paths)} paths"
        }
    except Exception as e:
        raise_internal_error(logger, "Error discovering skills", e)
