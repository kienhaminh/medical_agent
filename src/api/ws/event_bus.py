"""In-memory event bus that routes WSEvents to the ConnectionManager."""

import logging

from .events import WSEvent, WSEventType
from .connection_manager import manager

logger = logging.getLogger(__name__)


class EventBus:
    """Routes events to the correct ConnectionManager dispatch method."""

    async def emit(self, event: WSEvent):
        """Dispatch an event based on its target_type."""
        logger.debug("Event emitted: type=%s target=%s:%s", event.type, event.target_type, event.target_id)
        if event.target_type == "user":
            await manager.send_to_user(event.target_id, event)
        elif event.target_type == "room":
            await manager.send_to_room(event.target_id, event)
        elif event.target_type == "role":
            # target_id format: "department:role"
            parts = event.target_id.split(":", 1)
            if len(parts) == 2:
                await manager.send_to_role(parts[0], parts[1], event)
            else:
                logger.warning("Invalid role target_id format: %s (expected 'department:role')", event.target_id)

    async def emit_to_room(self, room: str, event_type: WSEventType, payload: dict, severity: str = "info"):
        """Helper: emit an event targeting a department room."""
        await self.emit(WSEvent(
            type=event_type,
            payload=payload,
            target_type="room",
            target_id=room,
            severity=severity,
        ))

    async def emit_to_user(self, user_id: str, event_type: WSEventType, payload: dict, severity: str = "info"):
        """Helper: emit an event targeting a specific user."""
        await self.emit(WSEvent(
            type=event_type,
            payload=payload,
            target_type="user",
            target_id=user_id,
            severity=severity,
        ))


# Module-level singleton
event_bus = EventBus()
