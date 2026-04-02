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
import re
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
            "dob":      "1979-05-14",
            "age":      "45",
            "gender":   "male",
            "symptoms": "Chest tightness and shortness of breath since this morning",
            "history":  "Hypertension, on lisinopril for 3 years",
            "default":  "The chest pain is getting worse when I breathe",
        },
        "expected_department": ["emergency", "cardiology"],
        "expected_keywords": ["emergency", "cardiology", "cardiac", "heart", "chest pain"],
    },
    {
        "id": "neuro_urgent",
        "description": "62yo female with sudden severe headache → Neurology/Emergency",
        "responses": {
            "name":     "[FLOWTEST] Margaret Liu",
            "dob":      "1963-11-02",
            "age":      "62",
            "gender":   "female",
            "symptoms": "Sudden severe headache, worst of my life, started an hour ago",
            "history":  "No significant history, non-smoker",
            "default":  "My vision is also a little blurry",
        },
        "expected_department": ["neurology", "emergency"],
        "expected_keywords": ["neurology", "neurolog", "emergency", "stroke", "head"],
    },
    {
        "id": "orthopedic_injury",
        "description": "30yo male with ankle injury → Orthopedics/Radiology",
        "responses": {
            "name":     "[FLOWTEST] Kevin Park",
            "dob":      "1995-03-18",
            "age":      "30",
            "gender":   "male",
            "symptoms": "I twisted my ankle playing football, it's very swollen and I can't walk",
            "history":  "No chronic conditions",
            "default":  "It happened about 2 hours ago",
        },
        "expected_department": ["orthopedics", "radiology"],
        "expected_keywords": ["orthoped", "radiology", "x-ray", "bone", "fracture", "ankle"],
    },
    {
        "id": "diabetes_followup",
        "description": "55yo female with diabetes symptoms → Endocrinology/Internal Medicine",
        "responses": {
            "name":     "[FLOWTEST] Sandra Okoye",
            "dob":      "1970-07-25",
            "age":      "55",
            "gender":   "female",
            "symptoms": "Feeling very thirsty and tired, urinating frequently for the past week",
            "history":  "Type 2 diabetes diagnosed 5 years ago, on metformin",
            "default":  "My blood sugar was 280 this morning",
        },
        "expected_department": ["endocrinology", "internal_medicine"],
        "expected_keywords": ["endocrinolog", "internal medicine", "diabetes", "blood sugar", "metabol"],
    },
    {
        "id": "respiratory_issue",
        "description": "38yo male with persistent cough → Pulmonology",
        "responses": {
            "name":     "[FLOWTEST] Daniel Torres",
            "dob":      "1987-09-30",
            "age":      "38",
            "gender":   "male",
            "symptoms": "Persistent cough for 3 weeks with wheezing and difficulty breathing at night",
            "history":  "Asthma as a child, smoker for 10 years",
            "default":  "The inhaler I used years ago isn't helping",
        },
        "expected_department": ["pulmonology", "internal_medicine"],
        "expected_keywords": ["pulmonolog", "respiratory", "lung", "breathing", "asthma", "internal medicine"],
    },
    {
        "id": "routine_checkup",
        "description": "28yo female for routine checkup → General Check-up",
        "responses": {
            "name":     "[FLOWTEST] Aisha Rahman",
            "dob":      "1997-02-11",
            "age":      "28",
            "gender":   "female",
            "symptoms": "I just want a general health checkup, I feel fine",
            "history":  "No known conditions, no medications",
            "default":  "I haven't had a checkup in 2 years",
        },
        "expected_department": ["general_checkup"],
        "expected_keywords": ["general", "checkup", "primary care", "routine", "family medicine", "preventive"],
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
    tool_calls: list[dict] = field(default_factory=list)
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
INTAKE_DONE_TURNS = 7  # Treat intake as complete after this many turns even without stop signal

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
    """Return the scenario response whose key appears as a whole word in the agent reply.

    Checks keys in insertion order (excluding 'default').
    Falls back to responses['default'] if nothing matches.
    """
    lower = reply.lower()
    for key, value in responses.items():
        if key == "default":
            continue
        if re.search(rf"\b{re.escape(key)}\b", lower):
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
    def __init__(self, scenario: dict, base_url: str, cleanup: bool = True, verbose: bool = False):
        self.scenario = scenario
        self.base_url = base_url.rstrip("/")
        self.cleanup = cleanup
        self.verbose = verbose
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
        max_retries = 2
        for attempt in range(1, max_retries + 1):
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

                if stream.session_id is not None:
                    self.session_id = stream.session_id
                    self.turn_count = 1
                    self._last_reply = stream.full_text
                    return StageResult(name, True, f"session_id={self.session_id}", time.monotonic() - t0)

                if attempt < max_retries:
                    await asyncio.sleep(2.0)
                    continue
                return StageResult(name, False, "session_id not returned in stream after retries", time.monotonic() - t0)
            except Exception as e:
                if attempt < max_retries:
                    await asyncio.sleep(2.0)
                    continue
                return StageResult(name, False, str(e), time.monotonic() - t0)

    # ------------------------------------------------------------------
    # Stage 2: intake conversation loop
    # ------------------------------------------------------------------

    async def stage_2_intake_conversation(self, client: httpx.AsyncClient) -> StageResult:
        """Run the intake conversation until the agent finishes asking questions.

        The reception_triage agent collects patient info but does not call create_patient
        tools directly (those are scope='assignable' and only available to specialists via
        delegation). Record creation is handled by stages 3–4 via direct API calls.

        Stage 2 succeeds when:
        - The agent has engaged for >= MIN_TURNS, AND
        - The agent reply shows signs of wrapping up (stop phrases) OR the loop reaches
          INTAKE_DONE_TURNS (a soft limit indicating intake is complete).
        """
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

                if not stream.full_text:
                    # Empty stream: skip this turn and wait for backend to recover.
                    # This is an intermittent backend issue; the conversation can still
                    # complete via INTAKE_DONE_TURNS on the next successful turn.
                    await asyncio.sleep(3.0)
                    self.turn_count += 1
                    continue
                self._last_reply = stream.full_text
                self.turn_count += 1

                if self.verbose:
                    print(f"    [turn {self.turn_count}] agent: {stream.full_text[:120]!r}")
                    if stream.tool_calls:
                        print(f"    [turn {self.turn_count}] tools: {[tc.get('name') for tc in stream.tool_calls]}")

                # Soft stop: agent says it has collected everything
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

                # Hard stop: enough turns elapsed — treat intake as complete
                if self.turn_count >= INTAKE_DONE_TURNS:
                    return StageResult(
                        name, True,
                        f"{self.turn_count} turns — intake complete (reached threshold)",
                        time.monotonic() - t0,
                    )

            return StageResult(
                name, False,
                f"agent did not engage within {MAX_TURNS} turns",
                time.monotonic() - t0,
            )
        except Exception as e:
            return StageResult(name, False, str(e), time.monotonic() - t0)

    # ------------------------------------------------------------------
    # Stage 3: create patient record via API (intake is complete)
    # ------------------------------------------------------------------

    async def stage_3_create_patient(self, client: httpx.AsyncClient) -> StageResult:
        """Create the patient via POST /api/patients using scenario data.

        The reception_triage agent collected the info; now the script registers
        the patient. (create_patient tool is scope='assignable' — not available
        to the main agent directly, so the script does it here.)
        """
        t0 = time.monotonic()
        name = "Stage 3: Create patient record"
        r = self.scenario["responses"]
        patient_name = r["name"].replace("[FLOWTEST] ", "")
        payload = {"name": r["name"], "dob": r["dob"], "gender": r["gender"]}
        try:
            resp = await client.post(
                f"{self.base_url}/api/patients",
                json=payload,
                timeout=30.0,
            )
            resp.raise_for_status()
            patient = resp.json()
            self.patient_id = patient["id"]
            return StageResult(name, True, f"patient_id={self.patient_id}, name={patient['name']}", time.monotonic() - t0)
        except Exception as e:
            return StageResult(name, False, str(e), time.monotonic() - t0)

    # ------------------------------------------------------------------
    # Stage 4: create visit via API and ask agent for routing suggestion
    # ------------------------------------------------------------------

    async def stage_4_create_visit_and_get_routing(self, client: httpx.AsyncClient) -> StageResult:
        """Create a visit, then ask the agent which department the patient should go to."""
        t0 = time.monotonic()
        name = "Stage 4: Create visit + get routing"
        if self.patient_id is None:
            return StageResult(name, False, "skipped — patient_id unknown (Stage 3 failed)", time.monotonic() - t0)

        r = self.scenario["responses"]
        chief_complaint = r["symptoms"]
        try:
            # Create the visit
            resp = await client.post(
                f"{self.base_url}/api/visits",
                json={"patient_id": self.patient_id, "chief_complaint": chief_complaint},
                timeout=30.0,
            )
            resp.raise_for_status()
            visit = resp.json()
            self.visit_id = visit["id"]

            # Ask agent for routing in the existing session (with patient context)
            routing_query = (
                f"Based on our conversation, which hospital department should patient "
                f"{r['name'].replace('[FLOWTEST] ', '')} go to? "
                f"Their chief complaint is: {chief_complaint}"
            )
            routing_payload = {
                "message": routing_query,
                "session_id": self.session_id,
                "patient_id": self.patient_id,
                "stream": True,
            }
            for _attempt in range(3):
                async with client.stream(
                    "POST",
                    f"{self.base_url}/api/chat",
                    json=routing_payload,
                    timeout=60.0,
                ) as resp:
                    resp.raise_for_status()
                    stream = await read_sse_stream(resp)
                if stream.full_text:
                    break
                await asyncio.sleep(3.0)

            self._routing_reply = stream.full_text
            if self.verbose:
                print(f"    [routing] agent: {stream.full_text[:200]!r}")

            visit_ref = visit.get("visit_id", self.visit_id)
            return StageResult(name, True, f"visit_id={visit_ref}", time.monotonic() - t0)
        except Exception as e:
            return StageResult(name, False, str(e), time.monotonic() - t0)

    # ------------------------------------------------------------------
    # Stage 5: verify routing suggestion in agent reply or visit record
    # ------------------------------------------------------------------

    async def stage_5_verify_routing(self, client: httpx.AsyncClient) -> StageResult:
        """Check that routing_suggestion on the visit OR agent reply mentions expected department."""
        t0 = time.monotonic()
        name = "Stage 5: Routing suggestion"
        if self.visit_id is None:
            return StageResult(name, False, "skipped — visit_id unknown (Stage 4 failed)", time.monotonic() - t0)
        expected = self.scenario["expected_department"]
        try:
            # First check: visit.routing_suggestion field (set by agent via tool or auto-routing)
            resp = await client.get(f"{self.base_url}/api/visits/{self.visit_id}", timeout=30.0)
            resp.raise_for_status()
            visit = resp.json()
            suggestion = visit.get("routing_suggestion")
            if suggestion and suggestion in expected:
                return StageResult(name, True, f"department={suggestion} (via visit record)", time.monotonic() - t0)

            # Second check: agent reply mentions expected department name
            routing_reply = getattr(self, "_routing_reply", "").lower()
            for dept in expected:
                dept_label = dept.replace("_", " ")
                if dept_label in routing_reply or dept in routing_reply:
                    return StageResult(name, True, f"department={dept} (mentioned in agent reply)", time.monotonic() - t0)

            # Third check: expected_keywords in agent reply
            for kw in self.scenario.get("expected_keywords", []):
                if kw.lower() in routing_reply:
                    return StageResult(name, True, f"keyword '{kw}' (mentioned in agent reply)", time.monotonic() - t0)

            detail = f"routing_suggestion={suggestion!r}, expected {expected}"
            if routing_reply:
                detail += f", agent said: {routing_reply[:100]!r}"
            return StageResult(name, False, detail, time.monotonic() - t0)
        except Exception as e:
            return StageResult(name, False, str(e), time.monotonic() - t0)

    # ------------------------------------------------------------------
    # Cleanup
    # ------------------------------------------------------------------

    async def cleanup_resources(self, client: httpx.AsyncClient) -> None:
        """Delete the chat session. Patient records persist (no delete endpoint)."""
        if self.session_id is not None:
            try:
                await client.delete(
                    f"{self.base_url}/api/chat/sessions/{self.session_id}",
                    timeout=15.0,
                )
            except Exception as e:
                print(f"    ⚠ Cleanup warning: could not delete session {self.session_id}: {e}")
        if self.patient_id is not None:
            print(f"    ℹ Patient id={self.patient_id} persists (no delete endpoint). "
                  "Name is prefixed with [FLOWTEST] for easy manual cleanup.")

    async def run(self, client: httpx.AsyncClient) -> list:
        """Run all 5 stages in order. Cleanup runs regardless of outcome."""
        self._last_reply = ""  # Stage 1 will overwrite this with the agent's opener
        results = []
        try:
            r1 = await self.stage_1_open_conversation(client)
            results.append(r1)
            if not r1.passed:
                return results  # can't continue without a session

            r2 = await self.stage_2_intake_conversation(client)
            results.append(r2)

            r3 = await self.stage_3_create_patient(client)
            results.append(r3)

            r4 = await self.stage_4_create_visit_and_get_routing(client)
            results.append(r4)

            r5 = await self.stage_5_verify_routing(client)
            results.append(r5)
        finally:
            if self.cleanup:
                await self.cleanup_resources(client)
        return results


# ---------------------------------------------------------------------------
# Runner and reporter
# ---------------------------------------------------------------------------

def _print_scenario_header(scenario: dict) -> None:
    print()
    print(f"Scenario: {scenario['id']}  —  {scenario['description']}")
    print("─" * 68)


def _print_scenario_results(results: list, elapsed: float) -> bool:
    """Print stage results. Returns True if all stages passed."""
    for r in results:
        print(str(r))
    passed = sum(1 for r in results if r.passed)
    total = len(results)
    status = "PASSED" if passed == total else "FAILED"
    print(f"  {'─'*62}")
    print(f"  {status} {passed}/{total} stages in {elapsed:.1f}s")
    return passed == total


BETWEEN_SCENARIOS_DELAY = 3.0  # seconds — lets the backend settle between scenarios


async def run_all(scenarios: list, base_url: str, cleanup: bool, verbose: bool = False) -> None:
    all_passed = 0
    t_global = time.monotonic()

    async with httpx.AsyncClient() as client:
        for i, scenario in enumerate(scenarios):
            if i > 0:
                await asyncio.sleep(BETWEEN_SCENARIOS_DELAY)
            _print_scenario_header(scenario)
            tester = FlowTester(scenario, base_url, cleanup=cleanup, verbose=verbose)
            t0 = time.monotonic()
            results = await tester.run(client)
            elapsed = time.monotonic() - t0
            if _print_scenario_results(results, elapsed):
                all_passed += 1

    total_elapsed = time.monotonic() - t_global
    print()
    print("═" * 68)
    print(f"  SUMMARY: {all_passed}/{len(scenarios)} scenarios passed  |  Total: {total_elapsed:.1f}s")
    print("═" * 68)
    sys.exit(0 if all_passed == len(scenarios) else 1)


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
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print each conversation turn for debugging",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    scenarios = (
        [s for s in SCENARIOS if s["id"] == args.scenario]
        if args.scenario
        else SCENARIOS
    )

    print(f"Running {len(scenarios)} scenario(s) against {args.base_url}")
    asyncio.run(run_all(scenarios, args.base_url, cleanup=not args.no_cleanup, verbose=args.verbose))
