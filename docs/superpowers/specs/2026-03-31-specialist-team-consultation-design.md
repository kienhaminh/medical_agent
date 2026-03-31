# Specialist Team Consultation Design

## Overview

Add a multi-specialist team consultation feature to the medical agent system. When a patient case requires multi-specialty input — either automatically flagged by the reception agent or manually requested by the doctor — a Chief Agent convenes a team of specialists, runs multi-round deliberation on a shared discussion thread, and delivers a structured synthesis to the doctor.

This is additive: no changes to `LangGraphAgent`, `graph_builder.py`, or the existing `SpecialistHandler`.

---

## Section 1: Architecture Overview

```
Doctor (or reception auto-flag)
  → calls request_specialist_team(case_summary, patient_id)
    → Chief reads case, selects 2-4 specialists
    → Opens CaseThread (persisted to DB)

    Round 1 (parallel):
      Each specialist reads case brief → posts finding to thread

    Chief reviews round 1:
      → If converged: skip to synthesis
      → If not: optionally post a ChiefMessage directing next round

    Round 2 (parallel):
      Each specialist reads full thread (including Chief directive) → responds/challenges

    (repeat up to max_rounds=3)

    Chief reads full thread → writes synthesis
    → Returns to calling agent as a formatted string
    → Doctor receives ConsultationCard in chat
```

Two trigger paths:
- **Manual**: Doctor explicitly asks for team review → doctor agent calls the tool
- **Automatic**: Reception detects complex presentation → reception agent calls the tool, synthesis stored on visit

---

## Section 2: CaseThread Data Model

Two new DB tables: `case_threads` and `case_messages`.

### `case_threads`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `patient_id` | int FK | → `patients.id` |
| `visit_id` | int FK nullable | → `visits.id` |
| `created_by` | str | e.g. `"doctor:session_42"` |
| `trigger` | enum | `"manual"` \| `"auto"` |
| `status` | enum | `"open"` \| `"converged"` \| `"closed"` |
| `max_rounds` | int | default 3 |
| `current_round` | int | default 0 |
| `case_summary` | text | Chief's initial brief sent to all specialists |
| `synthesis` | text nullable | Chief's final output, written at close |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

### `case_messages`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `thread_id` | UUID FK | → `case_threads.id` |
| `round` | int | which round this was posted in |
| `sender_type` | enum | `"specialist"` \| `"chief"` |
| `specialist_role` | str nullable | `"cardiologist"`, `"pulmonologist"`, etc. |
| `content` | text | the message body |
| `agrees_with` | JSON nullable | list of specialist roles this message agrees with |
| `challenges` | JSON nullable | list of specialist roles this message challenges |
| `created_at` | timestamp | |

### Convergence detection

Chief reads the latest round after all specialists post. Convergence if any of:
- All messages have empty `challenges` and non-empty `agrees_with`
- `current_round >= max_rounds`
- Chief LLM call judges the thread stable (returns `converged=True`)

---

## Section 3: Discussion Flow

### Round loop

```python
for round_num in range(1, thread.max_rounds + 1):
    thread.current_round = round_num

    # Parallel specialist calls — each sees full thread so far
    await asyncio.gather(*[
        specialist_call(thread, role, round_num)
        for role in team
    ])

    # Chief reviews
    directive = await chief_review(thread, round_num)
    if directive.converged:
        thread.status = "converged"
        break

    # Chief may inject a directive for next round (optional)
    if directive.message:
        await post_chief_message(thread, directive.message, round_num)

else:
    thread.status = "closed"
```

### Specialist context per call

Each specialist receives:
1. **Case brief** — structured summary written by Chief before Round 1
2. **Full thread** — all prior `CaseMessage` rows, ordered by round + created_at
3. **Role instructions** — "You are a cardiologist. Focus on cardiac risk..."
4. **Round instructions** — Round 1: "Post your initial findings." Round 2+: "Respond to the discussion above. Challenge or affirm your colleagues' points directly."

### Chief directive (between rounds)

The Chief may post a `CaseMessage(sender_type="chief")` after reviewing a round. This is optional — the Chief only posts when the discussion needs steering (e.g., two specialists are talking past each other on a key point). Specialists see Chief messages in their context for the next round.

---

## Section 4: Chief Agent Design

The Chief runs as four sequential LLM calls inside `TeamConsultationHandler.run()`:

| Call | Purpose | Input | Output |
|---|---|---|---|
| `select_team` | Choose 2-4 specialists | case_summary | list of roles |
| `write_brief` | Structured case brief | case_summary + patient record | brief string |
| `chief_review` | After each round | full thread | `ChiefDirective(converged, message)` |
| `synthesize` | Final output | full thread | formatted synthesis string |

### Specialist roster

```python
SPECIALIST_ROSTER = {
    "cardiologist":    "Focus on cardiac risk, arrhythmia, heart failure, ECG findings.",
    "pulmonologist":   "Focus on respiratory, oxygenation, ventilation, lung pathology.",
    "nephrologist":    "Focus on renal function, electrolytes, fluid balance, AKI.",
    "endocrinologist": "Focus on glucose control, thyroid, metabolic disorders.",
    "neurologist":     "Focus on neurological symptoms, stroke risk, altered mental status.",
    "internist":       "Generalist — catch anything the specialists may miss. Integrate findings.",
}
```

Chief always includes `internist`. Selects 1-3 domain specialists based on presenting complaint.

### Case brief format

```
Patient: [age], [sex]
Chief complaint: [...]
Relevant history: [...]
Current medications: [...]
Recent vitals/labs: [...]
Key question for this consultation: [...]
```

### Synthesis format

```
PRIMARY RECOMMENDATION: [...]
CONFIDENCE: high | moderate | low
SUPPORTING: [roles that agreed, one-line rationale each]
DISSENT: [roles that disagreed, their specific concern]
CHIEF NOTES: [unresolved points, caveats, follow-up suggestions]
```

---

## Section 5: Integration with Existing System

### New tool: `request_specialist_team`

```python
async def request_specialist_team(
    case_summary: str,
    patient_id: int,
) -> str:
    """
    Convene a specialist team to deliberate on a patient case.

    Use when:
    - A case requires multi-specialty input
    - The doctor explicitly requests a team consultation
    - Reception flags a complex presentation during intake

    Returns: formatted synthesis (primary recommendation + supporting/dissent + confidence)
    """
```

- Registered `scope="global"` — accessible to both doctor agent and reception agent
- Internally instantiates and runs `TeamConsultationHandler`

### Call stack

```
LangGraphAgent
  └── tool call: request_specialist_team
        └── TeamConsultationHandler.run()
              ├── Chief LLM calls (select_team, write_brief, chief_review, synthesize)
              └── Specialist LLM calls (asyncio.gather per round)
```

No new LangGraph nodes. No persistent sub-agents. Entire consultation runs inside a single tool call.

### Trigger paths

**Manual (doctor)**
1. Doctor: "Get me a specialist team review on this patient"
2. Doctor agent calls `request_specialist_team(case_summary, patient_id)`
3. Synthesis returned directly as tool result, agent presents to doctor

**Automatic (reception)**
1. Reception agent detects complex case (multiple systems, unclear diagnosis, etc.)
2. Reception agent calls `request_specialist_team(case_summary, patient_id)`
3. Synthesis stored in `case_threads.synthesis` (linked to the visit via `case_threads.visit_id`)
4. When doctor opens the case: agent queries `case_threads` for the visit, presents pre-run consultation

### Existing code untouched

- `LangGraphAgent` — no changes
- `graph_builder.py` — no changes
- `SpecialistHandler` — kept for simple single-specialist calls; `TeamConsultationHandler` is additive

---

## Section 6: Frontend

### Live progress (during consultation)

`TeamConsultationHandler` pushes `team_progress` events to the existing SSE side-channel while running. The frontend renders a status card in the chat:

```
[Team Consultation in progress]
● Selecting specialist team...
● Round 1 — Cardiologist, Pulmonologist, Internist posting...
● Chief reviewing round 1...
● Round 2 — addressing anticoagulation conflict...
● Synthesizing...
```

### Final synthesis — ConsultationCard

When the tool returns, the doctor's agent presents the synthesis. Frontend detects the structured format and renders a `ConsultationCard` bubble:

```
┌─ Team Consultation ──────────────────────────────────┐
│ Confidence: HIGH          3 specialists · 2 rounds   │
│                                                       │
│ PRIMARY RECOMMENDATION                                │
│ Start anticoagulation therapy, monitor renal...       │
│                                                       │
│ SUPPORTING  Cardiologist ✓  Internist ✓               │
│ DISSENT     Nephrologist — "Hold pending creatinine"  │
│                                                       │
│ [View full discussion thread ↓]                       │
└───────────────────────────────────────────────────────┘
```

### Expandable thread view

"View full discussion thread" expands inline — shows all rounds grouped by round number, Chief directives visually distinct from specialist messages. Data fetched from `GET /api/case-threads/{thread_id}`.

### New API endpoint

`GET /api/case-threads/{thread_id}` — returns thread + all messages ordered by round and created_at.

### Where it renders

Doctor workstation chat panel. No new pages needed.

---

## What's New vs What's Unchanged

| Component | Status |
|---|---|
| `case_threads` DB table | New |
| `case_messages` DB table | New |
| `TeamConsultationHandler` | New (`src/agents/team_consultation_handler.py`) |
| `request_specialist_team` tool | New (`src/tools/builtin/request_specialist_team_tool.py`) |
| `GET /api/case-threads/{id}` endpoint | New |
| `ConsultationCard` React component | New |
| SSE `team_progress` event type | New |
| `LangGraphAgent` | Unchanged |
| `graph_builder.py` | Unchanged |
| `SpecialistHandler` | Unchanged |
| All existing tools | Unchanged |

---

## Out of Scope

- Persistent specialist sub-agents with their own memory (future: upgrade to LangGraph native multi-agent)
- Doctor ability to reply directly into the thread (future)
- Specialist tool access during consultation (specialists reason from text context only, no DB calls)
- Multi-user / multi-session thread visibility
