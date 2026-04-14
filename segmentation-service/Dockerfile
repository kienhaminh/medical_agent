FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# CPU-only PyTorch — separate layer for cache efficiency (~600 MB vs ~2 GB for CUDA)
RUN pip install --no-cache-dir torch==2.7.0 --index-url https://download.pytorch.org/whl/cpu

COPY segmentation-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Application code
COPY segmentation-service/server.py .
COPY segmentation-service/inference.py .

# Reuse models and checkpoints from segmentation-mcp — no duplication
COPY segmentation-mcp/models/ models/
COPY segmentation-mcp/checkpoint/BraTS2020 checkpoint/BraTS2020

# Supabase Storage — must be supplied at runtime
ENV SUPABASE_URL=
ENV SUPABASE_SERVICE_ROLE_KEY=
ENV SUPABASE_STORAGE_BUCKET=medical_images

EXPOSE 8000

# Single worker — job store is in-memory; multiple workers would have separate stores
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
