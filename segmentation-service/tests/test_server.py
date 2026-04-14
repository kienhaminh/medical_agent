"""Endpoint tests for the segmentation HTTP service."""
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent.parent))

# All deps (fastapi, torch, numpy, etc.) are installed via requirements.txt.
# Import server normally; heavy inference is mocked inside individual tests.
from server import app, _jobs, JobState, _run_inference
from fastapi.testclient import TestClient

client = TestClient(app)


def setup_function():
    _jobs.clear()


def test_submit_missing_all_modalities_returns_422():
    resp = client.post("/segment", json={"patient_id": "1"})
    assert resp.status_code == 422


def test_submit_valid_single_modality_returns_202():
    with patch("server.asyncio.create_task"):
        resp = client.post("/segment", json={
            "patient_id": "42",
            "flair_url": "http://example.com/flair.nii.gz",
        })
    assert resp.status_code == 202
    body = resp.json()
    assert "job_id" in body
    assert body["status"] == "queued"


def test_submit_creates_job_in_store():
    with patch("server.asyncio.create_task"):
        resp = client.post("/segment", json={
            "patient_id": "42",
            "t1_url": "http://example.com/t1.nii.gz",
        })
    job_id = resp.json()["job_id"]
    assert job_id in _jobs
    assert _jobs[job_id].status == "queued"


def test_get_status_unknown_job_returns_404():
    resp = client.get("/segment/nonexistent-job-id")
    assert resp.status_code == 404


def test_get_status_returns_queued_for_new_job():
    with patch("server.asyncio.create_task"):
        submit = client.post("/segment", json={
            "patient_id": "99",
            "t2_url": "http://example.com/t2.nii.gz",
        })
    job_id = submit.json()["job_id"]
    resp = client.get(f"/segment/{job_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["job_id"] == job_id
    assert body["status"] == "queued"
    assert body["result"] is None
    assert body["error"] is None


def test_run_inference_sets_complete_on_success():
    job_id = "test-complete-123"
    _jobs[job_id] = JobState()
    fake_params = object()

    with patch("server.segment_brats", return_value={"status": "success"}) as mock_seg:
        _run_inference(job_id, fake_params)
        mock_seg.assert_called_once_with(fake_params)

    assert _jobs[job_id].status == "complete"
    assert _jobs[job_id].result == {"status": "success"}
    assert _jobs[job_id].error is None


def test_run_inference_sets_error_on_exception():
    job_id = "test-error-456"
    _jobs[job_id] = JobState()
    fake_params = object()

    with patch("server.segment_brats", side_effect=RuntimeError("model failed")):
        _run_inference(job_id, fake_params)

    assert _jobs[job_id].status == "error"
    assert "model failed" in _jobs[job_id].error
    assert _jobs[job_id].result is None
