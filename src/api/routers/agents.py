"""Agents router — returns empty list (single-agent architecture)."""

from fastapi import APIRouter

router = APIRouter(tags=["Agents"])


@router.get("/api/agents")
async def list_agents():
    """List available agents. Returns empty list (single-agent architecture)."""
    return []
