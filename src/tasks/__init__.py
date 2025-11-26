"""Celery application for background task processing."""
import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

# Initialize Celery app
celery_app = Celery(
    "ai_agent",
    broker=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
    backend=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
)

# Load configuration
celery_app.config_from_object("src.tasks.config")

# Import tasks to ensure they're registered
from . import agent_tasks  # noqa: F401

__all__ = ["celery_app"]
