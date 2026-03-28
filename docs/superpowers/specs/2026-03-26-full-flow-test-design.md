# Full Flow Test Script Design

**Date:** 2026-03-26
**Status:** Approved

## Overview

A single Python script (`scripts/test_full_flow.py`) that simulates a virtual patient having a real multi-turn conversation with the medical agent. The agent is expected to ask questions, gather information, consult, and — if warranted — automatically create patient records and a visit, then suggest department routing.

The script verifies that all database records were created correctly and that routing suggestions match expected departments.

## Architecture

### Class: `FlowTester`

A class-based test runner that carries state (`session_id`, `patient_id`, `visit_id`) across stages and produces a summary report.

```
FlowTester(scenario, base_url, cleanup)
  ├── state: session_id, patient_id, visit_id, turn_count
  ├── stage_1_start_session()           → POST /api/chat/sessions
  ├── stage_2_intake_conversation()     → multi-turn SSE chat loop (min 3, max 15 turns)
  ├── stage_3_verify_patient_created()  → GET /api/patients?name=<name>, assert match
  ├── stage_4_verify_visit_created()    → GET /api/visits?patient_id=<id>, assert match
  ├── stage_5_verify_routing()          → GET /api/visits/{id}, assert routing_suggestion
  ├── cleanup()                         → DELETE patient + visits (if --no-cleanup not set)
  └── run() → StageResult list + summary
```

## Conversation Engine (Stage 2)

### Scenario `responses` dict format

Each scenario defines a flat dict of keyword → answer pairs. Keys are lowercase single words that the engine matches against the agent's reply text.

```python
"responses": {
    "name":     "James Carter",       # matched when agent asks for patient name
    "born":     "1979-05-14",         # matched when agent asks date of birth / born
    "dob":      "1979-05-14",         # alias for "born"
    "age":      "45",                 # matched when agent asks age
    "gender":   "male",               # matched when agent asks gender / sex
    "symptoms": "Chest tightness and shortness of breath since this morning",
    "history":  "Hypertension, on lisinopril for 3 years",
    "default":  "I'm not sure, but my chest really hurts",  # fallback
}
```

### Keyword matching algorithm

1. Lower-case the agent's reply text.
2. Iterate over `responses` keys (excluding `"default"`) in insertion order.
3. Return the value for the **first** key that appears as a substring in the reply.
4. If no key matches, return `responses["default"]`.
5. Matching is case-insensitive substring search (no regex needed).
6. If the agent reply contains multiple matching keys, the first one wins (insertion order).

### Stop conditions (Stage 2 exits successfully when any is true)

The engine checks the assembled full text of each agent reply for these signals:

| Signal | Check |
|--------|-------|
| Visit created | reply contains `"visit"` AND (`"created"` OR `"registered"` OR `"scheduled"`) |
| Record saved  | reply contains `"record"` AND (`"saved"` OR `"added"` OR `"created"`) |
| Go to hospital | reply contains `"please come"` OR `"visit the hospital"` OR `"go to"` |
| Tool event    | SSE stream emits an event with `"create_patient"` or `"create_visit"` in its data |

If none of the above triggers within 15 turns, Stage 2 is marked **FAIL** with message:
`"agent did not conclude within 15 turns"`.

If stop condition triggers before turn 3, Stage 2 is marked **FAIL** with message:
`"agent concluded too quickly (< 3 turns) — intake may not have occurred"`.

### SSE stream parsing

The backend streams Server-Sent Events. Each line is parsed as:

```
data: <json_payload>\n\n
```

The script reads lines from the response stream and:
1. Strips `data: ` prefix.
2. Parses JSON: `{"type": "...", "content": "..."}` or `{"type": "...", "data": {...}}`.
3. Accumulates `content` from `type == "text"` or `type == "message"` events into `full_reply`.
4. Checks for `type == "tool_call"` with `name` containing `"create_patient"` or `"create_visit"` as a stop-condition signal.
5. Stops reading on `data: [DONE]` or connection close.

## Stages

### Stage 1 — Start Session
- `POST /api/chat/sessions`
- Body: `{"title": "flow-test-<scenario_id>"}`
- Asserts: `response.status_code == 200`, `session_id` present in response
- Stores: `self.session_id`

### Stage 2 — Intake Conversation
- Sends messages to `POST /api/chat` with `{"session_id": ..., "message": ..., "stream": true}`
- Runs conversation loop as described above
- Stores: `self.turn_count`
- Pass: stop condition met between turn 3 and 15
- Fail: stop condition not met by turn 15, OR triggered before turn 3

### Stage 3 — Verify Patient Created
- `GET /api/patients` — retrieves full list
- Searches by patient name from scenario (case-insensitive substring match)
- Asserts: patient with matching name exists
- Stores: `self.patient_id`
- Fail: no matching patient found

### Stage 4 — Verify Visit Created
- `GET /api/visits?patient_id=<self.patient_id>`
- Asserts: at least one visit record exists for this patient
- Stores: `self.visit_id` (most recently created)
- Fail: no visit found for patient

### Stage 5 — Verify Routing Suggestion
- `GET /api/visits/<self.visit_id>`
- Reads `routing_suggestion` field from the visit record
- Asserts: `routing_suggestion` is not null AND its value is in `scenario["expected_department"]`
- Fail: field is null OR value not in expected list

## Cleanup

Runs in `finally` block regardless of pass/fail. Skipped if `--no-cleanup` flag is set.

```python
if self.patient_id:
    await client.delete(f"/api/patients/{self.patient_id}")
    # cascades to visits via DB foreign key
if self.session_id:
    await client.delete(f"/api/chat/sessions/{self.session_id}")
```

If `patient_id` was never captured (Stage 3 failed), cleanup logs a warning and skips patient deletion.

## Scenarios

```python
SCENARIOS = [
    {
        "id": "cardiac_emergency",
        "description": "45yo male with chest pain → Cardiology/Emergency",
        "responses": {
            "name": "James Carter",
            "born": "1979-05-14", "dob": "1979-05-14",
            "age": "45", "gender": "male",
            "symptoms": "Chest tightness and shortness of breath since this morning",
            "history": "Hypertension, on lisinopril for 3 years",
            "default": "The chest pain is getting worse when I breathe",
        },
        "expected_department": ["emergency", "cardiology"],
    },
    {
        "id": "neuro_urgent",
        "description": "62yo female with sudden severe headache → Neurology/Emergency",
        "responses": {
            "name": "Margaret Liu",
            "born": "1963-11-02", "dob": "1963-11-02",
            "age": "62", "gender": "female",
            "symptoms": "Sudden severe headache, worst of my life, started an hour ago",
            "history": "No significant history, non-smoker",
            "default": "My vision is also a little blurry",
        },
        "expected_department": ["neurology", "emergency"],
    },
    {
        "id": "orthopedic_injury",
        "description": "30yo male with ankle injury → Orthopedics/Radiology",
        "responses": {
            "name": "Kevin Park",
            "born": "1995-03-18", "dob": "1995-03-18",
            "age": "30", "gender": "male",
            "symptoms": "I twisted my ankle playing football, it's very swollen and I can't walk",
            "history": "No chronic conditions",
            "default": "It happened about 2 hours ago",
        },
        "expected_department": ["orthopedics", "radiology"],
    },
    {
        "id": "diabetes_followup",
        "description": "55yo female with diabetes symptoms → Endocrinology/Internal Medicine",
        "responses": {
            "name": "Sandra Okoye",
            "born": "1970-07-25", "dob": "1970-07-25",
            "age": "55", "gender": "female",
            "symptoms": "Feeling very thirsty and tired, urinating frequently for the past week",
            "history": "Type 2 diabetes diagnosed 5 years ago, on metformin",
            "default": "My blood sugar was 280 this morning",
        },
        "expected_department": ["endocrinology", "internal_medicine"],
    },
    {
        "id": "respiratory_issue",
        "description": "38yo male with persistent cough → Pulmonology",
        "responses": {
            "name": "Daniel Torres",
            "born": "1987-09-30", "dob": "1987-09-30",
            "age": "38", "gender": "male",
            "symptoms": "Persistent cough for 3 weeks with wheezing and difficulty breathing at night",
            "history": "Asthma as a child, smoker for 10 years",
            "default": "The inhaler I used years ago isn't helping",
        },
        "expected_department": ["pulmonology", "internal_medicine"],
    },
    {
        "id": "routine_checkup",
        "description": "28yo female for routine checkup → General Check-up",
        "responses": {
            "name": "Aisha Rahman",
            "born": "1997-02-11", "dob": "1997-02-11",
            "age": "28", "gender": "female",
            "symptoms": "I just want a general health checkup, I feel fine",
            "history": "No known conditions, no medications",
            "default": "I haven't had a checkup in 2 years",
        },
        "expected_department": ["general_checkup"],
    },
]
```

## CLI Interface

```bash
# Run all scenarios sequentially
python scripts/test_full_flow.py

# Run a single scenario
python scripts/test_full_flow.py --scenario cardiac_emergency

# Keep created records after run
python scripts/test_full_flow.py --no-cleanup

# Target a non-default backend
python scripts/test_full_flow.py --base-url http://localhost:9000
```

## Output Format

```
Running scenario: cardiac_emergency (45yo male with chest pain → Cardiology/Emergency)
────────────────────────────────────────────────────────────────
[Stage 1] Start chat session ........... ✅ session_id=abc123
[Stage 2] Intake conversation (8 turns). ✅ agent concluded: visit recommended
[Stage 3] Patient record created ....... ✅ patient_id=42, name=James Carter
[Stage 4] Visit created ................ ✅ visit_id=VIS-20260326-001
[Stage 5] Routing suggestion ........... ✅ department=cardiology
────────────────────────────────────────────────────────────────
PASSED 5/5 stages in 12.3s

══════════════════════════════════════
SUMMARY: 6/6 scenarios passed
Total time: 87.4s
══════════════════════════════════════
```

## Error Handling

- Each stage wraps calls in try/except and marks the stage FAIL without crashing subsequent stages
- Cleanup runs in a `finally` block regardless of pass/fail
- Timeouts: 60s per SSE stream, 30s per REST call
- If `patient_id` is never captured, cleanup logs a warning and skips deletion

## Prerequisites

- Backend running at `http://localhost:8000`
- Docker Compose services up (PostgreSQL + Redis)
- Valid LLM API key set in backend `.env`
- Python deps: `httpx`, `argparse` (stdlib)
