# Segmentation HTTP Service — Design Spec

**Date:** 2026-04-14  
**Status:** Approved

---

## Overview

Replace the existing MCP-based segmentation server (`segmentation-mcp/mcp_server.py`) with a plain FastAPI HTTP service. The new service exposes two endpoints: one to submit a segmentation job and one to poll its status. The main backend (`segmentation_worker.py`) is updated to call these endpoints instead of the MCP client.

---

## Architecture

### What changes

| Component | Before | After |
|-----------|--------|-------|
| Segmentation server | `segmentation-mcp/mcp_server.py` (FastMCP) | `segmentation-service/server.py` (FastAPI) |
| Dockerfile | `segmentation-mcp/Dockerfile.mcp` | `segmentation-service/Dockerfile` |
| docker-compose service | `segmentation-mcp` | `segmentation` |
| Env var | `SEGMENTATION_MCP_URL` | `SEGMENTATION_URL` |
| Worker HTTP client | `mcp.client.streamable_http` | `requests` + `asyncio.to_thread()` |

### What stays the same

- All inference logic: model loading, NIfTI preprocessing, crop, inference, overlay rendering, Supabase upload
- Response payload JSON shape — no schema changes in the main backend
- Port mapping: `8010:8000`

---

## Segmentation Service (`segmentation-service/`)

### File layout

```
segmentation-service/
  server.py          # FastAPI app, job store, endpoints, inference logic
  models/            # copied from segmentation-mcp/models/
  checkpoint/        # BraTS2020 checkpoints only
  requirements.txt
  Dockerfile
```

### Endpoints

#### `POST /segment`

Accepts modality URLs and inference parameters, spawns a background task, returns a job ID immediately.

**Request body:**
```json
{
  "patient_id": "123",
  "flair_url": "https://...",
  "t1_url": null,
  "t1ce_url": "https://...",
  "t2_url": null,
  "slice_index": -1,
  "fold": 3,
  "alpha": 0.45
}
```

- At least one of `flair_url`, `t1_url`, `t1ce_url`, `t2_url` must be non-null (validated at request time)
- `imaging_id` is dropped — the service generates a UUID internally for Supabase storage path uniqueness
- Storage path pattern: `patients/{patient_id}/slices/{uuid}/mri_z{z}.jpg`

**Response `202 Accepted`:**
```json
{"job_id": "<uuid>", "status": "queued"}
```

#### `GET /segment/{job_id}`

Returns the current job status and result when complete.

**Response:**
```json
{
  "job_id": "<uuid>",
  "status": "queued | running | complete | error",
  "result": { ... },
  "error": null
}
```

- `result` is populated only when `status == "complete"` — same JSON shape as the existing MCP tool result
- `error` is a string message when `status == "error"`
- Returns `404` if `job_id` is unknown

### Job store

In-memory `dict[str, JobState]` where `JobState` is a dataclass:
```python
@dataclass
class JobState:
    status: str        # queued | running | complete | error
    result: dict | None = None
    error: str | None = None
```

Jobs are never evicted (acceptable for demo scale). Lost on server restart; incomplete jobs must be re-triggered by the main backend.

### Background inference

Each submitted job runs via `asyncio.create_task(asyncio.to_thread(_run_inference, job_id, params))`. The inference function is the existing segmentation logic extracted from `mcp_server.py`, unchanged except:
- `imaging_id` parameter removed; internal UUID used for paths
- Returns result dict directly instead of through MCP

### Docker

```dockerfile
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# CPU-only PyTorch (separate layer for cache efficiency)
RUN pip install --no-cache-dir torch==2.7.0 --index-url https://download.pytorch.org/whl/cpu

COPY segmentation-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY segmentation-service/server.py .
COPY segmentation-service/models/ models/
COPY segmentation-service/checkpoint/BraTS2020 checkpoint/BraTS2020

ENV HOST=0.0.0.0
ENV PORT=8000
ENV SUPABASE_URL=
ENV SUPABASE_SERVICE_ROLE_KEY=
ENV SUPABASE_STORAGE_BUCKET=medical_images

EXPOSE 8000

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
```

### `requirements.txt`

```
fastapi
uvicorn[standard]
numpy
nibabel
pillow
requests
einops
supabase
```

---

## Main Backend Changes

### `segmentation_worker.py`

Replace the MCP client block (Step 2) with:

1. `POST {SEGMENTATION_URL}/segment` with modality URLs and parameters → receive `job_id`
2. Poll `GET {SEGMENTATION_URL}/segment/{job_id}` every 10 seconds (max 60 attempts = 10 min timeout)
3. On `complete`: extract `result["result"]` — identical shape to current `segmentation_payload`
4. On `error`: raise exception with `result["error"]`

Remove imports: `from mcp import ClientSession`, `from mcp.client.streamable_http import streamablehttp_client`

Env var read: `os.getenv("SEGMENTATION_URL", "http://localhost:8010")`

### `medical_img_segmentation_tool.py`

- Remove the `_mcp_url()` call on line 126 (function never existed — leftover bug)
- Drop the `mcp_url` key from the error return dict

### `docker-compose.yml`

```yaml
segmentation:                          # was: segmentation-mcp
  build:
    context: .
    dockerfile: segmentation-service/Dockerfile
  container_name: medical-agent-segmentation
  ports:
    - "8010:8000"
  env_file:
    - .env
  environment:
    - HOST=0.0.0.0
    - PORT=8000
  restart: unless-stopped
```

### Environment variables

| Variable | Old value | New value |
|----------|-----------|-----------|
| `SEGMENTATION_MCP_URL` | `http://localhost:8010/mcp` | removed |
| `SEGMENTATION_URL` | — | `http://localhost:8010` |
