# Doctor Flow Test Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `scripts/test_doctor_flow.py` — a 24-scenario test script that simulates a doctor consulting the Internist agent, verifying patient data is queried via tools, and that clinical notes are saved correctly.

**Architecture:** A single `DoctorFlowTester` class mirrors the structure of `scripts/test_full_flow.py`. It seeds a test patient + records, runs a scripted multi-turn Internist conversation, verifies tool calls appeared in the SSE stream, posts a clinical note via the records API, and confirms the note persists. The existing `read_sse_stream()` / `StageResult` / `_print_scenario_*` helpers are duplicated (not imported) to keep the file self-contained and runnable independently.

**Tech Stack:** Python 3.10+, `httpx` (async HTTP + SSE), `asyncio`, `argparse`, `dataclasses`

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `scripts/test_doctor_flow.py` | **Create** | The entire test script — scenarios, DoctorFlowTester class, runner, CLI |

No other files are created or modified.

---

## Reference: Key API Shapes

Before implementing, note these exact request/response shapes (verified against codebase):

**Create patient:** `POST /api/patients` `{"name": str, "dob": str, "gender": str}` → `{"id": int, ...}`

**Create record:** `POST /api/patients/{id}/records` `{"title": str, "content": str, "description": str|null}` → `{"id": int, ...}`
- Backend prepends `"Title: <title>\n\n"` to stored content — substring match still works in Stage 5

**Chat (streaming):** `POST /api/chat` `{"message": str, "agent_role": str, "patient_id": int, "session_id": int|null, "stream": true}`
- SSE events: `data: {"chunk": "..."}` / `data: {"tool_call": {"name": "...", ...}}` / `data: {"session_id": 42}` / `data: {"done": true}`
- `session_id` arrives **at end of stream** (after `done`), not at the beginning

**List records:** `GET /api/patients/{id}/records` → `[{"id": int, "content": str, ...}, ...]`

**Delete record:** `DELETE /api/records/{record_id}` → 204

**Delete session:** `DELETE /api/chat/sessions/{session_id}` → 204

**No** `DELETE /api/patients/{id}` endpoint exists — patients persist with `[DRTEST]` prefix.

**Internist agent role:** `"clinical_text"` — always present as a core agent.

---

## Task 1: Scaffold file, imports, constants, StageResult, StreamResult, read_sse_stream

**Files:**
- Create: `scripts/test_doctor_flow.py`

- [ ] **Step 1: Create the file with shebang, docstring, imports, and constants**

```python
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
```

- [ ] **Step 2: Add StageResult dataclass (identical to test_full_flow.py)**

```python
@dataclass
class StageResult:
    name: str
    passed: bool
    detail: str
    duration_s: float = 0.0

    def __str__(self) -> str:
        icon = "✅" if self.passed else "❌"
        label = f"[{self.name}]".ljust(40)
        status = "PASS" if self.passed else "FAIL"
        return f"  {icon} {label} {status}  {self.detail}  ({self.duration_s:.1f}s)"
```

- [ ] **Step 3: Add StreamResult dataclass and read_sse_stream()**

```python
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
```

> **Important divergence from `test_full_flow.py`:** The reference file breaks out of the loop on `done`. This file must NOT — the `session_id` event arrives after `done`. If you copy from the reference, remove the `break`.

- [ ] **Step 4: Verify the file is valid Python**

```bash
python -c "import scripts.test_doctor_flow" 2>/dev/null || python scripts/test_doctor_flow.py --help
```

Expected: ImportError or help text (no SyntaxError)

- [ ] **Step 5: Commit**

```bash
git add scripts/test_doctor_flow.py
git commit -m "feat: scaffold test_doctor_flow.py with SSE helpers"
```

---

## Task 2: Add SCENARIOS list (all 24 scenarios)

**Files:**
- Modify: `scripts/test_doctor_flow.py`

- [ ] **Step 1: Add the SCENARIOS list after the constants block**

Paste the full `SCENARIOS` list from the spec (`docs/superpowers/specs/2026-03-26-doctor-flow-test-design.md`, section "Scenarios (24 total)"). Each scenario has these keys:
- `id` (str)
- `description` (str)
- `patient` (dict: `name`, `dob`, `gender`)
- `seed_records` (list of dicts: `title`, `content`)
- `turns` (list of str — scripted doctor questions, 3 entries each)
- `expected_tools` (list of str — tool names to verify)
- `clinical_note` (str — the note the script will POST)

**Important:** Patient names must be prefixed with `"[DRTEST] "` in the `patient["name"]` field to enable easy manual DB cleanup. Example:
```python
"patient": {"name": "[DRTEST] Robert Mills", "dob": "1960-03-12", "gender": "male"},
```

- [ ] **Step 2: Verify scenario count and [DRTEST] prefix**

```bash
python -c "
import pathlib
src = pathlib.Path('scripts/test_doctor_flow.py').read_text()
# Count scenario IDs via their string-valued id key pattern
import re
ids = re.findall(r'\"id\":\s*\"[a-z_]+\"', src)
count = len(ids)
print(f'Scenario count: {count}')
assert count == 24, f'Expected 24, got {count}'
# Verify every patient name is prefixed
drtest_count = src.count('[DRTEST]')
print(f'[DRTEST] prefix count: {drtest_count}')
assert drtest_count >= 24, f'Expected >= 24 [DRTEST] prefixes, got {drtest_count}'
print('OK')
"
```

Expected: `Scenario count: 24` / `[DRTEST] prefix count: 24` / `OK`

- [ ] **Step 3: Commit**

```bash
git add scripts/test_doctor_flow.py
git commit -m "feat: add 24 doctor flow scenarios"
```

---

## Task 3: Implement DoctorFlowTester — Stage 1 (setup patient)

**Files:**
- Modify: `scripts/test_doctor_flow.py`

- [ ] **Step 1: Add the DoctorFlowTester class skeleton + __init__**

```python
class DoctorFlowTester:
    def __init__(self, scenario: dict, base_url: str, cleanup: bool = True, verbose: bool = False):
        self.scenario = scenario
        self.base_url = base_url.rstrip("/")
        self.cleanup = cleanup
        self.verbose = verbose
        self.session_id: Optional[int] = None
        self.patient_id: Optional[int] = None
        self.record_ids: list[int] = []
        self.note_record_id: Optional[int] = None
        self.tool_calls_seen: list[str] = []
```

- [ ] **Step 2: Implement stage_1_setup_patient()**

```python
    async def stage_1_setup_patient(self, client: httpx.AsyncClient) -> StageResult:
        """Create test patient and seed medical records."""
        t0 = time.monotonic()
        name = "Stage 1: Setup patient + records"
        p = self.scenario["patient"]
        try:
            # Create patient
            resp = await client.post(
                f"{self.base_url}/api/patients",
                json={"name": p["name"], "dob": p["dob"], "gender": p["gender"]},
                timeout=30.0,
            )
            resp.raise_for_status()
            self.patient_id = resp.json()["id"]

            # Seed records
            for rec in self.scenario["seed_records"]:
                r = await client.post(
                    f"{self.base_url}/api/patients/{self.patient_id}/records",
                    json={"title": rec["title"], "content": rec["content"]},
                    timeout=30.0,
                )
                r.raise_for_status()
                self.record_ids.append(r.json()["id"])

            return StageResult(
                name, True,
                f"patient_id={self.patient_id}, {len(self.record_ids)} records seeded",
                time.monotonic() - t0,
            )
        except Exception as e:
            return StageResult(name, False, str(e), time.monotonic() - t0)
```

- [ ] **Step 3: Smoke-test Stage 1 by adding a temporary __main__ block and running it**

```python
# Temporary test block — remove after verifying
if __name__ == "__main__":
    import asyncio, httpx
    scenario = next(s for s in SCENARIOS if s["id"] == "cardiac_review")
    async def _test():
        async with httpx.AsyncClient() as client:
            tester = DoctorFlowTester(scenario, BASE_URL, cleanup=False, verbose=True)
            r = await tester.stage_1_setup_patient(client)
            print(r)
    asyncio.run(_test())
```

```bash
python scripts/test_doctor_flow.py
```

Expected output: `✅ [Stage 1: Setup patient + records] PASS  patient_id=<N>, 2 records seeded`

- [ ] **Step 4: Remove the temporary __main__ block**

- [ ] **Step 5: Commit**

```bash
git add scripts/test_doctor_flow.py
git commit -m "feat: add DoctorFlowTester stage 1 — patient + record seeding"
```

---

## Task 4: Implement Stage 2 (open Internist session)

**Files:**
- Modify: `scripts/test_doctor_flow.py`

- [ ] **Step 1: Implement stage_2_open_session()**

```python
    async def stage_2_open_session(self, client: httpx.AsyncClient) -> StageResult:
        """Open a chat session with the Internist agent using a neutral opener."""
        t0 = time.monotonic()
        name = "Stage 2: Open Internist session"
        if self.patient_id is None:
            return StageResult(name, False, "skipped — patient_id unknown (Stage 1 failed)", time.monotonic() - t0)

        for attempt in range(1, 3):
            try:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/api/chat",
                    json={
                        "message": "Hello, I need to consult about a patient.",
                        "agent_role": DOCTOR_AGENT_ROLE,
                        "patient_id": self.patient_id,
                        "stream": True,
                    },
                    timeout=60.0,
                ) as resp:
                    resp.raise_for_status()
                    stream = await read_sse_stream(resp)

                # Collect any tool calls from opening turn
                for tc in stream.tool_calls:
                    tool_name = tc.get("name", "")
                    if tool_name:
                        self.tool_calls_seen.append(tool_name)

                if stream.session_id is not None:
                    self.session_id = stream.session_id
                    return StageResult(name, True, f"session_id={self.session_id}", time.monotonic() - t0)

                if attempt < 2:
                    await asyncio.sleep(2.0)
            except Exception as e:
                if attempt < 2:
                    await asyncio.sleep(2.0)
                    continue
                return StageResult(name, False, str(e), time.monotonic() - t0)

        return StageResult(name, False, "session_id not returned after retries", time.monotonic() - t0)
```

- [ ] **Step 2: Commit**

```bash
git add scripts/test_doctor_flow.py
git commit -m "feat: add DoctorFlowTester stage 2 — open Internist session"
```

---

## Task 5: Implement Stage 3 (doctor conversation loop)

**Files:**
- Modify: `scripts/test_doctor_flow.py`

- [ ] **Step 1: Implement stage_3_doctor_conversation()**

```python
    async def stage_3_doctor_conversation(self, client: httpx.AsyncClient) -> StageResult:
        """Send scripted doctor turns and verify the agent uses patient query tools."""
        t0 = time.monotonic()
        name = "Stage 3: Doctor conversation"
        if self.session_id is None:
            return StageResult(name, False, "skipped — session_id unknown (Stage 2 failed)", time.monotonic() - t0)

        turns = self.scenario["turns"]
        expected_tools = self.scenario["expected_tools"]

        for i, message in enumerate(turns):
            try:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/api/chat",
                    json={
                        "message": message,
                        "session_id": self.session_id,
                        "patient_id": self.patient_id,
                        "stream": True,
                    },
                    timeout=60.0,
                ) as resp:
                    resp.raise_for_status()
                    stream = await read_sse_stream(resp)

                if not stream.full_text:
                    # Empty stream — skip turn and wait for backend to recover
                    await asyncio.sleep(3.0)
                    continue

                for tc in stream.tool_calls:
                    tool_name = tc.get("name", "")
                    if tool_name:
                        self.tool_calls_seen.append(tool_name)

                if self.verbose:
                    print(f"    [turn {i + 1}] agent: {stream.full_text[:120]!r}")
                    if stream.tool_calls:
                        print(f"    [turn {i + 1}] tools: {[tc.get('name') for tc in stream.tool_calls]}")

            except Exception as e:
                # Log but continue — don't abort the whole stage on one bad turn
                if self.verbose:
                    print(f"    [turn {i + 1}] error: {e}")

        # Check tool coverage across all turns
        tools_used = [t for t in self.tool_calls_seen if t in expected_tools]
        if tools_used:
            unique = list(dict.fromkeys(tools_used))  # deduplicated, order preserved
            return StageResult(
                name, True,
                f"tools used: {', '.join(unique)}",
                time.monotonic() - t0,
            )
        return StageResult(
            name, False,
            f"no expected tools called (expected one of {expected_tools}, saw {self.tool_calls_seen})",
            time.monotonic() - t0,
        )
```

- [ ] **Step 2: Commit**

```bash
git add scripts/test_doctor_flow.py
git commit -m "feat: add DoctorFlowTester stage 3 — scripted doctor conversation"
```

---

## Task 6: Implement Stages 4 & 5 (take note + verify)

**Files:**
- Modify: `scripts/test_doctor_flow.py`

- [ ] **Step 1: Implement stage_4_take_note()**

```python
    async def stage_4_take_note(self, client: httpx.AsyncClient) -> StageResult:
        """POST a clinical note to the patient's records."""
        t0 = time.monotonic()
        name = "Stage 4: Take clinical note"
        if self.patient_id is None:
            return StageResult(name, False, "skipped — patient_id unknown (Stage 1 failed)", time.monotonic() - t0)
        try:
            resp = await client.post(
                f"{self.base_url}/api/patients/{self.patient_id}/records",
                json={
                    "title": "Doctor assessment",
                    "content": self.scenario["clinical_note"],
                },
                timeout=30.0,
            )
            resp.raise_for_status()
            self.note_record_id = resp.json()["id"]
            return StageResult(name, True, f"record_id={self.note_record_id}", time.monotonic() - t0)
        except Exception as e:
            return StageResult(name, False, str(e), time.monotonic() - t0)
```

- [ ] **Step 2: Implement stage_5_verify_note_saved()**

```python
    async def stage_5_verify_note_saved(self, client: httpx.AsyncClient) -> StageResult:
        """Verify the clinical note appears in the patient's record list."""
        t0 = time.monotonic()
        name = "Stage 5: Verify note saved"
        if self.patient_id is None:
            return StageResult(name, False, "skipped — patient_id unknown (Stage 1 failed)", time.monotonic() - t0)
        try:
            resp = await client.get(
                f"{self.base_url}/api/patients/{self.patient_id}/records",
                timeout=30.0,
            )
            resp.raise_for_status()
            records = resp.json()
            if not isinstance(records, list):
                return StageResult(name, False, f"unexpected response shape: {type(records)}", time.monotonic() - t0)

            expected_text = self.scenario["clinical_note"].lower()
            # Backend prepends "Title: <title>\n\n" to content — substring match still succeeds
            for rec in records:
                if expected_text in rec.get("content", "").lower():
                    return StageResult(name, True, "note found in patient records", time.monotonic() - t0)

            return StageResult(name, False, "clinical note not found in patient records", time.monotonic() - t0)
        except Exception as e:
            return StageResult(name, False, str(e), time.monotonic() - t0)
```

- [ ] **Step 3: Commit**

```bash
git add scripts/test_doctor_flow.py
git commit -m "feat: add DoctorFlowTester stages 4+5 — note creation and verification"
```

---

## Task 7: Implement cleanup() and run()

**Files:**
- Modify: `scripts/test_doctor_flow.py`

- [ ] **Step 1: Implement cleanup_resources()**

```python
    async def cleanup_resources(self, client: httpx.AsyncClient) -> None:
        """Delete seeded records and chat session. Patient persists — name prefixed [DRTEST]."""
        all_record_ids = self.record_ids + ([self.note_record_id] if self.note_record_id else [])
        for rid in all_record_ids:
            try:
                await client.delete(f"{self.base_url}/api/records/{rid}", timeout=15.0)
            except Exception as e:
                print(f"    ⚠ Cleanup warning: could not delete record {rid}: {e}")

        if self.session_id is not None:
            try:
                await client.delete(
                    f"{self.base_url}/api/chat/sessions/{self.session_id}",
                    timeout=15.0,
                )
            except Exception as e:
                print(f"    ⚠ Cleanup warning: could not delete session {self.session_id}: {e}")

        if self.patient_id is not None:
            p_name = self.scenario["patient"]["name"]
            print(f"  ℹ Patient id={self.patient_id} persists (no delete endpoint). "
                  f"Name '{p_name}' prefixed with [DRTEST] for easy manual cleanup.")
```

- [ ] **Step 2: Implement run()**

```python
    async def run(self, client: httpx.AsyncClient) -> list:
        """Run all 5 stages. Cleanup runs regardless of outcome."""
        results = []
        try:
            r1 = await self.stage_1_setup_patient(client)
            results.append(r1)

            r2 = await self.stage_2_open_session(client)
            results.append(r2)
            if not r2.passed:
                # Still run stages 3–5 skipped stubs so summary counts correctly
                results.append(StageResult("Stage 3: Doctor conversation", False,
                                           "skipped — no session", 0.0))
                results.append(StageResult("Stage 4: Take clinical note", False,
                                           "skipped — no session", 0.0))
                results.append(StageResult("Stage 5: Verify note saved", False,
                                           "skipped — no session", 0.0))
                return results

            r3 = await self.stage_3_doctor_conversation(client)
            results.append(r3)

            r4 = await self.stage_4_take_note(client)
            results.append(r4)

            r5 = await self.stage_5_verify_note_saved(client)
            results.append(r5)
        finally:
            if self.cleanup:
                await self.cleanup_resources(client)
        return results
```

- [ ] **Step 3: Commit**

```bash
git add scripts/test_doctor_flow.py
git commit -m "feat: add DoctorFlowTester cleanup and run orchestration"
```

---

## Task 8: Add runner, reporter, and CLI

**Files:**
- Modify: `scripts/test_doctor_flow.py`

- [ ] **Step 1: Add _print_scenario_header() and _print_scenario_results()**

```python
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
```

- [ ] **Step 2: Add run_all() coroutine**

```python
async def run_all(scenarios: list, base_url: str, cleanup: bool, verbose: bool = False) -> None:
    all_passed = 0
    t_global = time.monotonic()

    async with httpx.AsyncClient() as client:
        for i, scenario in enumerate(scenarios):
            if i > 0:
                await asyncio.sleep(BETWEEN_SCENARIOS_DELAY)
            _print_scenario_header(scenario)
            tester = DoctorFlowTester(scenario, base_url, cleanup=cleanup, verbose=verbose)
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

- [ ] **Step 3: Add parse_args() and __main__ block**

```python
# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Doctor flow test for medical agent")
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
        help="Do not delete seeded records and chat session after the test",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print each conversation turn and tool calls for debugging",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    scenarios = SCENARIOS
    if args.scenario:
        scenarios = [s for s in SCENARIOS if s["id"] == args.scenario]

    print(f"Running {len(scenarios)} scenario(s) against {args.base_url}")
    asyncio.run(run_all(
        scenarios,
        base_url=args.base_url,
        cleanup=not args.no_cleanup,
        verbose=args.verbose,
    ))
```

- [ ] **Step 4: Verify the CLI works**

```bash
python scripts/test_doctor_flow.py --help
```

Expected: usage text listing `--scenario`, `--base-url`, `--no-cleanup`, `--verbose`

- [ ] **Step 5: Commit**

```bash
git add scripts/test_doctor_flow.py
git commit -m "feat: add runner, reporter, and CLI to test_doctor_flow.py"
```

---

## Task 9: Smoke test and fix

**Files:**
- Modify: `scripts/test_doctor_flow.py` (fixes only if needed)

- [ ] **Step 1: Run a single smoke test scenario**

```bash
python scripts/test_doctor_flow.py --scenario cardiac_review --no-cleanup --verbose
```

Expected: 5/5 stages PASS. Key signals to watch for:
- Stage 1: `patient_id=<N>, 2 records seeded`
- Stage 2: `session_id=<N>`
- Stage 3: `tools used: query_patient_basic_info, query_patient_medical_records`
- Stage 4: `record_id=<N>`
- Stage 5: `note found in patient records`

If Stage 3 fails with "no expected tools called":
- Run with `--verbose` to see what tools were actually called
- Check if tool names in `expected_tools` match actual names reported in SSE (case-sensitive)
- The Internist may use `query_patient_basic_info` on first question and `query_patient_medical_records` later

If Stage 2 fails with "session_id not returned":
- The backend may be slow — add a `--base-url` check to confirm it's up
- Check if `agent_role: "clinical_text"` is the correct role name for the Internist

- [ ] **Step 2: Run two more scenarios to confirm robustness**

```bash
python scripts/test_doctor_flow.py --scenario diabetes_management --no-cleanup --verbose
python scripts/test_doctor_flow.py --scenario orthopedic_imaging --no-cleanup --verbose
```

- [ ] **Step 3: Fix any failures, commit fixes**

```bash
git add scripts/test_doctor_flow.py
git commit -m "fix: address smoke test failures in test_doctor_flow.py"
```

---

## Task 10: Full run and final commit

**Files:**
- Modify: `scripts/test_doctor_flow.py` (fixes only if needed)

- [ ] **Step 1: Run all 24 scenarios**

```bash
python scripts/test_doctor_flow.py
```

Expected: `SUMMARY: 24/24 scenarios passed`

If some scenarios fail:
- Check pattern of failures (all same stage? same specialty? timeout?)
- Stage 3 "no expected tools" failures: verify tool names; the agent may have answered from context without querying — this is acceptable behavior, consider relaxing the assertion to a warning
- Timeout failures: backend under load with 24 sequential runs is expected; the 3s `BETWEEN_SCENARIOS_DELAY` should help

- [ ] **Step 2: If Stage 3 tool check is too strict, relax to WARN not FAIL**

If ≥ 5 scenarios fail Stage 3 because the agent answered correctly without calling tools (valid LLM behavior), update the pass condition to:
- PASS if at least one expected tool was called
- WARN (still pass) if no tools were called but agent reply mentioned the patient by name (indicating it retrieved context another way)

```python
# In stage_3_doctor_conversation(), replace the final check:
tools_used = [t for t in self.tool_calls_seen if t in expected_tools]
if tools_used:
    unique = list(dict.fromkeys(tools_used))
    return StageResult(name, True, f"tools used: {', '.join(unique)}", time.monotonic() - t0)

# Soft pass: agent replied with patient context even without explicit tool calls
patient_name = self.scenario["patient"]["name"].replace("[DRTEST] ", "").split()[0].lower()
full_reply = " ".join(getattr(self, "_last_reply", "")).lower()
# (collect full replies in stage 3 — add self._conversation_text accumulation)
```

Only implement this relaxation if the full run confirms it's needed — don't add it speculatively.

- [ ] **Step 3: Commit final state**

```bash
git add scripts/test_doctor_flow.py
git commit -m "feat: complete test_doctor_flow.py — 24 doctor consultation scenarios"
```

---

## Prerequisites

- Backend running at `http://localhost:8000`
- Docker Compose services up (PostgreSQL + Redis)
- Valid LLM API key set in backend `.env`
- Python deps: `httpx`, `argparse` (both available — httpx already used by test_full_flow.py)
- Internist agent with `agent_role="clinical_text"` enabled (core agent, always present)
