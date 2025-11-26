#!/bin/bash
# Start Celery worker for development

echo "Starting Celery worker..."
python3 -m celery -A src.tasks worker --loglevel=info --concurrency=2

# To run in background:
# python3 -m celery -A src.tasks worker --loglevel=info --concurrency=2 --detach

# To start Flower monitoring UI (in another terminal):
# python3 -m celery -A src.tasks flower --port=5555
