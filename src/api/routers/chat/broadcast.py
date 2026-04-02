"""In-memory event broadcast for message streaming.

Replaces Redis pub/sub. Works for single-process (single uvicorn worker)
deployments. Each message_id has a list of asyncio.Queue subscribers;
background tasks publish to all of them.
"""
import asyncio
import logging
from collections import defaultdict

logger = logging.getLogger(__name__)

# message_id -> active subscriber queues (one per SSE connection)
_subscribers: dict[int, list[asyncio.Queue]] = defaultdict(list)
# message_id -> running asyncio.Task
_tasks: dict[int, asyncio.Task] = {}


def subscribe(message_id: int) -> asyncio.Queue:
    """Register a new subscriber queue for message_id."""
    q: asyncio.Queue = asyncio.Queue()
    _subscribers[message_id].append(q)
    return q


def unsubscribe(message_id: int, q: asyncio.Queue) -> None:
    """Remove a subscriber queue."""
    subs = _subscribers.get(message_id)
    if subs:
        try:
            subs.remove(q)
        except ValueError:
            pass
        if not subs:
            _subscribers.pop(message_id, None)


async def publish(message_id: int, event: dict) -> None:
    """Broadcast an event to all active subscribers of message_id."""
    for q in list(_subscribers.get(message_id, [])):
        await q.put(event)


def register_task(message_id: int, task: asyncio.Task) -> None:
    """Track a background task so callers can check if it is still running."""
    _tasks[message_id] = task
    task.add_done_callback(lambda _: _tasks.pop(message_id, None))


def is_running(message_id: int) -> bool:
    """Return True if a background task is actively processing message_id."""
    task = _tasks.get(message_id)
    return task is not None and not task.done()
