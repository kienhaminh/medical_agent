#!/usr/bin/env python3
"""
Full flow test script for the medical agent.

Simulates a virtual patient in a multi-turn LLM conversation and verifies the
agent automatically creates patient records, visits, and routing suggestions.

Usage:
    python scripts/test_full_flow.py                          # run all scenarios
    python scripts/test_full_flow.py --scenario cardiac_emergency
    python scripts/test_full_flow.py --base-url http://localhost:9000
    python scripts/test_full_flow.py --no-cleanup
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

# ---------------------------------------------------------------------------
# Scenarios
# ---------------------------------------------------------------------------

SCENARIOS = [
    {
        "id": "cardiac_emergency",
        "description": "45yo male with chest pain → Cardiology/Emergency",
        "responses": {
            "name":     "[FLOWTEST] James Carter",
            "born":     "1979-05-14",
            "dob":      "1979-05-14",
            "age":      "45",
            "gender":   "male",
            "symptoms": "Chest tightness and shortness of breath since this morning",
            "history":  "Hypertension, on lisinopril for 3 years",
            "default":  "The chest pain is getting worse when I breathe",
        },
        "expected_department": ["emergency", "cardiology"],
    },
    {
        "id": "neuro_urgent",
        "description": "62yo female with sudden severe headache → Neurology/Emergency",
        "responses": {
            "name":     "[FLOWTEST] Margaret Liu",
            "born":     "1963-11-02",
            "dob":      "1963-11-02",
            "age":      "62",
            "gender":   "female",
            "symptoms": "Sudden severe headache, worst of my life, started an hour ago",
            "history":  "No significant history, non-smoker",
            "default":  "My vision is also a little blurry",
        },
        "expected_department": ["neurology", "emergency"],
    },
    {
        "id": "orthopedic_injury",
        "description": "30yo male with ankle injury → Orthopedics/Radiology",
        "responses": {
            "name":     "[FLOWTEST] Kevin Park",
            "born":     "1995-03-18",
            "dob":      "1995-03-18",
            "age":      "30",
            "gender":   "male",
            "symptoms": "I twisted my ankle playing football, it's very swollen and I can't walk",
            "history":  "No chronic conditions",
            "default":  "It happened about 2 hours ago",
        },
        "expected_department": ["orthopedics", "radiology"],
    },
    {
        "id": "diabetes_followup",
        "description": "55yo female with diabetes symptoms → Endocrinology/Internal Medicine",
        "responses": {
            "name":     "[FLOWTEST] Sandra Okoye",
            "born":     "1970-07-25",
            "dob":      "1970-07-25",
            "age":      "55",
            "gender":   "female",
            "symptoms": "Feeling very thirsty and tired, urinating frequently for the past week",
            "history":  "Type 2 diabetes diagnosed 5 years ago, on metformin",
            "default":  "My blood sugar was 280 this morning",
        },
        "expected_department": ["endocrinology", "internal_medicine"],
    },
    {
        "id": "respiratory_issue",
        "description": "38yo male with persistent cough → Pulmonology",
        "responses": {
            "name":     "[FLOWTEST] Daniel Torres",
            "born":     "1987-09-30",
            "dob":      "1987-09-30",
            "age":      "38",
            "gender":   "male",
            "symptoms": "Persistent cough for 3 weeks with wheezing and difficulty breathing at night",
            "history":  "Asthma as a child, smoker for 10 years",
            "default":  "The inhaler I used years ago isn't helping",
        },
        "expected_department": ["pulmonology", "internal_medicine"],
    },
    {
        "id": "routine_checkup",
        "description": "28yo female for routine checkup → General Check-up",
        "responses": {
            "name":     "[FLOWTEST] Aisha Rahman",
            "born":     "1997-02-11",
            "dob":      "1997-02-11",
            "age":      "28",
            "gender":   "female",
            "symptoms": "I just want a general health checkup, I feel fine",
            "history":  "No known conditions, no medications",
            "default":  "I haven't had a checkup in 2 years",
        },
        "expected_department": ["general_checkup"],
    },
]


# ---------------------------------------------------------------------------
# Stage result
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# SSE stream reader
# ---------------------------------------------------------------------------

@dataclass
class StreamResult:
    """Parsed output from one SSE response."""
    full_text: str = ""
    session_id: Optional[int] = None
    tool_calls: list = field(default_factory=list)
    done: bool = False


async def read_sse_stream(response: httpx.Response, timeout_s: float = 60.0) -> StreamResult:
    """Parse a streaming SSE response from POST /api/chat.

    Reads lines of the form:
        data: <json_payload>

    Accumulates text from {"chunk": "..."} events.
    Captures session_id from {"session_id": ...} events.
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
            break

    return result


# ---------------------------------------------------------------------------
# Conversation helpers
# ---------------------------------------------------------------------------

MIN_TURNS = 3
MAX_TURNS = 15

# Phrase pairs that signal the agent has completed intake
STOP_SIGNALS = [
    ("visit", "created"),
    ("visit", "registered"),
    ("visit", "scheduled"),
    ("record", "saved"),
    ("record", "added"),
    ("record", "created"),
]
STOP_PHRASES = ["please come", "visit the hospital", "go to the"]
STOP_TOOL_KEYWORDS = ["create_patient", "create_visit"]


def _pick_response(reply: str, responses: dict) -> str:
    """Return the scenario response whose key appears in the agent reply.

    Checks keys in insertion order (excluding 'default').
    Falls back to responses['default'] if nothing matches.
    """
    lower = reply.lower()
    for key, value in responses.items():
        if key == "default":
            continue
        if key in lower:
            return value
    return responses.get("default", "I'm not sure.")


def _is_stop_condition(reply: str, tool_calls: list) -> bool:
    """Return True if the agent reply signals end of intake."""
    lower = reply.lower()
    for word_a, word_b in STOP_SIGNALS:
        if word_a in lower and word_b in lower:
            return True
    for phrase in STOP_PHRASES:
        if phrase in lower:
            return True
    for tc in tool_calls:
        name = tc.get("name", "").lower()
        if any(kw in name for kw in STOP_TOOL_KEYWORDS):
            return True
    return False


# ---------------------------------------------------------------------------
# FlowTester
# ---------------------------------------------------------------------------

class FlowTester:
    def __init__(self, scenario: dict, base_url: str, cleanup: bool = True):
        self.scenario = scenario
        self.base_url = base_url.rstrip("/")
        self.cleanup = cleanup
        self.session_id: Optional[int] = None
        self.patient_id: Optional[int] = None
        self.visit_id: Optional[int] = None
        self.turn_count: int = 0
        self._last_reply: str = ""

    # ------------------------------------------------------------------
    # Stage 1: open conversation (session created implicitly on first chat)
    # ------------------------------------------------------------------

    async def stage_1_open_conversation(self, client: httpx.AsyncClient) -> StageResult:
        t0 = time.monotonic()
        name = "Stage 1: Open conversation"
        try:
            opening = "Hello, I need medical help."
            async with client.stream(
                "POST",
                f"{self.base_url}/api/chat",
                json={"message": opening, "stream": True},
                timeout=60.0,
            ) as resp:
                resp.raise_for_status()
                stream = await read_sse_stream(resp)

            if stream.session_id is None:
                return StageResult(name, False, "session_id not returned in stream", time.monotonic() - t0)

            self.session_id = stream.session_id
            self.turn_count = 1
            # Store agent's opening reply so Stage 2 can keyword-match it on turn 1
            self._last_reply = stream.full_text
            return StageResult(name, True, f"session_id={self.session_id}", time.monotonic() - t0)
        except Exception as e:
            return StageResult(name, False, str(e), time.monotonic() - t0)

    # ------------------------------------------------------------------
    # Stage 2: intake conversation loop
    # ------------------------------------------------------------------

    async def stage_2_intake_conversation(self, client: httpx.AsyncClient) -> StageResult:
        t0 = time.monotonic()
        name = "Stage 2: Intake conversation"
        responses = self.scenario["responses"]

        try:
            while self.turn_count < MAX_TURNS:
                message = _pick_response(self._last_reply, responses)

                async with client.stream(
                    "POST",
                    f"{self.base_url}/api/chat",
                    json={
                        "message": message,
                        "session_id": self.session_id,
                        "stream": True,
                    },
                    timeout=60.0,
                ) as resp:
                    resp.raise_for_status()
                    stream = await read_sse_stream(resp)

                self._last_reply = stream.full_text
                self.turn_count += 1

                if _is_stop_condition(stream.full_text, stream.tool_calls):
                    if self.turn_count < MIN_TURNS:
                        return StageResult(
                            name, False,
                            f"agent concluded too quickly ({self.turn_count} turns < min {MIN_TURNS})",
                            time.monotonic() - t0,
                        )
                    return StageResult(
                        name, True,
                        f"{self.turn_count} turns — agent concluded",
                        time.monotonic() - t0,
                    )

            return StageResult(
                name, False,
                f"agent did not conclude within {MAX_TURNS} turns",
                time.monotonic() - t0,
            )
        except Exception as e:
            return StageResult(name, False, str(e), time.monotonic() - t0)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Full flow test for medical agent")
    parser.add_argument(
        "--scenario",
        help="Run a single scenario by ID (default: all)",
        choices=[s["id"] for s in SCENARIOS],
    )
    parser.add_argument(
        "--base-url",
        default=BASE_URL,
        help=f"Backend base URL (default: {BASE_URL})",
    )
    parser.add_argument(
        "--no-cleanup",
        action="store_true",
        help="Do not delete the chat session after the test",
    )
    return parser.parse_args()


# ---------------------------------------------------------------------------
# Entry point (placeholder — wired up in Task 5)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    args = parse_args()
    scenarios = (
        [s for s in SCENARIOS if s["id"] == args.scenario]
        if args.scenario
        else SCENARIOS
    )
    if not scenarios:
        print(f"Unknown scenario: {args.scenario}")
        sys.exit(1)
    print(f"Running {len(scenarios)} scenario(s) against {args.base_url}")
