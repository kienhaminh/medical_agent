"""WebSocket event type definitions and routing configuration."""

from enum import Enum
from typing import Literal

from pydantic import BaseModel


class WSEventType(str, Enum):
    """All WebSocket event types emitted by the system."""

    # Visit lifecycle
    VISIT_CREATED = "visit.created"
    VISIT_ROUTED = "visit.routed"
    VISIT_CHECKED_IN = "visit.checked_in"
    VISIT_COMPLETED = "visit.completed"
    VISIT_TRANSFERRED = "visit.transferred"
    VISIT_NOTES_UPDATED = "visit.notes_updated"

    # Queue updates (broadcast after position shifts)
    QUEUE_UPDATED = "queue.updated"

    # Patient itinerary step advanced
    STEP_UPDATED = "step.updated"

    # AI-generated insights
    AI_INSIGHT = "ai.insight"

    # Critical lab value alert
    LAB_CRITICAL = "lab.critical"

    # Imaging segmentation complete
    IMAGING_SEGMENTATION = "imaging.segmentation"


class WSEvent(BaseModel):
    """A single WebSocket event to be dispatched."""

    type: WSEventType
    payload: dict
    target_type: Literal["room", "role", "user"]
    target_id: str
    severity: Literal["info", "warning", "critical"] = "info"


# Notification routing — which UI layers each event triggers
# bell = header notification dropdown, inline = Zone A/B live updates, toast = urgent popup
NOTIFICATION_ROUTING: dict[WSEventType, dict[str, bool]] = {
    WSEventType.VISIT_CREATED:    {"bell": True,  "inline": True,  "toast": False},
    WSEventType.VISIT_ROUTED:     {"bell": True,  "inline": True,  "toast": False},
    WSEventType.VISIT_CHECKED_IN: {"bell": True,  "inline": True,  "toast": False},
    WSEventType.VISIT_COMPLETED:  {"bell": True,  "inline": True,  "toast": False},
    WSEventType.VISIT_TRANSFERRED:  {"bell": True,  "inline": True,  "toast": False},
    WSEventType.VISIT_NOTES_UPDATED: {"bell": False, "inline": True,  "toast": False},
    WSEventType.QUEUE_UPDATED:    {"bell": False, "inline": True,  "toast": False},
    WSEventType.STEP_UPDATED:     {"bell": False, "inline": True,  "toast": False},
    WSEventType.AI_INSIGHT:       {"bell": False, "inline": False, "toast": False},
    WSEventType.LAB_CRITICAL:     {"bell": True,  "inline": True,  "toast": True},
    WSEventType.IMAGING_SEGMENTATION: {"bell": True, "inline": False, "toast": True},
}
