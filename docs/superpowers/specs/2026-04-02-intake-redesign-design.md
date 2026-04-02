# Intake Redesign: Fully Dynamic Two-Step Flow

**Date:** 2026-04-02
**Status:** Approved

---

## Goal

Replace the current template-driven intake flow with a fully agent-driven two-step form sequence. The agent collects minimal identity data first, then clinical data, using `ask_user_input` with dynamically generated schemas — no hardcoded form templates.

## Background

The current intake flow uses named form templates (`identify_patient`, `new_patient_details`, `visit_details`) defined in `src/forms/templates.py`. The GP doctor system prompt has no patient-facing intake instructions, causing the agent to skip form collection. The frontend also contains a legacy flat-fields fallback that is dead code once all forms use structured sections.

The redesign removes templates entirely for the intake path and makes the agent fully responsible for form structure.

---

## Architecture

The intake session is initialized with a dedicated **intake system prompt** (`src/prompt/intake.py`) instead of the GP doctor prompt. The frontend selects this mode by passing `mode: "intake"` on the POST body to `/api/chat`.

The agent drives two sequential `ask_user_input` calls:

1. **Identity step** — collects `first_name`, `last_name`, `dob`, `phone`, `gender`
2. **Clinical step** — collects `height_cm`, `weight_kg`, `chief_complaint`, `symptoms`

The backend processes each submission through the existing `_process_dynamic_input()` path in `messages.py`, which already handles `PATIENT_IDENTITY_FIELDS` detection and vault calls. New logic in that path creates a `VitalSign` record when height/weight are present.

---

## Components

### 1. Intake System Prompt — `src/prompt/intake.py`

A new patient-facing system prompt that replaces the GP doctor prompt for intake sessions. It instructs the agent to:

1. Greet the patient and briefly explain the check-in process
2. Call `ask_user_input` with an identity section containing: `first_name` (text, required), `last_name` (text, required), `dob` (date, required), `phone` (text, required), `gender` (select with options Male/Female/Other/Prefer not to say, required)
3. After identity submission is confirmed, call `ask_user_input` with a clinical section containing: `height_cm` (text, optional), `weight_kg` (text, optional), `chief_complaint` (textarea, required), `symptoms` (textarea, optional)
4. Confirm to the patient that check-in is complete and staff will be with them shortly

The prompt must not instruct the agent to reveal PII back to the patient or to perform clinical triage. Its sole job is intake data collection.

### 2. Intake Mode Routing — `src/api/routers/chat/__init__.py`

The `/api/chat` POST endpoint accepts an optional `mode: str` field. When `mode == "intake"`, the session is initialized with the intake system prompt. Otherwise, the existing GP prompt applies. This is the only routing change — no new endpoints.

### 3. Field Classification — `src/forms/field_classification.py`

Two additions:

- `phone` added to `PATIENT_IDENTITY_FIELDS` — needed for patient record creation/lookup
- `height_cm`, `weight_kg` added to `SAFE_FIELDS` — numeric vitals, not PII, safe to return to agent

### 4. VitalSign Creation — `src/api/routers/chat/messages.py`

In `_process_dynamic_input()`, after `vault.identify_patient()` resolves a `patient_id`: if `height_cm` or `weight_kg` are present in the submitted answers, create a `VitalSign` row for that patient. Both fields are optional — create the record if at least one is present.

### 5. IntakeSubmission Model — `src/models/intake_submission.py`

Make the following columns nullable (they are no longer collected):

- `email`
- `address`
- `insurance_provider`
- `policy_id`
- `emergency_contact_name`
- `emergency_contact_relationship`
- `emergency_contact_phone`

`phone` remains non-nullable (it is now collected in Step 1).

### 6. Migration — `alembic/versions/001_init.py`

Update the `intake_submissions` table definition in the single consolidated migration to reflect the nullable columns. Since this is the init migration (no prior state in a clean DB), only the column definitions need updating — no `ALTER TABLE` needed.

### 7. Frontend: Remove Legacy Flat-Fields Fallback — `web/components/reception/form-input-bar.tsx`

The legacy fallback that grouped flat `fields` arrays into sections using `SECTION_LABELS` is dead code: the backend always sends structured `sections` for dynamic forms. Remove:

- `SECTION_LABELS` constant
- The legacy flat-fields branch in `buildSections()` — function becomes: return `schema.sections` mapped with field_type normalization, or `[]`
- The legacy fallback in `flattenFields()` — function becomes: return `schema.sections.flatMap(...)` or `[]`
- `fields?: FormFieldDef[]` from the `ActiveForm.schema` type definition

---

## Data Flow

```
Patient opens intake URL
  ↓
POST /api/chat { mode: "intake" }
  → session initialized with intake system prompt

Agent calls ask_user_input (Step 1 — identity)
  → UI renders sections from schema (no legacy fallback)
  → Patient fills: first_name, last_name, dob, phone, gender
  → POST /api/chat/{sessionId}/form-response
  → _process_dynamic_input() detects PATIENT_IDENTITY_FIELDS (now includes phone)
  → vault.identify_patient() → patient_id (new or existing)
  → agent receives "patient_id=X, is_new=true"

Agent calls ask_user_input (Step 2 — clinical)
  → Patient fills: height_cm, weight_kg, chief_complaint, symptoms
  → POST /api/chat/{sessionId}/form-response
  → _process_dynamic_input() detects height_cm/weight_kg → creates VitalSign row
  → vault.save_intake() → stores chief_complaint, symptoms
  → agent receives intake_id

Agent sends completion message to patient
```

---

## What Is Dropped

The following are removed from the intake path and are no longer collected:

- `email`
- `address` (full address)
- `insurance_provider` / `policy_id`
- `emergency_contact_name` / `emergency_contact_relationship` / `emergency_contact_phone`

These fields remain in `IntakeSubmission` as nullable columns for future use, but are not surfaced to patients.

---

## Out of Scope

- The named form templates in `src/forms/templates.py` are not deleted — they may be used by other agent flows (reception staff, GP doctor). Only the intake patient flow changes.
- The `yes_no` and `question` form types remain in `form-input-bar.tsx` — they are used by the doctor-facing agent, not intake.
- The `SECTION_LABELS` removal is scoped to `form-input-bar.tsx`. No other files reference it.

---

## Testing

- Unit: intake system prompt loads correctly when `mode == "intake"`
- Unit: `_process_dynamic_input()` creates VitalSign when height_cm/weight_kg present
- Unit: `_process_dynamic_input()` does not crash when neither height nor weight is present
- Integration: full two-step intake submission → patient_id resolved, VitalSign created, intake saved
- Frontend: `buildSections()` returns empty array (not crash) when no sections provided
