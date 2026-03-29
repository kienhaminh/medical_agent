"""WebSocket endpoint for real-time doctor-nurse communication."""

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query

from src.utils.auth import decode_access_token
from src.api.ws.connection_manager import manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["WebSocket"])


async def _authenticate_ws(token: str) -> dict | None:
    """Validate JWT token from WebSocket query param and return user payload."""
    if not token:
        return None
    payload = decode_access_token(token)
    if not payload:
        return None
    return payload


@router.websocket("/ws/")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(default=""),
):
    """WebSocket connection for real-time events.

    Connect with: ws://host/ws/?token=<jwt>
    The server pushes WSEvent JSON objects.
    Client can send "ping" text for keepalive.
    """
    # Authenticate
    payload = await _authenticate_ws(token)
    if not payload:
        await websocket.close(code=4001, reason="Authentication failed")
        return

    user_id = payload["sub"]
    role = payload.get("role", "")
    username = payload.get("username", "")

    # Look up department from DB (cached in user meta)
    department = await _resolve_department(user_id)

    await manager.connect(
        websocket=websocket,
        user_id=user_id,
        role=role,
        department=department,
        name=username,
    )

    try:
        while True:
            # Listen for keepalive pings or client messages
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(user_id)
    except Exception as e:
        logger.warning("WS error for user=%s: %s", user_id, e)
        manager.disconnect(user_id)


async def _resolve_department(user_id: str) -> str | None:
    """Look up the user's department from the database."""
    try:
        from src.models.base import AsyncSessionLocal
        from src.models.user import User
        from sqlalchemy import select

        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(User.department).where(User.id == int(user_id))
            )
            return result.scalar_one_or_none()
    except Exception as e:
        logger.warning("Failed to resolve department for user=%s: %s", user_id, e)
        return None
