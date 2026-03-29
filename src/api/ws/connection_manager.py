"""WebSocket connection manager with room-based targeting."""

import logging
from typing import Optional

from fastapi import WebSocket
from starlette.websockets import WebSocketState

from .events import WSEvent

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections, department rooms, and event dispatch."""

    def __init__(self):
        # user_id -> WebSocket
        self.active_connections: dict[str, WebSocket] = {}
        # department_name -> set of user_ids
        self.rooms: dict[str, set[str]] = {}
        # user_id -> {role, department, name}
        self.user_meta: dict[str, dict] = {}

    async def connect(
        self,
        websocket: WebSocket,
        user_id: str,
        role: str,
        department: Optional[str] = None,
        name: Optional[str] = None,
    ):
        """Accept a WebSocket connection and join the user's department room."""
        await websocket.accept()
        self.active_connections[user_id] = websocket
        self.user_meta[user_id] = {
            "role": role,
            "department": department,
            "name": name,
        }
        if department:
            if department not in self.rooms:
                self.rooms[department] = set()
            self.rooms[department].add(user_id)
        logger.info("WS connected: user=%s role=%s dept=%s", user_id, role, department)

    def disconnect(self, user_id: str):
        """Remove a user from connections and their department room."""
        self.active_connections.pop(user_id, None)
        meta = self.user_meta.pop(user_id, {})
        department = meta.get("department")
        if department and department in self.rooms:
            self.rooms[department].discard(user_id)
            if not self.rooms[department]:
                del self.rooms[department]
        logger.info("WS disconnected: user=%s", user_id)

    async def send_to_user(self, user_id: str, event: WSEvent):
        """Send an event to a specific user."""
        ws = self.active_connections.get(user_id)
        if ws and ws.client_state == WebSocketState.CONNECTED:
            try:
                await ws.send_json(event.model_dump(mode="json"))
            except Exception:
                logger.warning("Failed to send to user=%s, removing connection", user_id)
                self.disconnect(user_id)

    async def send_to_room(self, room_name: str, event: WSEvent):
        """Broadcast an event to all users in a department room."""
        user_ids = list(self.rooms.get(room_name, set()))
        for user_id in user_ids:
            await self.send_to_user(user_id, event)

    async def send_to_role(self, room_name: str, role: str, event: WSEvent):
        """Broadcast an event to users with a specific role in a department room."""
        user_ids = list(self.rooms.get(room_name, set()))
        for user_id in user_ids:
            meta = self.user_meta.get(user_id, {})
            if meta.get("role") == role:
                await self.send_to_user(user_id, event)

    @property
    def connection_count(self) -> int:
        return len(self.active_connections)


# Module-level singleton
manager = ConnectionManager()
