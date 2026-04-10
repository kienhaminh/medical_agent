# eval/conftest.py
"""Shared fixtures for eval integration runs.

These fixtures are available to any future integration-style eval scripts
that need a live API client or auth credentials.

Unit tests under tests/eval/ use their own inline mocks and do not
import from here — keeping the unit test suite hermetic.
"""
import os
from pathlib import Path

import pytest

from eval.api_client import EvalApiClient

EVAL_BASE_URL = os.getenv("EVAL_BASE_URL", "http://localhost:8000")
EVAL_DOCTOR_TOKEN = os.getenv("EVAL_DOCTOR_TOKEN", "")
EVAL_PATIENT_TOKEN = os.getenv("EVAL_PATIENT_TOKEN", "")


@pytest.fixture
async def eval_client():
    """Async httpx client pointed at the running API server."""
    async with EvalApiClient(EVAL_BASE_URL) as client:
        yield client
