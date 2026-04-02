# Patient Data Refactor & Seed Design

**Date:** 2026-04-02
**Status:** Approved

## Overview

Refactor the `Patient` model to use a proper `Date` type for `dob`, add three core clinical tables (`allergies`, `medications`, `vital_signs`), and replace all fragmented seed scripts with one consolidated idempotent seeder covering 10 richly detailed patients.

---

## 1. Patient Model Change

**File:** `src/models/patient.py`

Change `dob` from `String(20)` to `Date`. No other fields change.

```python
# Before
dob: Mapped[str] = mapped_column(String(20), nullable=False)

# After
from datetime import date
dob: Mapped[date] = mapped_column(Date, nullable=False)
```

All callers that construct or display `dob` must be updated to pass a `datetime.date` object.

---

## 2. New Clinical Tables

### 2a. `allergies`

Tracks known patient allergies with clinical severity.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | INTEGER PK | No | |
| `patient_id` | INTEGER FK → patients.id | No | Indexed |
| `allergen` | VARCHAR(200) | No | e.g. "Penicillin", "Peanuts" |
| `reaction` | VARCHAR(200) | No | e.g. "Anaphylaxis", "Rash" |
| `severity` | VARCHAR(20) | No | `mild` \| `moderate` \| `severe` |
| `recorded_at` | DATE | No | |

### 2b. `medications`

Active and historical medication prescriptions.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | INTEGER PK | No | |
| `patient_id` | INTEGER FK → patients.id | No | Indexed |
| `name` | VARCHAR(200) | No | e.g. "Metformin" |
| `dosage` | VARCHAR(100) | No | e.g. "500mg" |
| `frequency` | VARCHAR(100) | No | e.g. "twice daily" |
| `prescribed_by` | VARCHAR(200) | Yes | Doctor name |
| `start_date` | DATE | No | |
| `end_date` | DATE | Yes | `NULL` = still active |

### 2c. `vital_signs`

Point-in-time vitals readings, optionally tied to a visit.

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | INTEGER PK | No | |
| `patient_id` | INTEGER FK → patients.id | No | Indexed |
| `visit_id` | INTEGER FK → visits.id | Yes | Indexed; NULL = standalone checkup |
| `recorded_at` | DATETIME | No | |
| `systolic_bp` | INTEGER | Yes | mmHg |
| `diastolic_bp` | INTEGER | Yes | mmHg |
| `heart_rate` | INTEGER | Yes | bpm |
| `temperature` | FLOAT | Yes | °C |
| `respiratory_rate` | INTEGER | Yes | breaths/min |
| `oxygen_saturation` | FLOAT | Yes | % |
| `weight_kg` | FLOAT | Yes | |
| `height_cm` | FLOAT | Yes | |

---

## 3. SQLAlchemy Models

Three new model files:

- `src/models/allergy.py` → `Allergy` class
- `src/models/medication.py` → `Medication` class
- `src/models/vital_sign.py` → `VitalSign` class

All inherit from the shared `Base`. All exported from `src/models/__init__.py`.

`Patient` gains three back-populated relationships, all with `cascade="all, delete-orphan"`:
```python
allergies: Mapped[List["Allergy"]]    # cascade delete
medications: Mapped[List["Medication"]]  # cascade delete
vital_signs: Mapped[List["VitalSign"]]   # cascade delete
```

---

## 4. Migration

Modify `alembic/versions/001_init.py` **in place** — no new migration file:
- Change `patients.dob` column from `String(20)` to `Date`
- Append `CREATE TABLE` statements for `allergies`, `medications`, `vital_signs`
- Append corresponding `DROP TABLE` statements to `downgrade()`

Single migration file, single head. No incremental patch on top.

---

## 5. Consolidated Seed (`scripts/db/seed/seed.py`)

**Replaces:** `seed_mock_data.py`, `seed_full_flow.py`, `seed_detailed_clinical_data.py`, `seed_agents.py`, `seed_chat_sessions.py`

**Idempotent:** upsert by `(name, dob)` for patients; skip if exists for related records.

### 5a. Patient Roster (10 patients)

| # | Name | DOB | Sex | Primary Conditions |
|---|------|-----|-----|--------------------|
| 1 | Ava Thompson | 1988-03-14 | F | Type 2 DM, on GLP-1 |
| 2 | Mateo Alvarez | 1975-07-22 | M | Hypertension, hyperlipidemia |
| 3 | Eleanor Price | 1954-11-05 | F | Breast cancer survivor, peripheral neuropathy |
| 4 | Clara Nguyen | 1990-01-30 | F | Asthma, allergic rhinitis |
| 5 | Harold Washington | 1958-09-18 | M | COPD, AFib, BPH |
| 6 | James Okafor | 1970-04-02 | M | Type 2 DM, CKD Stage 3 |
| 7 | Rebecca Chen | 1995-06-11 | F | GAD, on sertraline |
| 8 | Walter Kim | 1948-12-29 | M | HFrEF, pacemaker |
| 9 | Maria Santos | 1979-08-07 | F | Post-cholecystectomy, migraines |
| 10 | David Petrov | 1962-02-16 | M | Lung nodule surveillance, ex-smoker |

### 5b. Per-Patient Data Volume

| Data type | Volume per patient |
|-----------|-------------------|
| Allergies | 3–5 (mix of severities) |
| Medications | 4–6 (4–5 active, 1 historical with end_date) |
| Vital sign snapshots | 5–7 (backdated over 6 months; some visit-linked) |
| Medical records | 2–3 (clinical notes, SOAP format) |
| Visits | 1–2 (distributed across all VisitStatus states) |

### 5c. Visit Status Distribution

Visits are distributed so the kanban board is fully populated:

| Status | Patient(s) |
|--------|-----------|
| `completed` | Ava, Rebecca |
| `in_department` | Harold, Walter |
| `routed` | Clara, Maria |
| `auto_routed` | Mateo |
| `pending_review` | James, David |
| `triaged` | Eleanor |
| `intake` | James (second visit) |

---

## 6. Files Changed

### New files
- `src/models/allergy.py`
- `src/models/medication.py`
- `src/models/vital_sign.py`
- `scripts/db/seed/seed.py`

### Modified files
- `src/models/patient.py` — `dob` type change
- `src/models/__init__.py` — export new models
- `alembic/versions/001_init.py` — add new tables, fix dob type

### Deleted files
- `scripts/db/seed/seed_mock_data.py`
- `scripts/db/seed/seed_full_flow.py`
- `scripts/db/seed/seed_detailed_clinical_data.py`
- `scripts/db/seed/seed_agents.py`
- `scripts/db/seed/seed_chat_sessions.py`

---

## 7. Out of Scope

- `IntakeSubmission` — no changes; remains the PII vault
- `MedicalRecord` — no changes to schema
- Lab results as structured data (future work)
- Problem list / ICD-10 coding (future work)
- UI changes to display new clinical tables (future work)
