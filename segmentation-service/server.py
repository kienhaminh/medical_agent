"""BraTS segmentation HTTP service — FastAPI entry point."""
import asyncio
import logging
import uuid
from dataclasses import dataclass

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, model_validator

from inference import SegmentParams, segment_brats

logger = logging.getLogger(__name__)
app = FastAPI(title="BraTS Segmentation Service")


@dataclass
class JobState:
    status: str = "queued"
    result: dict | None = None
    error: str | None = None


_jobs: dict[str, JobState] = {}


class SegmentRequest(BaseModel):
    patient_id: str
    flair_url: str | None = None
    t1_url: str | None = None
    t1ce_url: str | None = None
    t2_url: str | None = None
    slice_index: int = -1
    fold: int = 3
    alpha: float = 0.45

    @model_validator(mode="after")
    def require_at_least_one_modality(self) -> "SegmentRequest":
        if not any([self.flair_url, self.t1_url, self.t1ce_url, self.t2_url]):
            raise ValueError("At least one modality URL must be provided")
        return self


@app.post("/segment", status_code=202)
async def submit_segment(body: SegmentRequest):
    job_id = str(uuid.uuid4())
    _jobs[job_id] = JobState()
    params = SegmentParams(
        patient_id=body.patient_id,
        flair_url=body.flair_url,
        t1_url=body.t1_url,
        t1ce_url=body.t1ce_url,
        t2_url=body.t2_url,
        slice_index=body.slice_index,
        fold=body.fold,
        alpha=body.alpha,
    )
    asyncio.create_task(asyncio.to_thread(_run_inference, job_id, params))
    return {"job_id": job_id, "status": "queued"}


@app.get("/segment/{job_id}")
async def get_segment_status(job_id: str):
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "job_id": job_id,
        "status": job.status,
        "result": job.result,
        "error": job.error,
    }


def _run_inference(job_id: str, params: SegmentParams) -> None:
    """Synchronous wrapper executed in a thread pool via asyncio.to_thread."""
    job = _jobs[job_id]
    try:
        job.status = "running"
        job.result = segment_brats(params)
        job.status = "complete"
    except Exception as exc:
        logger.exception("Inference failed for job %s", job_id)
        job.error = str(exc)
        job.status = "error"
