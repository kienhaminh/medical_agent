# Full Flow Test Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `scripts/test_full_flow.py` — a Python script that simulates a virtual patient in a multi-turn LLM conversation, verifying the agent automatically creates patient records, visits, and routing suggestions.

**Architecture:** Single `FlowTester` class carries state (`session_id`, `patient_id`, `visit_id`) across 5 stages. A conversation engine reads SSE streams from `POST /api/chat`, matches agent questions to scenario responses, and detects stop conditions. Six configurable patient scenarios test different department routing paths.

**Tech Stack:** Python 3.10+, `httpx` (async HTTP + SSE), `argparse` (CLI), `asyncio`. No new dependencies — `httpx` is already in `pyproject.toml`.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `scripts/test_full_flow.py` | Create | Main script — scenarios, FlowTester class, CLI |

> **Note:** There is no `DELETE /api/patients/{id}` endpoint. Test-created patients persist in the DB. Scenario names use a `[FLOWTEST]` prefix so they are easy to identify and delete manually. Session cleanup uses `DELETE /api/chat/sessions/{id}`.

---

## Task 1: Script skeleton, scenarios config, and CLI

**Files:**
- Create: `scripts/test_full_flow.py`

- [ ] **Step 1: Create the file with scenarios config and CLI boilerplate**

```python
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
```

- [ ] **Step 2: Verify the file is syntactically valid**

```bash
cd /Users/kien.ha/Code/medical_agent
python -c "import scripts.test_full_flow" 2>&1 || python scripts/test_full_flow.py --help
```

Expected: help text printed, no errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/test_full_flow.py
git commit -m "feat: add full-flow test script skeleton with scenarios and CLI"
```

---

## Task 2: SSE stream reader

**Files:**
- Modify: `scripts/test_full_flow.py`

The `POST /api/chat` endpoint streams lines in this format:
```
data: {"chunk": "hello"}\n\n          # text fragment — accumulate into full reply
data: {"tool_call": {"name": "..."}}\n\n  # tool invoked by agent
data: {"tool_result": {...}}\n\n       # tool result
data: {"session_id": 42}\n\n          # session assigned (first message only)
data: {"done": true}\n\n              # stream end
```

- [ ] **Step 1: Add `read_sse_stream()` function**

Add this function after the `StageResult` class:

```python
@dataclass
class StreamResult:
    """Parsed output from one SSE response."""
    full_text: str = ""           # accumulated chunk content
    session_id: Optional[int] = None
    tool_calls: list[dict] = field(default_factory=list)
    done: bool = False


async def read_sse_stream(response: httpx.Response, timeout_s: float = 60.0) -> StreamResult:
    """Parse a streaming SSE response from POST /api/chat.

    Reads lines of the form:
        data: <json_payload>

    Accumulates text from {"chunk": "..."} events.
    Captures session_id from {"session_id": ...} events.
    Records tool names from {"tool_call": {"name": "..."}} events.
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
```

- [ ] **Step 2: Verify syntax**

```bash
python -c "import scripts.test_full_flow; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add scripts/test_full_flow.py
git commit -m "feat: add SSE stream reader to full-flow test"
```

---

## Task 3: FlowTester class — conversation engine (Stages 1 & 2)

**Files:**
- Modify: `scripts/test_full_flow.py`

Session is created implicitly on the first `POST /api/chat` (no `session_id` field).
The `session_id` is returned in the SSE stream as `{"session_id": 42}`.

- [ ] **Step 1: Add `FlowTester` class with Stages 1 and 2**

Add after `read_sse_stream()`:

```python
MIN_TURNS = 3
MAX_TURNS = 15

# Phrases that indicate the agent has completed intake and recommends a visit
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


def _pick_response(reply: str, responses: dict[str, str]) -> str:
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


def _is_stop_condition(reply: str, tool_calls: list[dict]) -> bool:
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


class FlowTester:
    def __init__(self, scenario: dict, base_url: str, cleanup: bool = True):
        self.scenario = scenario
        self.base_url = base_url.rstrip("/")
        self.cleanup = cleanup
        # State carried across stages
        self.session_id: Optional[int] = None
        self.patient_id: Optional[int] = None
        self.visit_id: Optional[int] = None
        self.turn_count: int = 0

    # ------------------------------------------------------------------
    # Stage 1: start conversation (session created implicitly on first chat)
    # ------------------------------------------------------------------

    async def stage_1_open_conversation(self, client: httpx.AsyncClient) -> StageResult:
        t0 = time.monotonic()
        name = "Stage 1: Open conversation"
        try:
            # Send the opening message. Session will be created automatically
            # and its ID returned in the SSE stream.
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
                # Get previous agent reply to decide what to send next
                # On turn 1 we already sent the opener; fetch what agent said
                # by looking at the last stream result stored below
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
```

- [ ] **Step 2: Verify syntax**

```bash
python -c "import scripts.test_full_flow; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add scripts/test_full_flow.py
git commit -m "feat: add FlowTester conversation engine (stages 1-2)"
```

---

## Task 4: Verification stages (3, 4, 5) and cleanup

**Files:**
- Modify: `scripts/test_full_flow.py`

- [ ] **Step 1: Add Stages 3, 4, 5 and cleanup to `FlowTester`**

Add these methods to the `FlowTester` class (after `stage_2_intake_conversation`):

```python
    # ------------------------------------------------------------------
    # Stage 3: verify patient was created in DB
    # ------------------------------------------------------------------

    async def stage_3_verify_patient_created(self, client: httpx.AsyncClient) -> StageResult:
        t0 = time.monotonic()
        name = "Stage 3: Patient created"
        expected_name = self.scenario["responses"]["name"].lower()
        try:
            resp = await client.get(f"{self.base_url}/api/patients", timeout=30.0)
            resp.raise_for_status()
            patients = resp.json()
            match = next(
                (p for p in patients if expected_name in p["name"].lower()),
                None,
            )
            if match is None:
                return StageResult(name, False, f"no patient matching '{expected_name}' found", time.monotonic() - t0)
            self.patient_id = match["id"]
            return StageResult(name, True, f"patient_id={self.patient_id}, name={match['name']}", time.monotonic() - t0)
        except Exception as e:
            return StageResult(name, False, str(e), time.monotonic() - t0)

    # ------------------------------------------------------------------
    # Stage 4: verify visit was created for the patient
    # ------------------------------------------------------------------

    async def stage_4_verify_visit_created(self, client: httpx.AsyncClient) -> StageResult:
        t0 = time.monotonic()
        name = "Stage 4: Visit created"
        if self.patient_id is None:
            return StageResult(name, False, "skipped — patient_id unknown (Stage 3 failed)", time.monotonic() - t0)
        try:
            resp = await client.get(
                f"{self.base_url}/api/visits",
                params={"patient_id": self.patient_id},
                timeout=30.0,
            )
            resp.raise_for_status()
            visits = resp.json()
            if not visits:
                return StageResult(name, False, f"no visit found for patient_id={self.patient_id}", time.monotonic() - t0)
            # Most recent visit
            self.visit_id = visits[0]["id"]
            visit_ref = visits[0].get("visit_id", self.visit_id)
            return StageResult(name, True, f"visit_id={visit_ref}", time.monotonic() - t0)
        except Exception as e:
            return StageResult(name, False, str(e), time.monotonic() - t0)

    # ------------------------------------------------------------------
    # Stage 5: verify routing suggestion
    # ------------------------------------------------------------------

    async def stage_5_verify_routing(self, client: httpx.AsyncClient) -> StageResult:
        t0 = time.monotonic()
        name = "Stage 5: Routing suggestion"
        if self.visit_id is None:
            return StageResult(name, False, "skipped — visit_id unknown (Stage 4 failed)", time.monotonic() - t0)
        expected = self.scenario["expected_department"]
        try:
            resp = await client.get(f"{self.base_url}/api/visits/{self.visit_id}", timeout=30.0)
            resp.raise_for_status()
            visit = resp.json()
            suggestion = visit.get("routing_suggestion")
            if suggestion is None:
                return StageResult(name, False, "routing_suggestion is null", time.monotonic() - t0)
            if suggestion not in expected:
                return StageResult(
                    name, False,
                    f"got '{suggestion}', expected one of {expected}",
                    time.monotonic() - t0,
                )
            return StageResult(name, True, f"department={suggestion}", time.monotonic() - t0)
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
```

- [ ] **Step 2: Verify syntax**

```bash
python -c "import scripts.test_full_flow; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add scripts/test_full_flow.py
git commit -m "feat: add verification stages and cleanup to FlowTester"
```

---

## Task 5: `run()` method, summary reporter, and main entry point

**Files:**
- Modify: `scripts/test_full_flow.py`

- [ ] **Step 1: Add `run()` and `run_all()` functions, wire up `__main__`**

Add `run()` method to `FlowTester` class:

```python
    async def run(self, client: httpx.AsyncClient) -> list[StageResult]:
        """Run all 5 stages in order. Cleanup runs regardless of outcome."""
        self._last_reply = ""  # Stage 1 will overwrite this with the agent's opener
        results: list[StageResult] = []
        try:
            r1 = await self.stage_1_open_conversation(client)
            results.append(r1)
            if not r1.passed:
                return results  # can't continue without a session

            r2 = await self.stage_2_intake_conversation(client)
            results.append(r2)

            r3 = await self.stage_3_verify_patient_created(client)
            results.append(r3)

            r4 = await self.stage_4_verify_visit_created(client)
            results.append(r4)

            r5 = await self.stage_5_verify_routing(client)
            results.append(r5)
        finally:
            if self.cleanup:
                await self.cleanup_resources(client)
        return results
```

Add these top-level functions after the class:

```python
def _print_scenario_header(scenario: dict) -> None:
    print()
    print(f"Scenario: {scenario['id']}  —  {scenario['description']}")
    print("─" * 68)


def _print_scenario_results(results: list[StageResult], elapsed: float) -> bool:
    """Print stage results. Returns True if all stages passed."""
    for r in results:
        print(str(r))
    passed = sum(1 for r in results if r.passed)
    total = len(results)
    status = "PASSED" if passed == total else "FAILED"
    print(f"  {'─'*62}")
    print(f"  {status} {passed}/{total} stages in {elapsed:.1f}s")
    return passed == total


async def run_all(scenarios: list[dict], base_url: str, cleanup: bool) -> None:
    all_passed = 0
    t_global = time.monotonic()

    async with httpx.AsyncClient() as client:
        for scenario in scenarios:
            _print_scenario_header(scenario)
            tester = FlowTester(scenario, base_url, cleanup=cleanup)
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
```

Replace the placeholder `__main__` block at the bottom of the file:

```python
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
    asyncio.run(run_all(scenarios, args.base_url, cleanup=not args.no_cleanup))
```

- [ ] **Step 2: Verify syntax**

```bash
python scripts/test_full_flow.py --help
```

Expected: help text with `--scenario`, `--base-url`, `--no-cleanup` options.

- [ ] **Step 3: Commit**

```bash
git add scripts/test_full_flow.py
git commit -m "feat: wire up run() method and summary reporter in full-flow test"
```

---

## Task 6: Smoke test against live backend

**Prerequisite:** Backend running (`python -m src.api.server`), Docker Compose up.

- [ ] **Step 1: Run a single fast scenario to verify the script works end-to-end**

```bash
cd /Users/kien.ha/Code/medical_agent
source .venv/bin/activate
python scripts/test_full_flow.py --scenario routine_checkup --no-cleanup
```

Expected output structure:
```
Scenario: routine_checkup  —  28yo female for routine checkup → General Check-up
────────────────────────────────────────────────────────────
  ✅ [Stage 1: Open conversation]      PASS  session_id=...
  ✅ [Stage 2: Intake conversation]    PASS  N turns — agent concluded
  ✅ [Stage 3: Patient created]        PASS  patient_id=...
  ✅ [Stage 4: Visit created]          PASS  visit_id=...
  ✅ [Stage 5: Routing suggestion]     PASS  department=general_checkup
```

- [ ] **Step 2: Debug any failures**

Common issues and fixes:
- **Stage 1 fails** (`session_id not returned`) — check `POST /api/chat` returns `{"session_id": N}` in stream; may need to wait for first stream event before sending next message
- **Stage 2 never stops** — add `print(f"[turn {self.turn_count}] agent: {stream.full_text[:80]}")` inside the loop to see what the agent is saying; adjust stop signals or scenario responses
- **Stage 3 fails** (`no patient matching`) — agent may not have called `create_patient` tool; check the `tool_calls` list in `stream.tool_calls` by printing it
- **Stage 5 fails** (`routing_suggestion is null`) — visit exists but routing not yet set; the agent may need an explicit prompt like "Which department should I go to?"

- [ ] **Step 3: Run all 6 scenarios once backend is stable**

```bash
python scripts/test_full_flow.py
```

- [ ] **Step 4: Final commit**

```bash
git add scripts/test_full_flow.py
git commit -m "feat: complete full-flow test script with 6 patient scenarios"
```
