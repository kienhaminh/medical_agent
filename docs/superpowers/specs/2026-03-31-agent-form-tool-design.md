# Agent Form Tool — Design Spec

**Date:** 2026-03-31  
**Status:** Approved  

---

## Overview

A mechanism allowing the reception agent to request structured user input (forms) mid-conversation. The agent pauses execution, the frontend replaces the message input bar with the appropriate form, and the agent resumes only after the user submits. Personal information submitted via forms is stored in a privacy vault — the agent receives opaque IDs, never raw PII.

---

## Goals

- Let the reception agent collect patient information and confirm actions via structured forms
- Block the agent loop until the user responds
- Never expose PII to the agent — it receives status + opaque IDs only
- Keep the UX clean: the form replaces the input bar (no modals, no separate pages)

---

## Non-Goals

- Dynamic/database-managed templates (templates are hardcoded in Python)
- Multi-step wizard forms (each template is a single-submit form)
- Form tool available to agents other than the reception agent

---

## Form Templates

Defined in `src/forms/templates.py`. Two initial templates:

### `patient_intake`

Multi-field check-in form. Fields:

| Field | Type | Required |
|---|---|---|
| first_name | text | yes |
| last_name | text | yes |
| dob | date | yes |
| gender | select: male / female / other | yes |
| phone | text | yes |
| email | text | yes |
| address | text | yes |
| chief_complaint | text | yes |
| symptoms | textarea | no |
| insurance_provider | text | yes |
| policy_id | text | yes |
| emergency_contact_name | text | yes |
| emergency_contact_relationship | select: spouse / parent / sibling / friend / other | yes |
| emergency_contact_phone | text | yes |

**Privacy behaviour:** On submission, all fields are saved to the `IntakeSubmission` vault table. The form-response endpoint looks up or creates a `Patient` record and returns `patient_id` + `intake_id` to the agent. No raw field values are returned.

**Agent receives:**
```
intake_completed. patient_id=42, intake_id=v-abc123
```

### `confirm_visit`

Yes/no confirmation before creating a visit.

- Message: `"Are you ready to proceed with your visit today?"`
- Options: Confirm / Cancel

**Agent receives:** `"confirmed"` or `"declined"`

---

## Architecture

### New Backend Files

| File | Purpose |
|---|---|
| `src/forms/templates.py` | Hardcoded `FormTemplate` dataclass definitions |
| `src/forms/vault.py` | `save_intake(answers) → (patient_id, intake_id)` — writes to DB, returns opaque IDs |
| `src/tools/form_request_registry.py` | In-memory `{form_id: (asyncio.Event, answer_slot)}` store |
| `src/tools/builtin/ask_user_tool.py` | The `ask_user(template)` tool, registered to reception agent only |

### New API Endpoint

`POST /api/chat/{session_id}/form-response`

Request body:
```json
{ "form_id": "uuid", "answers": { "field": "value", ... } }
```

Behaviour:
1. Validate `form_id` exists in `FormRequestRegistry`
2. Run `vault.save(answers)` to persist PII and get opaque IDs
3. Store the result (status + IDs) in the registry
4. Set the `asyncio.Event` to unblock the waiting tool
5. Return `200 OK`

### Modified Files

| File | Change |
|---|---|
| `src/api/routers/chat/messages.py` | Register new `/form-response` route |
| SSE stream handler | Already passes through all event types — no change needed |
| Reception agent registration | Register `ask_user` tool to reception agent scope |

### New Frontend Files

| File | Purpose |
|---|---|
| `web/components/reception/form-input-bar.tsx` | Renders the active form in place of the message input bar |
| `web/components/reception/form-fields.tsx` | Individual field components: text, date, select, textarea, yes-no |

### Modified Frontend Files

| File | Change |
|---|---|
| Reception chat page / input area | Detect `form_request` SSE event → set `activeForm` state → swap input bar for `FormInputBar` |
| SSE parser / stream handler | Add handler for `form_request` event type |

---

## Data Flow

```
Agent calls ask_user(template="patient_intake")
  ├─ generates form_id (UUID)
  ├─ registers (form_id, asyncio.Event) in FormRequestRegistry
  ├─ emits SSE: { "form_request": { "id": form_id, "template": "patient_intake", "schema": [...] } }
  └─ awaits asyncio.Event (agent loop suspended)

Frontend:
  ├─ SSE parser detects form_request
  ├─ sets activeForm = { id, template, schema }
  ├─ message input bar unmounts
  └─ FormInputBar mounts and renders fields from schema

Patient fills and submits form:
  └─ POST /api/chat/{session_id}/form-response
        { form_id, answers: { first_name: "...", ... } }

Backend form-response handler:
  ├─ vault.save(answers) → { patient_id: 42, intake_id: "v-abc123" }
  ├─ registry.resolve(form_id, "intake_completed. patient_id=42, intake_id=v-abc123")
  └─ event.set()  →  agent resumes

Agent receives tool result:
  "intake_completed. patient_id=42, intake_id=v-abc123"
  (no PII)

Frontend:
  ├─ POST returns 200
  ├─ clears activeForm state
  └─ message input bar remounts
```

---

## Privacy Vault

### `IntakeSubmission` DB Table

| Column | Type | Notes |
|---|---|---|
| id | UUID | primary key (`intake_id`) |
| patient_id | FK → Patient | linked patient record |
| first_name | str | PII |
| last_name | str | PII |
| dob | date | PII |
| gender | str | |
| phone | str | PII |
| email | str | PII |
| address | str | PII |
| chief_complaint | str | |
| symptoms | str | nullable |
| insurance_provider | str | |
| policy_id | str | |
| emergency_contact_name | str | PII |
| emergency_contact_relationship | str | |
| emergency_contact_phone | str | PII |
| created_at | datetime | |

### `vault.save()` Logic

1. Look up existing `Patient` by `(first_name + last_name + dob)` — create if not found
2. Insert `IntakeSubmission` row
3. Return `(patient.id, intake_submission.id)`

---

## Tool Registration

`ask_user` is registered with `scope="reception"` in the `ToolRegistry`. It is not available to doctor, nurse, or other agents.

Tool signature:
```python
def ask_user(template: str) -> str:
    """Request structured input from the patient.

    Pauses agent execution until the patient submits the form.
    Returns status and opaque IDs — never raw PII.

    Args:
        template: Form template name ("patient_intake" | "confirm_visit")

    Returns:
        For patient_intake: "intake_completed. patient_id=X, intake_id=Y"
        For confirm_visit: "confirmed" or "declined"
    """
```

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Unknown template name | Tool returns error string immediately, agent handles |
| Form times out (patient abandons) | asyncio.Event has a 5-minute timeout; tool returns `"form_timeout"` |
| form_id not found in registry | POST /form-response returns 404 |
| vault.save() DB error | POST /form-response returns 500; agent receives `"form_error"` on timeout |
| Patient closes tab mid-form | Timeout handles it; no hung coroutines |

---

## Frontend UX

- **While form is active:** message input bar is hidden, `FormInputBar` occupies the bottom panel
- **FormInputBar** renders fields grouped by section (Personal, Contact, Visit, Insurance, Emergency Contact)
- **Validation:** required fields validated client-side before submit; submit button disabled until valid
- **Yes/No form:** renders two large buttons (Confirm / Cancel) instead of a field form
- **After submit:** form clears, input bar returns, agent response appears in chat as normal

---

## Alembic Migration

A new migration creates the `intake_submissions` table. The existing `patients` table is unchanged.
