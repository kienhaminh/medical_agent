"""Celery configuration settings."""
from datetime import timedelta

# Task execution settings
task_serializer = "json"
accept_content = ["json"]
result_serializer = "json"
timezone = "UTC"
enable_utc = True

# Task result settings
result_expires = timedelta(hours=24)  # Results expire after 24 hours
result_extended = True  # Store additional metadata

# Task routing - using default queue for now
# task_routes = {
#     "src.tasks.agent_tasks.*": {"queue": "agent_queue"},
# }

# Worker settings
worker_prefetch_multiplier = 1  # Disable prefetching for long-running tasks
worker_max_tasks_per_child = 100  # Restart worker after 100 tasks to prevent memory leaks

# Task execution limits
task_soft_time_limit = 600  # 10 minutes soft limit
task_time_limit = 660  # 11 minutes hard limit
task_acks_late = True  # Acknowledge tasks after execution
task_reject_on_worker_lost = True  # Reject tasks if worker dies

# Retry settings
task_default_retry_delay = 30  # 30 seconds between retries
task_max_retries = 3  # Maximum 3 retries

# Beat schedule (for periodic tasks, if needed in future)
beat_schedule = {}

# Monitoring
worker_send_task_events = True
task_send_sent_event = True

# Security
task_always_eager = False  # Set to True for testing to run tasks synchronously
