"""Celery application for background task processing."""
from celery import Celery
from dotenv import load_dotenv
from ..config.settings import load_config

load_dotenv()

# Load configuration
config = load_config()

# Initialize Celery app
celery_app = Celery(
    "ai_agent",
    broker=config.redis_url,
    backend=config.redis_url,
)

# Load configuration
celery_app.config_from_object("src.tasks.config")

# Import tasks to ensure they're registered
from . import agent_tasks  # noqa: F401

__all__ = ["celery_app"]
