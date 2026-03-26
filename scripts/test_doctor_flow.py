#!/usr/bin/env python3
"""
Doctor flow test script for the medical agent.

Simulates a doctor consulting the Internist agent about a patient.
Verifies the agent queries patient data via tools and that clinical notes are saved.

Usage:
    python scripts/test_doctor_flow.py                        # run all scenarios
    python scripts/test_doctor_flow.py --scenario cardiac_review
    python scripts/test_doctor_flow.py --base-url http://localhost:9000
    python scripts/test_doctor_flow.py --no-cleanup
    python scripts/test_doctor_flow.py --verbose
"""

import argparse
import asyncio
import json
import sys
import time
from dataclasses import dataclass, field
from typing import Optional

import httpx

BASE_URL = "http://localhost:8000"
DOCTOR_AGENT_ROLE = "clinical_text"
BETWEEN_SCENARIOS_DELAY = 3.0  # seconds — lets the backend settle between scenarios


@dataclass
class StageResult:
    name: str
    passed: bool
    detail: str
    duration_s: float = 0.0

    def __str__(self) -> str:
        icon = "✅" if self.passed else "❌"
        label = f"[{self.name}]".ljust(35)
        status = "PASS" if self.passed else "FAIL"
        return f"  {icon} {label} {status}  {self.detail}  ({self.duration_s:.1f}s)"


@dataclass
class StreamResult:
    """Parsed output from one SSE response."""
    full_text: str = ""
    session_id: Optional[int] = None
    tool_calls: list[dict] = field(default_factory=list)
    done: bool = False


async def read_sse_stream(response: httpx.Response, timeout_s: float = 60.0) -> StreamResult:
    """Parse a streaming SSE response from POST /api/chat.

    Reads lines of the form:
        data: <json_payload>

    Accumulates text from {"chunk": "..."} events.
    Captures session_id from {"session_id": ...} events (arrives at end of stream).
    Records tool calls from {"tool_call": {...}} events.
    Stops on {"done": true} or connection close.
    """
    result = StreamResult()
    deadline = time.monotonic() + timeout_s

    async for line in response.aiter_lines():
        if time.monotonic() > deadline:
            break
        if not line.startswith("data: "):
            continue
        raw = line[len("data: "):]
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            continue

        if "chunk" in payload:
            result.full_text += payload["chunk"]
        elif "session_id" in payload:
            result.session_id = payload["session_id"]
        elif "tool_call" in payload:
            result.tool_calls.append(payload["tool_call"])
        elif payload.get("done"):
            result.done = True
            # ⚠️ Do NOT add `break` here. This intentionally diverges from test_full_flow.py.
            # The backend sends session_id AFTER the done event, so we must keep reading.

    return result
