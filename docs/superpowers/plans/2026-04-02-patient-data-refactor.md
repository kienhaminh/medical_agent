# Patient Data Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `Allergy`, `Medication`, and `VitalSign` models, change `Patient.dob` to a proper `Date` type, and replace all fragmented seed scripts with one consolidated 10-patient seeder.

**Architecture:** Three new SQLAlchemy models (one file each) back-populate onto `Patient` with cascade-delete. The API boundary continues accepting ISO date strings; conversion to `date` happens at the persistence layer. The seed script is a single idempotent runner that owns all fixture data.

**Tech Stack:** Python 3.11+, SQLAlchemy 2 (mapped_column / Mapped), Alembic, PostgreSQL, pytest-asyncio

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/models/allergy.py` | `Allergy` ORM model |
| Create | `src/models/medication.py` | `Medication` ORM model |
| Create | `src/models/vital_sign.py` | `VitalSign` ORM model |
| Create | `scripts/db/seed/seed.py` | Consolidated idempotent seeder |
| Create | `tests/test_clinical_models.py` | Tests for new models + dob type |
| Modify | `src/models/patient.py` | `dob: date`, three new relationships |
| Modify | `src/models/__init__.py` | Export new models |
| Modify | `alembic/versions/001_init.py` | Fix dob type, add three tables |
| Modify | `src/forms/vault.py` | `date.fromisoformat(dob)` at lookup/create |
| Modify | `src/tools/check_patient_tool.py` | `date.fromisoformat(dob)` before query |
| Modify | `src/tools/register_patient_tool.py` | `date.fromisoformat(dob)` before create |
| Modify | `src/tools/compare_patient_tool.py` | `.isoformat()` when comparing dob |
| Modify | `src/api/routers/patients/core.py` | `cast` for ilike, `.isoformat()` in responses |
| Modify | `src/api/routers/visits.py` | `.isoformat()` for `patient_dob` |
| Delete | `scripts/db/seed/seed_mock_data.py` | Replaced by seed.py |
| Delete | `scripts/db/seed/seed_full_flow.py` | Replaced by seed.py |
| Delete | `scripts/db/seed/seed_detailed_clinical_data.py` | Replaced by seed.py |
| Delete | `scripts/db/seed/seed_agents.py` | Replaced by seed.py |
| Delete | `scripts/db/seed/seed_chat_sessions.py` | Replaced by seed.py |

---

## Task 1: New Clinical Models

**Files:**
- Create: `src/models/allergy.py`
- Create: `src/models/medication.py`
- Create: `src/models/vital_sign.py`
- Create: `tests/test_clinical_models.py`

- [ ] **Step 1: Write failing tests for the three new models**

```python
# tests/test_clinical_models.py
"""Tests for Allergy, Medication, and VitalSign models."""
import pytest
from datetime import date, datetime


def test_allergy_model_fields():
    """Allergy has the required columns."""
    from src.models.allergy import Allergy
    a = Allergy(
        patient_id=1,
        allergen="Penicillin",
        reaction="Anaphylaxis",
        severity="severe",
        recorded_at=date(2024, 1, 15),
    )
    assert a.allergen == "Penicillin"
    assert a.severity == "severe"
    assert a.patient_id == 1


def test_medication_model_fields():
    """Medication tracks active and ended prescriptions."""
    from src.models.medication import Medication
    m = Medication(
        patient_id=1,
        name="Metformin",
        dosage="500mg",
        frequency="twice daily",
        prescribed_by="Dr. Smith",
        start_date=date(2023, 3, 1),
    )
    assert m.name == "Metformin"
    assert m.end_date is None  # active


def test_vital_sign_model_fields():
    """VitalSign stores a point-in-time reading."""
    from src.models.vital_sign import VitalSign
    v = VitalSign(
        patient_id=1,
        recorded_at=datetime(2025, 6, 1, 9, 0),
        systolic_bp=128,
        diastolic_bp=82,
        heart_rate=72,
    )
    assert v.systolic_bp == 128
    assert v.visit_id is None  # standalone
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_clinical_models.py -v
```
Expected: `ModuleNotFoundError: No module named 'src.models.allergy'`

- [ ] **Step 3: Create `src/models/allergy.py`**

```python
"""Allergy model — known patient allergies with clinical severity."""
from datetime import date

from sqlalchemy import Date, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Allergy(Base):
    """A known allergy for a patient."""
    __tablename__ = "allergies"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    allergen: Mapped[str] = mapped_column(String(200))
    reaction: Mapped[str] = mapped_column(String(200))
    severity: Mapped[str] = mapped_column(String(20))  # mild | moderate | severe
    recorded_at: Mapped[date] = mapped_column(Date)
```

- [ ] **Step 4: Create `src/models/medication.py`**

```python
"""Medication model — active and historical prescriptions."""
from datetime import date
from typing import Optional

from sqlalchemy import Date, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class Medication(Base):
    """A medication prescription for a patient."""
    __tablename__ = "medications"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    dosage: Mapped[str] = mapped_column(String(100))
    frequency: Mapped[str] = mapped_column(String(100))
    prescribed_by: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)  # NULL = active
```

- [ ] **Step 5: Create `src/models/vital_sign.py`**

```python
"""VitalSign model — point-in-time vitals, optionally tied to a visit."""
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class VitalSign(Base):
    """A set of vitals readings recorded at one point in time."""
    __tablename__ = "vital_signs"

    id: Mapped[int] = mapped_column(primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"), index=True)
    visit_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("visits.id"), nullable=True, index=True
    )
    recorded_at: Mapped[datetime] = mapped_column(DateTime)
    systolic_bp: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    diastolic_bp: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    heart_rate: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    temperature: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    respiratory_rate: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    oxygen_saturation: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    weight_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    height_cm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
pytest tests/test_clinical_models.py -v
```
Expected: 3 PASSED

- [ ] **Step 7: Commit**

```bash
git add src/models/allergy.py src/models/medication.py src/models/vital_sign.py tests/test_clinical_models.py
git commit -m "feat(models): add Allergy, Medication, VitalSign clinical models"
```

---

## Task 2: Update Patient Model + `__init__` Exports

**Files:**
- Modify: `src/models/patient.py`
- Modify: `src/models/__init__.py`

- [ ] **Step 1: Add dob type test to `tests/test_clinical_models.py`**

```python
# append to tests/test_clinical_models.py

def test_patient_dob_is_date_type():
    """Patient.dob must be a date object, not a string."""
    from src.models.patient import Patient
    from datetime import date
    p = Patient(name="Test", dob=date(1990, 1, 1), gender="female")
    assert isinstance(p.dob, date)
    assert str(p.dob) == "1990-01-01"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pytest tests/test_clinical_models.py::test_patient_dob_is_date_type -v
```
Expected: FAIL — `AssertionError` because `dob` is currently stored as `str`.

- [ ] **Step 3: Update `src/models/patient.py`**

Replace the entire file content:

```python
"""Patient model."""
from datetime import date, datetime
from typing import List, Optional

from pgvector.sqlalchemy import Vector
from sqlalchemy import Date, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Patient(Base):
    """Patient model for storing patient information."""
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    dob: Mapped[date] = mapped_column(Date)
    gender: Mapped[str] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    # AI-generated health summary
    health_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    health_summary_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    health_summary_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    health_summary_task_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    embedding: Mapped[Optional[List[float]]] = mapped_column(Vector(768), nullable=True)

    # Relationships
    records: Mapped[List["MedicalRecord"]] = relationship(
        back_populates="patient",
        cascade="all, delete-orphan",
    )
    imaging: Mapped[List["Imaging"]] = relationship(
        back_populates="patient",
        cascade="all, delete-orphan",
    )
    image_groups: Mapped[List["ImageGroup"]] = relationship(
        back_populates="patient",
        cascade="all, delete-orphan",
    )
    allergies: Mapped[List["Allergy"]] = relationship(
        back_populates="patient",
        cascade="all, delete-orphan",
    )
    medications: Mapped[List["Medication"]] = relationship(
        back_populates="patient",
        cascade="all, delete-orphan",
    )
    vital_signs: Mapped[List["VitalSign"]] = relationship(
        back_populates="patient",
        cascade="all, delete-orphan",
    )
```

- [ ] **Step 4: Add `patient` back-populate to each new model**

Add one line to each model file:

In `src/models/allergy.py`, add inside the class after the fields:
```python
    patient: Mapped["Patient"] = relationship(back_populates="allergies")
```

In `src/models/medication.py`, add inside the class after the fields:
```python
    patient: Mapped["Patient"] = relationship(back_populates="medications")
```

In `src/models/vital_sign.py`, add inside the class after the fields:
```python
    patient: Mapped["Patient"] = relationship(back_populates="vital_signs")
```

And add the import to each:
```python
from sqlalchemy.orm import Mapped, mapped_column, relationship
```

- [ ] **Step 5: Update `src/models/__init__.py`**

Add imports and exports for the three new models:

```python
# after: from .user import User, UserRole
from .allergy import Allergy
from .medication import Medication
from .vital_sign import VitalSign
```

And add to `__all__`:
```python
    "Allergy",
    "Medication",
    "VitalSign",
```

- [ ] **Step 6: Run tests**

```bash
pytest tests/test_clinical_models.py -v
```
Expected: 4 PASSED

- [ ] **Step 7: Commit**

```bash
git add src/models/patient.py src/models/allergy.py src/models/medication.py src/models/vital_sign.py src/models/__init__.py tests/test_clinical_models.py
git commit -m "feat(models): change Patient.dob to Date type, add clinical relationships"
```

---

## Task 3: Fix All `dob` Callers

**Files:**
- Modify: `src/forms/vault.py`
- Modify: `src/tools/check_patient_tool.py`
- Modify: `src/tools/register_patient_tool.py`
- Modify: `src/tools/compare_patient_tool.py`
- Modify: `src/api/routers/patients/core.py`
- Modify: `src/api/routers/visits.py`

**Background:** `Patient.dob` is now a `date` object. The API boundary (Pydantic models) keeps `dob: str` and accepts ISO format strings (`"YYYY-MM-DD"`). Conversion from string → `date` happens at the persistence layer (before DB queries or object creation). Conversion `date` → string happens in API responses (`.isoformat()`). Plain f-string display (`f"{patient.dob}"`) works automatically because `date.__str__()` returns `"1990-01-01"`.

- [ ] **Step 1: Fix `src/forms/vault.py`**

In `identify_patient`, change the lookup and creation to parse the dob string:

```python
# At top of file, add:
from datetime import date as _date

# In identify_patient(), change:
#   dob = answers["dob"].strip()
# to:
    dob_str = answers["dob"].strip()
    dob = _date.fromisoformat(dob_str)

# And change Patient creation:
#   patient = Patient(name=full_name, dob=dob, gender=gender)
# to (stays the same — dob is now a date object, correct):
    patient = Patient(name=full_name, dob=dob, gender=gender)
```

In `save_intake` (the `else` branch), apply the same:
```python
    dob_str = answers["dob"].strip()
    dob = _date.fromisoformat(dob_str)
    # Patient.dob == dob  ← now comparing date to date, correct
    patient = Patient(name=full_name, dob=dob, gender=gender)
```

Also fix line 111 where `patient.dob` is written into `dob_val` (used to populate `IntakeSubmission.dob` which is still `String`):
```python
# Before:
    dob_val = _get("dob") or (patient.dob if patient.dob else "")
# After:
    dob_val = _get("dob") or (patient.dob.isoformat() if patient.dob else "")
```

- [ ] **Step 2: Fix `src/tools/check_patient_tool.py`**

```python
# At top of file, add:
from datetime import date as _date

# In the function body, change:
#   dob = entry.data["dob"]
# to:
    dob = _date.fromisoformat(entry.data["dob"])
# The query .where(Patient.dob == dob) now compares date to date — no other change needed.
```

- [ ] **Step 3: Fix `src/tools/register_patient_tool.py`**

```python
# At top of file, add:
from datetime import date as _date

# Change:
#   dob = entry.data["dob"]
#   patient = Patient(name=full_name, dob=dob, ...)
# to:
    dob = _date.fromisoformat(entry.data["dob"])
    patient = Patient(name=full_name, dob=dob, ...)
```

- [ ] **Step 4: Fix `src/tools/compare_patient_tool.py`**

`patient.dob` is now a `date`; `entry.data['dob']` is still a string. Serialize for comparison:

```python
# Change line 58 from:
#   f"dob: {_cmp(entry.data['dob'], patient.dob)}",
# to:
    f"dob: {_cmp(entry.data['dob'], patient.dob.isoformat() if patient.dob else '')}",
```

- [ ] **Step 5: Fix `src/api/routers/patients/core.py`**

Two changes:

**a) Replace `ilike` search** — `Date` columns don't support `ilike`. Cast to string:
```python
# Add import at top:
from sqlalchemy import cast, or_, select, String as SAString

# Change:
#   Patient.dob.ilike(f"%{q}%"),
# to:
    cast(Patient.dob, SAString).ilike(f"%{q}%"),
```

**b) Serialize `dob` in all three response sites** — `PatientResponse.dob` is `str`, so call `.isoformat()`:

```python
# In create_patient():
#   dob=new_patient.dob,
# to:
    dob=new_patient.dob.isoformat(),

# In list_patients() and get_patient() wherever dob=p.dob or dob=patient.dob appears:
    dob=p.dob.isoformat(),
```

- [ ] **Step 6: Fix `src/api/routers/visits.py`**

`VisitDetailResponse.patient_dob` is `str`:
```python
# Change line 208:
#   patient_dob=patient.dob if patient else "",
# to:
    patient_dob=patient.dob.isoformat() if patient and patient.dob else "",
```

- [ ] **Step 7: Fix tests that construct Patient with string dob**

```bash
grep -rn 'dob="' tests/
```

For each occurrence (e.g. `dob="1990-01-01"`), change to use a `date` object:
```python
# Add at top of each affected test file:
from datetime import date

# Change each:
#   Patient(name="...", dob="1990-01-01", gender="...")
# to:
    Patient(name="...", dob=date(1990, 1, 1), gender="...")
```

Affected files (from grep output above):
- `tests/test_department_model.py`: `dob="1990-01-01"` → `dob=date(1990, 1, 1)`
- `tests/test_case_threads_api.py`: `dob="1980-01-01"` → `dob=date(1980, 1, 1)`
- `tests/test_visit_transfer.py`: four occurrences — `dob="1990-01-01"`, `dob="1985-05-15"`, `dob="1992-03-15"`, `dob="1985-07-20"`

- [ ] **Step 8: Run full test suite to verify no regressions**

```bash
pytest tests/ -v --tb=short 2>&1 | tail -30
```
Expected: all previously passing tests still pass.

- [ ] **Step 9: Commit**

```bash
git add src/forms/vault.py src/tools/check_patient_tool.py src/tools/register_patient_tool.py \
    src/tools/compare_patient_tool.py src/api/routers/patients/core.py src/api/routers/visits.py \
    tests/test_department_model.py tests/test_case_threads_api.py tests/test_visit_transfer.py
git commit -m "fix(dob): convert Patient.dob callers to use date type"
```

---

## Task 4: Update Migration

**Files:**
- Modify: `alembic/versions/001_init.py`

- [ ] **Step 1: Change `patients.dob` column type from `String(20)` to `Date`**

In the `upgrade()` function, find the `patients` table definition and change:
```python
# Before:
        sa.Column("dob", sa.String(20), nullable=False),
# After:
        sa.Column("dob", sa.Date(), nullable=False),
```

- [ ] **Step 2: Add three new tables to `upgrade()`**

Append after the `case_messages` table block (before the closing of `upgrade()`):

```python
    op.create_table(
        "allergies",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id"), nullable=False),
        sa.Column("allergen", sa.String(200), nullable=False),
        sa.Column("reaction", sa.String(200), nullable=False),
        sa.Column("severity", sa.String(20), nullable=False),
        sa.Column("recorded_at", sa.Date(), nullable=False),
    )
    op.create_index("ix_allergies_patient_id", "allergies", ["patient_id"])

    op.create_table(
        "medications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("dosage", sa.String(100), nullable=False),
        sa.Column("frequency", sa.String(100), nullable=False),
        sa.Column("prescribed_by", sa.String(200), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
    )
    op.create_index("ix_medications_patient_id", "medications", ["patient_id"])

    op.create_table(
        "vital_signs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("patient_id", sa.Integer(), sa.ForeignKey("patients.id"), nullable=False),
        sa.Column("visit_id", sa.Integer(), sa.ForeignKey("visits.id"), nullable=True),
        sa.Column("recorded_at", sa.DateTime(), nullable=False),
        sa.Column("systolic_bp", sa.Integer(), nullable=True),
        sa.Column("diastolic_bp", sa.Integer(), nullable=True),
        sa.Column("heart_rate", sa.Integer(), nullable=True),
        sa.Column("temperature", sa.Float(), nullable=True),
        sa.Column("respiratory_rate", sa.Integer(), nullable=True),
        sa.Column("oxygen_saturation", sa.Float(), nullable=True),
        sa.Column("weight_kg", sa.Float(), nullable=True),
        sa.Column("height_cm", sa.Float(), nullable=True),
    )
    op.create_index("ix_vital_signs_patient_id", "vital_signs", ["patient_id"])
    op.create_index("ix_vital_signs_visit_id", "vital_signs", ["visit_id"])
```

- [ ] **Step 3: Add drop statements to `downgrade()`**

Prepend before `op.drop_table("case_messages")`:
```python
    op.drop_index("ix_vital_signs_visit_id", table_name="vital_signs")
    op.drop_index("ix_vital_signs_patient_id", table_name="vital_signs")
    op.drop_table("vital_signs")
    op.drop_index("ix_medications_patient_id", table_name="medications")
    op.drop_table("medications")
    op.drop_index("ix_allergies_patient_id", table_name="allergies")
    op.drop_table("allergies")
```

- [ ] **Step 4: Verify Alembic can parse the migration**

```bash
python -m alembic heads
```
Expected: `001_init (head)` — no errors.

- [ ] **Step 5: Commit**

```bash
git add alembic/versions/001_init.py
git commit -m "feat(migration): add allergies/medications/vital_signs, fix dob to Date"
```

---

## Task 5: Consolidated Seed Script

**Files:**
- Create: `scripts/db/seed/seed.py`

- [ ] **Step 1: Create `scripts/db/seed/seed.py`**

```python
"""Consolidated idempotent seed — 10 patients with full clinical data.

Run:
    python -m scripts.db.seed.seed

Idempotent: safe to run multiple times. Skips patients that already exist
(matched by name + dob). Clears and re-seeds clinical data (allergies,
medications, vitals, records, visits) for existing patients on each run.
"""
import asyncio
import logging
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.base import AsyncSessionLocal
from src.models.patient import Patient
from src.models.medical_record import MedicalRecord
from src.models.allergy import Allergy
from src.models.medication import Medication
from src.models.vital_sign import VitalSign
from src.models.visit import Visit, VisitStatus
from src.models.chat import ChatSession

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Patient definitions
# ---------------------------------------------------------------------------

PATIENTS = [
    {
        "name": "Ava Thompson",
        "dob": date(1988, 3, 14),
        "gender": "female",
        "allergies": [
            {"allergen": "Sulfonamides", "reaction": "Rash", "severity": "moderate", "recorded_at": date(2015, 6, 10)},
            {"allergen": "Latex", "reaction": "Contact dermatitis", "severity": "mild", "recorded_at": date(2018, 2, 5)},
            {"allergen": "Tree nuts", "reaction": "Urticaria", "severity": "moderate", "recorded_at": date(2020, 9, 22)},
        ],
        "medications": [
            {"name": "Semaglutide (Ozempic)", "dosage": "1mg", "frequency": "weekly SC injection", "prescribed_by": "Dr. Chen", "start_date": date(2023, 1, 10)},
            {"name": "Metformin", "dosage": "1000mg", "frequency": "twice daily with meals", "prescribed_by": "Dr. Chen", "start_date": date(2020, 4, 1)},
            {"name": "Lisinopril", "dosage": "10mg", "frequency": "once daily", "prescribed_by": "Dr. Chen", "start_date": date(2021, 7, 15)},
            {"name": "Atorvastatin", "dosage": "20mg", "frequency": "once nightly", "prescribed_by": "Dr. Chen", "start_date": date(2021, 7, 15)},
            {"name": "Aspirin", "dosage": "81mg", "frequency": "once daily", "prescribed_by": "Dr. Chen", "start_date": date(2021, 7, 15)},
            {"name": "Glyburide", "dosage": "5mg", "frequency": "twice daily", "prescribed_by": "Dr. Lee", "start_date": date(2018, 3, 1), "end_date": date(2020, 3, 31)},
        ],
        "vitals": [
            {"days_ago": 180, "systolic_bp": 138, "diastolic_bp": 88, "heart_rate": 76, "temperature": 36.7, "oxygen_saturation": 98.0, "weight_kg": 84.2, "height_cm": 165.0},
            {"days_ago": 120, "systolic_bp": 132, "diastolic_bp": 85, "heart_rate": 74, "temperature": 36.8, "oxygen_saturation": 98.5, "weight_kg": 82.5},
            {"days_ago": 90, "systolic_bp": 128, "diastolic_bp": 82, "heart_rate": 72, "temperature": 36.6, "oxygen_saturation": 99.0, "weight_kg": 81.0},
            {"days_ago": 60, "systolic_bp": 125, "diastolic_bp": 80, "heart_rate": 70, "temperature": 36.7, "oxygen_saturation": 98.5, "weight_kg": 79.8},
            {"days_ago": 30, "systolic_bp": 122, "diastolic_bp": 78, "heart_rate": 68, "temperature": 36.6, "oxygen_saturation": 99.0, "weight_kg": 78.4},
        ],
        "records": [
            {
                "record_type": "text",
                "summary": "Type 2 DM follow-up — GLP-1 initiation",
                "content": """S: Ava Thompson presents for 3-month T2DM follow-up. Reports improved satiety since starting semaglutide. No hypoglycaemic episodes. Occasional nausea post-injection.
O: Weight 82.5kg (down 4.2kg from baseline). BP 128/82. HbA1c 7.1% (prev 8.4%). FPG 6.8 mmol/L. eGFR 78. ALT normal.
A: T2DM with good glycaemic response to GLP-1. Hypertension well-controlled. Weight trending down.
P: Continue semaglutide 1mg weekly. Increase to 2mg at next visit if tolerated. Metformin continue 1g BD. Lisinopril 10mg OD. Repeat HbA1c in 3 months. Lifestyle counselling reinforced.""",
                "created_at_offset_days": 90,
            },
            {
                "record_type": "text",
                "summary": "Annual diabetic review",
                "content": """S: Annual review. Ava reports compliance with medications. Exercises 3x/week. No chest pain, SOB, or leg swelling. No visual changes.
O: BP 125/80. Weight 79.8kg. Peripheral pulses intact. Monofilament sensation intact bilaterally. Fundoscopy: no retinopathy. Urine ACR 2.1 mg/mmol (normal).
A: T2DM well-controlled. No micro/macrovascular complications identified.
P: Continue current regimen. Fasting lipids, HbA1c, U&E in 3 months. Annual diabetic eye screen completed. Flu vaccine administered.""",
                "created_at_offset_days": 30,
            },
        ],
        "visit": {
            "status": VisitStatus.COMPLETED,
            "chief_complaint": "Routine diabetic review and medication adjustment",
            "urgency_level": "routine",
            "current_department": "Endocrinology",
            "assigned_doctor": "Dr. Chen",
            "clinical_notes": "Annual DM review. HbA1c improved to 7.1%. GLP-1 well tolerated. No complications.",
            "confidence": 0.95,
        },
    },
    {
        "name": "Mateo Alvarez",
        "dob": date(1975, 7, 22),
        "gender": "male",
        "allergies": [
            {"allergen": "ACE inhibitors (cough)", "reaction": "Persistent dry cough", "severity": "moderate", "recorded_at": date(2019, 3, 12)},
            {"allergen": "Ibuprofen", "reaction": "Gastric irritation", "severity": "mild", "recorded_at": date(2016, 8, 3)},
            {"allergen": "Codeine", "reaction": "Nausea and vomiting", "severity": "moderate", "recorded_at": date(2011, 1, 20)},
            {"allergen": "Penicillin", "reaction": "Urticaria", "severity": "moderate", "recorded_at": date(2005, 5, 14)},
        ],
        "medications": [
            {"name": "Amlodipine", "dosage": "10mg", "frequency": "once daily", "prescribed_by": "Dr. Patel", "start_date": date(2019, 4, 1)},
            {"name": "Losartan", "dosage": "50mg", "frequency": "once daily", "prescribed_by": "Dr. Patel", "start_date": date(2019, 4, 1)},
            {"name": "Rosuvastatin", "dosage": "20mg", "frequency": "once nightly", "prescribed_by": "Dr. Patel", "start_date": date(2020, 2, 15)},
            {"name": "Aspirin", "dosage": "100mg", "frequency": "once daily", "prescribed_by": "Dr. Patel", "start_date": date(2020, 2, 15)},
            {"name": "Hydrochlorothiazide", "dosage": "12.5mg", "frequency": "once daily", "prescribed_by": "Dr. Patel", "start_date": date(2021, 9, 1)},
            {"name": "Atenolol", "dosage": "50mg", "frequency": "once daily", "prescribed_by": "Dr. Jones", "start_date": date(2016, 1, 1), "end_date": date(2019, 3, 31)},
        ],
        "vitals": [
            {"days_ago": 150, "systolic_bp": 158, "diastolic_bp": 98, "heart_rate": 82, "temperature": 36.5, "weight_kg": 94.0, "height_cm": 178.0},
            {"days_ago": 90, "systolic_bp": 148, "diastolic_bp": 92, "heart_rate": 78, "temperature": 36.6, "weight_kg": 93.2},
            {"days_ago": 60, "systolic_bp": 142, "diastolic_bp": 88, "heart_rate": 76, "temperature": 36.4, "weight_kg": 92.8},
            {"days_ago": 30, "systolic_bp": 138, "diastolic_bp": 86, "heart_rate": 74, "temperature": 36.5, "weight_kg": 92.1},
            {"days_ago": 7, "systolic_bp": 135, "diastolic_bp": 84, "heart_rate": 72, "temperature": 36.6, "weight_kg": 91.5},
        ],
        "records": [
            {
                "record_type": "text",
                "summary": "Hypertension + hyperlipidaemia review",
                "content": """S: Mateo Alvarez, 50M, presenting for BP review. On amlodipine 10mg + losartan 50mg + HCTZ 12.5mg. Reports occasional headaches in the morning. No chest pain, SOB, or visual disturbance. ACE inhibitor trial abandoned 2019 due to cough.
O: BP 138/86 (right arm). HR 74 regular. BMI 29.1. Fundoscopy: mild AV nipping, no papilloedema. ECG: LVH by voltage criteria.
A: Stage 2 hypertension — improving but not at target (<130/80). Hyperlipidaemia: LDL 2.8 mmol/L on rosuvastatin 20mg.
P: Uptitrate losartan to 100mg. Continue amlodipine + HCTZ. Recheck BP in 6 weeks. Dietary sodium restriction counselled. Fasting lipid panel in 3 months.""",
                "created_at_offset_days": 30,
            },
            {
                "record_type": "text",
                "summary": "Cardiovascular risk assessment",
                "content": """S: Annual cardiovascular review. No symptoms of IHD. Non-smoker. Moderate alcohol (10 units/week).
O: BP 142/88. Total cholesterol 5.2, LDL 2.8, HDL 1.1, TG 2.4. eGFR 72. Urine ACR 8 mg/mmol (borderline). BMI 29.1.
A: 10-year CVD risk 18% (QRISK3). Hypertension not at target. Mild CKD precursor pattern.
P: Intensify antihypertensive. Target BP <130/80. DASH diet. Reduce alcohol. Repeat ACR in 6 months.""",
                "created_at_offset_days": 60,
            },
        ],
        "visit": {
            "status": VisitStatus.AUTO_ROUTED,
            "chief_complaint": "Morning headaches and elevated home BP readings",
            "urgency_level": "routine",
            "routing_suggestion": [{"department": "Cardiology", "confidence": 0.88}],
            "confidence": 0.88,
        },
    },
    {
        "name": "Eleanor Price",
        "dob": date(1954, 11, 5),
        "gender": "female",
        "allergies": [
            {"allergen": "Taxanes (paclitaxel)", "reaction": "Hypersensitivity reaction", "severity": "severe", "recorded_at": date(2014, 3, 8)},
            {"allergen": "Morphine", "reaction": "Confusion and hallucinations", "severity": "severe", "recorded_at": date(2015, 1, 12)},
            {"allergen": "Contrast dye (iodinated)", "reaction": "Urticaria", "severity": "moderate", "recorded_at": date(2013, 11, 5)},
            {"allergen": "Aspirin", "reaction": "Bronchospasm", "severity": "severe", "recorded_at": date(2008, 2, 14)},
            {"allergen": "NSAIDs", "reaction": "Bronchospasm", "severity": "severe", "recorded_at": date(2008, 2, 14)},
        ],
        "medications": [
            {"name": "Anastrozole", "dosage": "1mg", "frequency": "once daily", "prescribed_by": "Dr. Wong", "start_date": date(2016, 9, 1)},
            {"name": "Calcium carbonate + Vitamin D3", "dosage": "1250mg / 400IU", "frequency": "twice daily", "prescribed_by": "Dr. Wong", "start_date": date(2016, 9, 1)},
            {"name": "Gabapentin", "dosage": "300mg", "frequency": "three times daily", "prescribed_by": "Dr. Wong", "start_date": date(2018, 4, 20)},
            {"name": "Duloxetine", "dosage": "60mg", "frequency": "once daily", "prescribed_by": "Dr. Wong", "start_date": date(2019, 7, 5)},
            {"name": "Tamoxifen", "dosage": "20mg", "frequency": "once daily", "prescribed_by": "Dr. Singh", "start_date": date(2014, 6, 1), "end_date": date(2016, 5, 31)},
        ],
        "vitals": [
            {"days_ago": 180, "systolic_bp": 124, "diastolic_bp": 78, "heart_rate": 68, "temperature": 36.4, "weight_kg": 62.0, "height_cm": 162.0, "oxygen_saturation": 97.5},
            {"days_ago": 120, "systolic_bp": 126, "diastolic_bp": 80, "heart_rate": 70, "temperature": 36.5, "weight_kg": 61.5},
            {"days_ago": 90, "systolic_bp": 122, "diastolic_bp": 76, "heart_rate": 66, "temperature": 36.3, "weight_kg": 61.8},
            {"days_ago": 60, "systolic_bp": 120, "diastolic_bp": 75, "heart_rate": 64, "temperature": 36.4, "weight_kg": 61.2},
            {"days_ago": 14, "systolic_bp": 118, "diastolic_bp": 74, "heart_rate": 65, "temperature": 36.4, "weight_kg": 61.0},
        ],
        "records": [
            {
                "record_type": "text",
                "summary": "Post-breast cancer surveillance — 10 year review",
                "content": """S: Eleanor Price, 71F, breast cancer survivor (ER+PR+ IDC, right breast, 2014). Mastectomy + sentinel node biopsy (node negative). Completed adjuvant chemotherapy (FEC-T) and radiotherapy. On anastrozole 1mg OD (year 10). Reports bilateral hand/foot tingling (neuropathy) and night sweats.
O: BP 120/75. Weight 61.2kg. ECOG PS 1. No palpable nodes. Chest: clear. Abdomen: soft. Bilateral stocking paraesthesia to mid-shin (Grade 1 peripheral neuropathy). Bone density (DEXA 2023): T-score -2.1 lumbar spine (osteopenia).
A: Breast cancer in sustained remission. Peripheral neuropathy — likely chemotherapy-induced. Anastrozole-related bone loss; on calcium + Vit D supplementation.
P: Continue anastrozole to complete 10-year course (until Sep 2026). Maintain gabapentin 300mg TDS for neuropathy. Annual mammogram + breast MRI. Rheumatology referral for osteopenia management.""",
                "created_at_offset_days": 60,
            },
            {
                "record_type": "text",
                "summary": "Neuropathy and mood review",
                "content": """S: Follow-up for chemotherapy-induced peripheral neuropathy. Reports tingling worse in cold weather. Also notes low mood, sleep disturbance since bereavement (husband, 8 months ago). On duloxetine 60mg OD — partial improvement.
O: BP 118/74. Affect subdued but appropriate. PHQ-9 score 11 (moderate depression). Bilateral stocking paraesthesia unchanged. Reflexes: diminished ankle jerks bilaterally.
A: CIPN stable. Moderate depression on background of bereavement. Duloxetine provides dual benefit (neuropathy + mood).
P: Uptitrate duloxetine to 90mg if tolerated. Refer to psychology/grief counselling. Safety net: emergency contact arranged.""",
                "created_at_offset_days": 14,
            },
        ],
        "visit": {
            "status": VisitStatus.TRIAGED,
            "chief_complaint": "Worsening peripheral tingling and low mood",
            "urgency_level": "routine",
        },
    },
    {
        "name": "Clara Nguyen",
        "dob": date(1990, 1, 30),
        "gender": "female",
        "allergies": [
            {"allergen": "Penicillin", "reaction": "Anaphylaxis", "severity": "severe", "recorded_at": date(2012, 5, 19)},
            {"allergen": "Shellfish", "reaction": "Urticaria and angioedema", "severity": "severe", "recorded_at": date(2009, 8, 7)},
            {"allergen": "Aspirin", "reaction": "Exacerbation of asthma", "severity": "severe", "recorded_at": date(2014, 10, 3)},
        ],
        "medications": [
            {"name": "Fluticasone/Salmeterol (Seretide 250/25)", "dosage": "250/25mcg", "frequency": "2 puffs twice daily", "prescribed_by": "Dr. Okafor", "start_date": date(2016, 3, 15)},
            {"name": "Salbutamol MDI", "dosage": "100mcg/puff", "frequency": "2 puffs PRN", "prescribed_by": "Dr. Okafor", "start_date": date(2014, 1, 10)},
            {"name": "Montelukast", "dosage": "10mg", "frequency": "once nightly", "prescribed_by": "Dr. Okafor", "start_date": date(2018, 9, 1)},
            {"name": "Cetirizine", "dosage": "10mg", "frequency": "once daily (seasonal)", "prescribed_by": "Dr. Okafor", "start_date": date(2016, 3, 15)},
            {"name": "Theophylline", "dosage": "200mg SR", "frequency": "twice daily", "prescribed_by": "Dr. Kim", "start_date": date(2014, 2, 1), "end_date": date(2016, 2, 28)},
        ],
        "vitals": [
            {"days_ago": 180, "systolic_bp": 110, "diastolic_bp": 70, "heart_rate": 78, "temperature": 36.8, "respiratory_rate": 16, "oxygen_saturation": 97.0, "weight_kg": 58.5, "height_cm": 158.0},
            {"days_ago": 90, "systolic_bp": 108, "diastolic_bp": 68, "heart_rate": 82, "temperature": 37.1, "respiratory_rate": 20, "oxygen_saturation": 95.0, "weight_kg": 58.2},
            {"days_ago": 60, "systolic_bp": 112, "diastolic_bp": 72, "heart_rate": 76, "temperature": 36.7, "respiratory_rate": 14, "oxygen_saturation": 98.5, "weight_kg": 58.0},
            {"days_ago": 30, "systolic_bp": 110, "diastolic_bp": 70, "heart_rate": 74, "temperature": 36.6, "respiratory_rate": 14, "oxygen_saturation": 99.0, "weight_kg": 57.8},
            {"days_ago": 5, "systolic_bp": 106, "diastolic_bp": 68, "heart_rate": 90, "temperature": 37.2, "respiratory_rate": 22, "oxygen_saturation": 94.5, "weight_kg": 58.1},
        ],
        "records": [
            {
                "record_type": "text",
                "summary": "Asthma exacerbation — moderate severity",
                "content": """S: Clara Nguyen, 35F, known moderate persistent asthma. Presenting with 3-day history of increased wheeze, cough, and dyspnoea. No fever. Salbutamol use increased to 8 puffs/day (baseline 1-2 PRN). No URTI. Pollen count high this week.
O: RR 22. O2 Sat 94.5% on air. PEFR 58% predicted. Widespread expiratory wheeze bilaterally. HR 90. Temperature 37.2. No cyanosis.
A: Moderate acute asthma exacerbation (PEFR 50-75% predicted). Likely allergen-triggered.
P: Salbutamol 2.5mg nebulised q20min x3. Ipratropium 500mcg nebulised. Prednisolone 40mg PO stat. Repeat PEFR after 1 hour. If PEFR >75% → discharge with 5-day prednisolone course. Advise trigger avoidance during high pollen season.""",
                "created_at_offset_days": 5,
            },
            {
                "record_type": "text",
                "summary": "Asthma annual review — step-up therapy",
                "content": """S: Annual asthma review. Reports well-controlled for most of year. Two exacerbations requiring oral steroids (spring, autumn). No hospital admissions. Good inhaler technique confirmed. Uses salbutamol 2-4x/week — above threshold for poor control.
O: PEFR 82% predicted. Spirometry: FEV1/FVC 0.74 (mild obstruction), post-bronchodilator improvement 14%. Sputum eosinophils elevated on blood: Eos 0.45 x10⁹/L.
A: Moderate persistent asthma — partially controlled on ICS/LABA. Consider biologics if further exacerbations.
P: Add montelukast 10mg ON. Allergen avoidance advice. Written asthma action plan updated. Refer to respiratory if two further exacerbations this year.""",
                "created_at_offset_days": 90,
            },
        ],
        "visit": {
            "status": VisitStatus.ROUTED,
            "chief_complaint": "Acute wheeze and dyspnoea — asthma exacerbation",
            "urgency_level": "urgent",
            "current_department": "Respiratory",
            "assigned_doctor": "Dr. Okafor",
            "confidence": 0.91,
        },
    },
    {
        "name": "Harold Washington",
        "dob": date(1958, 9, 18),
        "gender": "male",
        "allergies": [
            {"allergen": "Amiodarone", "reaction": "Pulmonary toxicity", "severity": "severe", "recorded_at": date(2016, 4, 14)},
            {"allergen": "Warfarin", "reaction": "Uncontrolled bleeding (INR >8)", "severity": "severe", "recorded_at": date(2018, 11, 30)},
            {"allergen": "Clarithromycin", "reaction": "QT prolongation", "severity": "severe", "recorded_at": date(2019, 2, 8)},
        ],
        "medications": [
            {"name": "Apixaban", "dosage": "5mg", "frequency": "twice daily", "prescribed_by": "Dr. Santos", "start_date": date(2019, 1, 10)},
            {"name": "Tiotropium (Spiriva)", "dosage": "18mcg", "frequency": "once daily via HandiHaler", "prescribed_by": "Dr. Santos", "start_date": date(2015, 6, 20)},
            {"name": "Salmeterol/Fluticasone (Advair 500/50)", "dosage": "500/50mcg", "frequency": "2 puffs twice daily", "prescribed_by": "Dr. Santos", "start_date": date(2017, 3, 5)},
            {"name": "Bisoprolol", "dosage": "5mg", "frequency": "once daily", "prescribed_by": "Dr. Santos", "start_date": date(2016, 8, 1)},
            {"name": "Tamsulosin", "dosage": "0.4mg", "frequency": "once daily at night", "prescribed_by": "Dr. Santos", "start_date": date(2020, 11, 15)},
            {"name": "Amiodarone", "dosage": "200mg", "frequency": "once daily", "prescribed_by": "Dr. Lee", "start_date": date(2014, 5, 1), "end_date": date(2016, 4, 14)},
        ],
        "vitals": [
            {"days_ago": 180, "systolic_bp": 132, "diastolic_bp": 82, "heart_rate": 88, "temperature": 36.6, "respiratory_rate": 18, "oxygen_saturation": 93.0, "weight_kg": 88.0, "height_cm": 182.0},
            {"days_ago": 120, "systolic_bp": 128, "diastolic_bp": 80, "heart_rate": 84, "respiratory_rate": 20, "oxygen_saturation": 92.5, "weight_kg": 89.5},
            {"days_ago": 60, "systolic_bp": 130, "diastolic_bp": 82, "heart_rate": 86, "respiratory_rate": 19, "oxygen_saturation": 92.0, "weight_kg": 91.0},
            {"days_ago": 30, "systolic_bp": 136, "diastolic_bp": 86, "heart_rate": 92, "respiratory_rate": 22, "oxygen_saturation": 90.5, "weight_kg": 93.5},
            {"days_ago": 2, "systolic_bp": 145, "diastolic_bp": 90, "heart_rate": 102, "temperature": 37.0, "respiratory_rate": 24, "oxygen_saturation": 88.5, "weight_kg": 95.0},
        ],
        "records": [
            {
                "record_type": "text",
                "summary": "COPD + AFib exacerbation — inpatient admission",
                "content": """S: Harold Washington, 66M. Presenting with 4-day worsening dyspnoea, increased sputum (yellow-green), and bilateral ankle oedema. Background: GOLD Stage III COPD, permanent AFib, BPH. Apixaban for stroke prevention. Prior amiodarone toxicity (stopped 2016).
O: SpO2 88.5% on air. RR 24. HR 102 (irregularly irregular). BP 145/90. JVP elevated 4cm. Bilateral pitting oedema to knees. Bibasal crackles and expiratory wheeze. CXR: hyperinflated, perihilar haziness. ABG: pH 7.34, pCO2 52mmHg, pO2 58mmHg, HCO3 27 (type 2 RF).
A: Acute exacerbation of COPD with infective trigger. Concomitant fluid overload (right heart failure). AFib rate suboptimally controlled.
P: Controlled O2 24-28%. Salbutamol + ipratropium nebs. IV furosemide 40mg. Doxycycline 200mg loading. Rate control: uptitrate bisoprolol. NIV if pH worsens. Admit under Respiratory/Cardiology.""",
                "created_at_offset_days": 2,
            },
            {
                "record_type": "text",
                "summary": "COPD annual review — disease progression",
                "content": """S: Annual COPD review. Reports increased exertional dyspnoea (MRC grade 3 — limited to slow walking). Two exacerbations in last year (one hospitalisation). Ceased smoking 2012 (40 pack-year history). MMRC 3.
O: SpO2 92% on air. FEV1 38% predicted (GOLD Stage III). FEV1/FVC 0.52. 6MWT 290m.
A: GOLD Stage III COPD — severe, poorly controlled. Candidate for pulmonary rehabilitation.
P: Refer pulmonary rehab. Flu + pneumococcal vaccine. Long-term O2 assessment: ambulatory O2 trial. Consider referral to thoracic surgery for emphysema assessment.""",
                "created_at_offset_days": 60,
            },
        ],
        "visit": {
            "status": VisitStatus.IN_DEPARTMENT,
            "chief_complaint": "Worsening dyspnoea, increased sputum, bilateral leg swelling",
            "urgency_level": "urgent",
            "current_department": "Respiratory",
            "assigned_doctor": "Dr. Santos",
            "confidence": 0.93,
        },
    },
    {
        "name": "James Okafor",
        "dob": date(1970, 4, 2),
        "gender": "male",
        "allergies": [
            {"allergen": "Contrast dye (iodinated)", "reaction": "Acute kidney injury", "severity": "severe", "recorded_at": date(2019, 7, 22)},
            {"allergen": "Metformin (relative)", "reaction": "Lactic acidosis risk with eGFR <30", "severity": "moderate", "recorded_at": date(2021, 3, 10)},
            {"allergen": "Diclofenac", "reaction": "Acute on chronic renal impairment", "severity": "severe", "recorded_at": date(2020, 9, 5)},
        ],
        "medications": [
            {"name": "Insulin glargine (Lantus)", "dosage": "28 units", "frequency": "once nightly SC", "prescribed_by": "Dr. Kim", "start_date": date(2021, 6, 1)},
            {"name": "Insulin aspart (NovoRapid)", "dosage": "8-12 units", "frequency": "three times daily with meals", "prescribed_by": "Dr. Kim", "start_date": date(2021, 6, 1)},
            {"name": "Lisinopril", "dosage": "20mg", "frequency": "once daily", "prescribed_by": "Dr. Kim", "start_date": date(2018, 1, 15)},
            {"name": "Furosemide", "dosage": "40mg", "frequency": "once daily", "prescribed_by": "Dr. Kim", "start_date": date(2022, 4, 10)},
            {"name": "Erythropoietin (EPO)", "dosage": "4000IU", "frequency": "weekly SC", "prescribed_by": "Dr. Kim", "start_date": date(2023, 2, 1)},
            {"name": "Metformin", "dosage": "500mg", "frequency": "twice daily", "prescribed_by": "Dr. Patel", "start_date": date(2015, 3, 1), "end_date": date(2021, 5, 31)},
        ],
        "vitals": [
            {"days_ago": 180, "systolic_bp": 148, "diastolic_bp": 92, "heart_rate": 80, "temperature": 36.5, "weight_kg": 96.0, "height_cm": 176.0, "oxygen_saturation": 97.0},
            {"days_ago": 120, "systolic_bp": 152, "diastolic_bp": 94, "heart_rate": 82, "weight_kg": 97.5},
            {"days_ago": 60, "systolic_bp": 146, "diastolic_bp": 90, "heart_rate": 78, "weight_kg": 98.2},
            {"days_ago": 30, "systolic_bp": 144, "diastolic_bp": 88, "heart_rate": 76, "temperature": 36.9, "weight_kg": 99.0},
            {"days_ago": 7, "systolic_bp": 158, "diastolic_bp": 96, "heart_rate": 84, "temperature": 37.5, "weight_kg": 101.5, "oxygen_saturation": 96.5},
        ],
        "records": [
            {
                "record_type": "text",
                "summary": "Diabetic foot ulcer — right great toe",
                "content": """S: James Okafor, 55M, T2DM on insulin + CKD Stage 3b. Presenting with 2-week non-healing wound right great toe. Noticed it while trimming nails. No pain (reduced sensation). Fever today 37.5. Weight up 2.5kg in one week.
O: Temp 37.5. BP 158/96. RR 16. SpO2 96.5%. Right great toe: 2cm x 1.5cm punched-out ulcer, depth 3mm, no exposed bone. Wound base: sloughy. Surrounding erythema 2cm radius. Pedal pulses diminished bilaterally. ABI right 0.72. Monofilament: absent plantar sensation bilaterally. WBC 14.2, CRP 68, HbA1c 10.2%, eGFR 28 (worsened from 38).
A: Wagner Grade 2 diabetic foot ulcer with cellulitis. T2DM poorly controlled. CKD Stage 3b→4 trajectory. Risk of osteomyelitis.
P: Admit under vascular surgery + diabetic foot team. IV antibiotics (vancomycin + piperacillin-tazobactam — renal dose adjusted). Wound debridement. MRI foot to exclude osteomyelitis. Nephrology review re CKD progression. Optimise insulin regimen.""",
                "created_at_offset_days": 7,
            },
            {
                "record_type": "text",
                "summary": "CKD Stage 3 review — renal function trajectory",
                "content": """S: CKD review. Background T2DM x15 years, HTN. eGFR trend: 52 (2018) → 45 (2020) → 38 (2022) → 28 (present). Reports fatigue, ankle swelling. No haematuria. On EPO for normochromic anaemia (Hb 98 g/L).
O: BP 152/94. Pitting oedema ankles +2. Pallor. Urine ACR 185 mg/mmol. Renal USS: bilateral kidneys 9.5cm, increased echogenicity.
A: CKD Stage 3b progressing toward Stage 4. Diabetic nephropathy likely aetiology. Anaemia of CKD on EPO.
P: Strict BP control target <130/80. Metformin ceased (eGFR <30). Maximise ACE inhibitor. Nephrology co-management. Prepare for renal replacement therapy counselling if eGFR <20.""",
                "created_at_offset_days": 30,
            },
        ],
        "visits": [
            {
                "status": VisitStatus.PENDING_REVIEW,
                "chief_complaint": "Non-healing foot wound and fever",
                "urgency_level": "urgent",
                "confidence": 0.62,
                "routing_suggestion": [
                    {"department": "Vascular Surgery", "confidence": 0.62},
                    {"department": "Endocrinology", "confidence": 0.55},
                ],
            },
            {
                "status": VisitStatus.INTAKE,
                "chief_complaint": "Follow-up for CKD and insulin adjustment",
                "urgency_level": "routine",
            },
        ],
    },
    {
        "name": "Rebecca Chen",
        "dob": date(1995, 6, 11),
        "gender": "female",
        "allergies": [
            {"allergen": "Benzodiazepines", "reaction": "Paradoxical agitation", "severity": "moderate", "recorded_at": date(2022, 1, 30)},
            {"allergen": "Fluoxetine", "reaction": "Serotonin syndrome symptoms", "severity": "moderate", "recorded_at": date(2021, 8, 15)},
        ],
        "medications": [
            {"name": "Sertraline", "dosage": "100mg", "frequency": "once daily", "prescribed_by": "Dr. Pham", "start_date": date(2021, 10, 1)},
            {"name": "Propranolol", "dosage": "10mg", "frequency": "PRN for performance anxiety", "prescribed_by": "Dr. Pham", "start_date": date(2022, 3, 15)},
            {"name": "Vitamin D3", "dosage": "1000IU", "frequency": "once daily", "prescribed_by": "Dr. Pham", "start_date": date(2022, 1, 1)},
            {"name": "Fluoxetine", "dosage": "20mg", "frequency": "once daily", "prescribed_by": "Dr. Lee", "start_date": date(2021, 5, 1), "end_date": date(2021, 8, 15)},
        ],
        "vitals": [
            {"days_ago": 180, "systolic_bp": 106, "diastolic_bp": 68, "heart_rate": 88, "temperature": 36.6, "weight_kg": 54.0, "height_cm": 162.0},
            {"days_ago": 90, "systolic_bp": 110, "diastolic_bp": 70, "heart_rate": 86, "weight_kg": 53.5},
            {"days_ago": 60, "systolic_bp": 108, "diastolic_bp": 70, "heart_rate": 92, "temperature": 36.5, "weight_kg": 52.8},
            {"days_ago": 14, "systolic_bp": 116, "diastolic_bp": 74, "heart_rate": 102, "temperature": 36.7, "weight_kg": 52.5},
            {"days_ago": 1, "systolic_bp": 118, "diastolic_bp": 76, "heart_rate": 108, "temperature": 36.6, "weight_kg": 52.3},
        ],
        "records": [
            {
                "record_type": "text",
                "summary": "GAD — panic attack presentation to ED",
                "content": """S: Rebecca Chen, 30F, GAD on sertraline 100mg. Brought in by partner after acute onset palpitations, chest tightness, trembling, derealization, and fear of dying. Duration 20 minutes. No prior cardiac history. No recreational drugs. Reports high work stress (final exams for law degree).
O: HR 108 at presentation (sinus tachycardia on ECG). BP 118/76. SpO2 99%. RR 20. ECG: no ischaemic changes. Troponin negative. FBC, U&E, TFTs, glucose: all normal. BDZ avoided (paradoxical reaction documented).
A: Panic attack — most likely diagnosis. No organic cause identified. Background GAD with psychosocial stressor.
P: Reassurance + psychoeducation. Grounding techniques demonstrated. Discharge with GP follow-up in 48h. Refer to CBT. Review sertraline dose with psychiatry. Safety net: return if symptoms recur or change character.""",
                "created_at_offset_days": 1,
            },
            {
                "record_type": "text",
                "summary": "GAD 6-month review — medication response",
                "content": """S: 6-month GAD review. Reports significant improvement on sertraline 100mg. Work stress reduced post-exams. Occasional breakthrough anxiety. No suicidal ideation. Sleep improved. PHQ-7: 8 (mild-moderate anxiety, down from 18 at baseline).
O: BP 110/70. Affect appropriate. No tremor. No EPSE.
A: GAD — good partial response to sertraline. Residual symptoms manageable.
P: Continue sertraline 100mg. CBT referral pending — expedite. Mindfulness app recommended. Review in 6 months or sooner if relapse.""",
                "created_at_offset_days": 60,
            },
        ],
        "visit": {
            "status": VisitStatus.COMPLETED,
            "chief_complaint": "Acute palpitations, chest tightness, fear of dying",
            "urgency_level": "urgent",
            "current_department": "Emergency",
            "assigned_doctor": "Dr. Pham",
            "clinical_notes": "Panic attack — organic causes excluded. Discharged with GP follow-up.",
            "confidence": 0.89,
        },
    },
    {
        "name": "Walter Kim",
        "dob": date(1948, 12, 29),
        "gender": "male",
        "allergies": [
            {"allergen": "Iodine", "reaction": "Contact dermatitis", "severity": "mild", "recorded_at": date(2010, 3, 5)},
            {"allergen": "ACE inhibitors", "reaction": "Angioedema", "severity": "severe", "recorded_at": date(2013, 6, 22)},
            {"allergen": "Metoclopramide", "reaction": "Extrapyramidal symptoms", "severity": "moderate", "recorded_at": date(2017, 9, 14)},
        ],
        "medications": [
            {"name": "Sacubitril/Valsartan (Entresto)", "dosage": "97/103mg", "frequency": "twice daily", "prescribed_by": "Dr. Anderson", "start_date": date(2020, 5, 1)},
            {"name": "Carvedilol", "dosage": "25mg", "frequency": "twice daily", "prescribed_by": "Dr. Anderson", "start_date": date(2018, 11, 10)},
            {"name": "Furosemide", "dosage": "80mg", "frequency": "once daily", "prescribed_by": "Dr. Anderson", "start_date": date(2018, 11, 10)},
            {"name": "Spironolactone", "dosage": "25mg", "frequency": "once daily", "prescribed_by": "Dr. Anderson", "start_date": date(2019, 3, 20)},
            {"name": "Apixaban", "dosage": "2.5mg", "frequency": "twice daily (renal-dose adjusted)", "prescribed_by": "Dr. Anderson", "start_date": date(2018, 11, 10)},
            {"name": "Atorvastatin", "dosage": "40mg", "frequency": "once nightly", "prescribed_by": "Dr. Anderson", "start_date": date(2018, 11, 10)},
        ],
        "vitals": [
            {"days_ago": 180, "systolic_bp": 118, "diastolic_bp": 72, "heart_rate": 58, "temperature": 36.3, "respiratory_rate": 16, "oxygen_saturation": 95.5, "weight_kg": 78.0, "height_cm": 170.0},
            {"days_ago": 120, "systolic_bp": 120, "diastolic_bp": 74, "heart_rate": 60, "respiratory_rate": 18, "oxygen_saturation": 95.0, "weight_kg": 79.5},
            {"days_ago": 60, "systolic_bp": 116, "diastolic_bp": 70, "heart_rate": 56, "respiratory_rate": 20, "oxygen_saturation": 94.5, "weight_kg": 81.0},
            {"days_ago": 14, "systolic_bp": 112, "diastolic_bp": 68, "heart_rate": 54, "respiratory_rate": 22, "oxygen_saturation": 94.0, "weight_kg": 83.0},
            {"days_ago": 1, "systolic_bp": 108, "diastolic_bp": 65, "heart_rate": 52, "temperature": 36.2, "respiratory_rate": 24, "oxygen_saturation": 92.5, "weight_kg": 85.5},
        ],
        "records": [
            {
                "record_type": "text",
                "summary": "HFrEF decompensation — weight gain + worsening dyspnoea",
                "content": """S: Walter Kim, 77M, HFrEF (LVEF 28%, ischaemic cardiomyopathy). Pacemaker in situ (DDD, 2015). Presenting with 2-week progressive dyspnoea at rest, orthopnoea (3-pillow), 7.5kg weight gain, bilateral leg swelling. Current meds: sacubitril/valsartan, carvedilol, furosemide 80mg, spironolactone, apixaban.
O: HR 52 (paced). BP 108/65. JVP elevated 8cm. SpO2 92.5% on air. RR 24. Bilateral fine crackles to mid-zones. Severe pitting oedema to mid-thigh. CXR: cardiomegaly, bilateral pleural effusions, Kerley B lines. Echo (today): LVEF 22% (worsened), severe MR.
A: Acute decompensated HFrEF. Precipitant: likely worsening MR. Pacemaker: interrogation normal, DDD pacing 95%.
P: IV furosemide 80mg bolus then infusion. Strict fluid restriction 1.5L/day. Daily weight. Cardiology urgent review. Pacemaker optimisation. Consider MR intervention (TAVI/MitraClip referral). ICU alert if SpO2 worsens.""",
                "created_at_offset_days": 1,
            },
            {
                "record_type": "text",
                "summary": "Pacemaker clinic — device check",
                "content": """S: Routine pacemaker clinic. No symptoms of syncope, presyncope, or palpitations. Tolerating carvedilol. Walking 50m limited by dyspnoea.
O: Device interrogation: DDD pacemaker. Battery: 3.2 years remaining. 95% ventricular pacing. Threshold: 0.8V at 0.4ms. Sensing: normal. No arrhythmia log entries. LVEF on echo: 26%.
A: Pacemaker functioning normally. HFrEF stable on guideline-directed therapy.
P: Next device check 12 months. Continue current heart failure regime. CRT-D upgrade to consider at next device replacement.""",
                "created_at_offset_days": 60,
            },
        ],
        "visit": {
            "status": VisitStatus.IN_DEPARTMENT,
            "chief_complaint": "Worsening dyspnoea at rest, weight gain, bilateral oedema",
            "urgency_level": "critical",
            "current_department": "Cardiology",
            "assigned_doctor": "Dr. Anderson",
            "confidence": 0.97,
        },
    },
    {
        "name": "Maria Santos",
        "dob": date(1979, 8, 7),
        "gender": "female",
        "allergies": [
            {"allergen": "Codeine", "reaction": "Severe nausea and vomiting", "severity": "moderate", "recorded_at": date(2018, 5, 3)},
            {"allergen": "Erythromycin", "reaction": "Severe GI upset", "severity": "moderate", "recorded_at": date(2014, 12, 18)},
            {"allergen": "Latex", "reaction": "Contact urticaria", "severity": "mild", "recorded_at": date(2022, 1, 10)},
        ],
        "medications": [
            {"name": "Sumatriptan", "dosage": "50mg", "frequency": "PRN for migraine (max 2/24h)", "prescribed_by": "Dr. Vasquez", "start_date": date(2020, 6, 1)},
            {"name": "Topiramate", "dosage": "50mg", "frequency": "twice daily (migraine prophylaxis)", "prescribed_by": "Dr. Vasquez", "start_date": date(2021, 4, 15)},
            {"name": "Omeprazole", "dosage": "20mg", "frequency": "once daily", "prescribed_by": "Dr. Vasquez", "start_date": date(2023, 9, 1)},
            {"name": "Ondansetron", "dosage": "4mg", "frequency": "PRN for migraine-associated nausea", "prescribed_by": "Dr. Vasquez", "start_date": date(2021, 4, 15)},
            {"name": "Paracetamol/Codeine 500/30mg", "dosage": "1-2 tabs", "frequency": "PRN", "prescribed_by": "Dr. Lee", "start_date": date(2016, 3, 1), "end_date": date(2018, 5, 3)},
        ],
        "vitals": [
            {"days_ago": 120, "systolic_bp": 112, "diastolic_bp": 70, "heart_rate": 74, "temperature": 36.6, "weight_kg": 68.0, "height_cm": 164.0},
            {"days_ago": 60, "systolic_bp": 110, "diastolic_bp": 68, "heart_rate": 76, "weight_kg": 67.5},
            {"days_ago": 30, "systolic_bp": 114, "diastolic_bp": 72, "heart_rate": 72, "temperature": 36.7, "weight_kg": 67.2},
            {"days_ago": 14, "systolic_bp": 116, "diastolic_bp": 74, "heart_rate": 80, "temperature": 36.8, "weight_kg": 67.0},
            {"days_ago": 3, "systolic_bp": 122, "diastolic_bp": 76, "heart_rate": 86, "temperature": 37.1, "weight_kg": 67.4},
        ],
        "records": [
            {
                "record_type": "text",
                "summary": "Post-cholecystectomy follow-up — 6 weeks",
                "content": """S: Maria Santos, 46F, 6 weeks post laparoscopic cholecystectomy for acute cholecystitis (gallstones). Recovery uneventful. Wound healing well. Tolerating low-fat diet. No diarrhoea or jaundice.
O: BP 112/70. Abdomen: soft, non-tender. Port sites healed. LFTs normal. USS liver: no CBD dilation. Haemoglobin 128 g/L.
A: Uncomplicated post-cholecystectomy. No post-cholecystectomy syndrome.
P: Discharge from surgical follow-up. Full diet after 3 months. Return if RUQ pain recurs.""",
                "created_at_offset_days": 60,
            },
            {
                "record_type": "text",
                "summary": "Chronic migraine — prophylaxis review",
                "content": """S: Maria presents for 6-month migraine review. On topiramate 50mg BD + sumatriptan PRN. Reports reduction in frequency from 12 to 5 attacks/month. Still has 1-2 severe attacks requiring ED attendance/year. Some word-finding difficulties (topiramate side effect).
O: Neurological exam: normal. MIDAS score: 22 (Grade IV — severe disability).
A: Chronic migraine — partially responsive to topiramate. Cognitive side effects limiting dose escalation.
P: Switch to propranolol 80mg BD as alternative prophylaxis. Taper topiramate over 4 weeks. Maintain sumatriptan PRN. Botox referral if >2 more severe episodes on propranolol.""",
                "created_at_offset_days": 14,
            },
        ],
        "visit": {
            "status": VisitStatus.ROUTED,
            "chief_complaint": "Follow-up: post-cholecystectomy and migraine prophylaxis change",
            "urgency_level": "routine",
            "current_department": "General Surgery",
            "confidence": 0.82,
        },
    },
    {
        "name": "David Petrov",
        "dob": date(1962, 2, 16),
        "gender": "male",
        "allergies": [
            {"allergen": "Contrast dye (iodinated)", "reaction": "Mild urticaria", "severity": "mild", "recorded_at": date(2023, 5, 8)},
            {"allergen": "Penicillin", "reaction": "Rash", "severity": "mild", "recorded_at": date(1998, 3, 2)},
        ],
        "medications": [
            {"name": "Varenicline (Champix)", "dosage": "1mg", "frequency": "twice daily", "prescribed_by": "Dr. Nguyen", "start_date": date(2022, 8, 1), "end_date": date(2022, 11, 30)},
            {"name": "Aspirin", "dosage": "75mg", "frequency": "once daily", "prescribed_by": "Dr. Nguyen", "start_date": date(2023, 6, 1)},
            {"name": "Omeprazole", "dosage": "20mg", "frequency": "once daily (gastroprotection)", "prescribed_by": "Dr. Nguyen", "start_date": date(2023, 6, 1)},
            {"name": "Nicotine patch 14mg", "dosage": "14mg/24h", "frequency": "once daily (step-down)", "prescribed_by": "Dr. Nguyen", "start_date": date(2022, 11, 1), "end_date": date(2023, 4, 30)},
        ],
        "vitals": [
            {"days_ago": 180, "systolic_bp": 134, "diastolic_bp": 84, "heart_rate": 72, "temperature": 36.5, "respiratory_rate": 14, "oxygen_saturation": 96.0, "weight_kg": 88.5, "height_cm": 180.0},
            {"days_ago": 120, "systolic_bp": 136, "diastolic_bp": 86, "heart_rate": 74, "oxygen_saturation": 96.5, "weight_kg": 87.8},
            {"days_ago": 60, "systolic_bp": 132, "diastolic_bp": 82, "heart_rate": 70, "temperature": 36.4, "weight_kg": 87.2},
            {"days_ago": 30, "systolic_bp": 130, "diastolic_bp": 80, "heart_rate": 68, "oxygen_saturation": 97.0, "weight_kg": 86.8},
            {"days_ago": 7, "systolic_bp": 128, "diastolic_bp": 78, "heart_rate": 66, "temperature": 36.4, "oxygen_saturation": 97.5, "weight_kg": 86.5},
        ],
        "records": [
            {
                "record_type": "text",
                "summary": "Lung nodule surveillance — 12-month CT",
                "content": """S: David Petrov, 63M, ex-smoker (ceased 2022, 35 pack-year history). Annual lung nodule surveillance. Initial nodule found incidentally on CT abdomen 2023 (8mm solid, RUL). Now 12-month interval CT.
O: CT chest (with contrast — pre-medicated for mild contrast allergy): RUL 8mm solid nodule — unchanged in size and morphology from 2023. No new nodules. No mediastinal lymphadenopathy. Mild centrilobular emphysema.
A: 8mm solid RUL pulmonary nodule — stable at 12 months. Fleischner Society criteria: low-risk (non-smoker criteria met post-cessation, nodule unchanged). Emphysema consistent with prior smoking history.
P: Continue annual CT surveillance for minimum 2 further years (Fleischner criteria for intermediate-risk given smoking history). Chest specialist review. Confirm smoking cessation maintained. Low-dose CT preferred.""",
                "created_at_offset_days": 7,
            },
            {
                "record_type": "text",
                "summary": "Smoking cessation — cessation achieved",
                "content": """S: David presents for smoking cessation follow-up. Reports cessation since August 2022 (6 months). Completed 12-week Champix course. Using nicotine patch 14mg for cravings. Occasional cravings in social situations. Wife also quit simultaneously.
O: CO breath test: 2ppm (non-smoker range). BP 132/82. Mild weight gain 3kg since cessation.
A: Successful smoking cessation — 6 months sustained abstinence. Weight gain expected.
P: Step down to nicotine patch 7mg for 4 weeks then stop. HEPA filter at home recommended (air quality). Continue annual nodule surveillance. Dietary advice for weight management.""",
                "created_at_offset_days": 120,
            },
        ],
        "visit": {
            "status": VisitStatus.PENDING_REVIEW,
            "chief_complaint": "Lung nodule surveillance — awaiting specialist review of 12-month CT",
            "urgency_level": "routine",
            "confidence": 0.58,
            "routing_suggestion": [
                {"department": "Thoracic Surgery", "confidence": 0.58},
                {"department": "Respiratory", "confidence": 0.52},
            ],
        },
    },
]


# ---------------------------------------------------------------------------
# Seed helpers
# ---------------------------------------------------------------------------

def _days_ago(n: int) -> datetime:
    return datetime.utcnow() - timedelta(days=n)


async def _upsert_patient(db: AsyncSession, name: str, dob: date, gender: str) -> Patient:
    """Return existing patient or create new one (matched by name + dob)."""
    result = await db.execute(
        select(Patient).where(Patient.name == name, Patient.dob == dob)
    )
    patient = result.scalar_one_or_none()
    if patient is None:
        patient = Patient(name=name, dob=dob, gender=gender)
        db.add(patient)
        await db.flush()
        logger.info("Created patient: %s", name)
    else:
        logger.info("Existing patient: %s (id=%s)", name, patient.id)
    return patient


async def _seed_visit(
    db: AsyncSession,
    patient: Patient,
    visit_data: dict,
    visit_counter: list,
) -> Visit:
    """Create a visit with a linked chat session for intake."""
    n = visit_counter[0]
    visit_counter[0] += 1
    visit_id = f"VIS-{date.today().strftime('%Y%m%d')}-{n:03d}"

    session = ChatSession(title=f"Intake - {visit_id}")
    db.add(session)
    await db.flush()

    visit = Visit(
        visit_id=visit_id,
        patient_id=patient.id,
        intake_session_id=session.id,
        status=visit_data.get("status", VisitStatus.INTAKE).value,
        chief_complaint=visit_data.get("chief_complaint"),
        urgency_level=visit_data.get("urgency_level"),
        current_department=visit_data.get("current_department"),
        assigned_doctor=visit_data.get("assigned_doctor"),
        clinical_notes=visit_data.get("clinical_notes"),
        confidence=visit_data.get("confidence"),
        routing_suggestion=visit_data.get("routing_suggestion"),
        intake_notes=visit_data.get("intake_notes"),
        reviewed_by=visit_data.get("reviewed_by"),
    )
    db.add(visit)
    await db.flush()
    return visit


async def _seed_patient_data(db: AsyncSession, data: dict, visit_counter: list) -> None:
    """Seed one patient with all associated clinical data."""
    patient = await _upsert_patient(db, data["name"], data["dob"], data["gender"])

    # Clear existing clinical data so re-runs stay clean
    for model_cls in (Allergy, Medication, VitalSign, MedicalRecord):
        existing = await db.execute(
            select(model_cls).where(model_cls.patient_id == patient.id)
        )
        for row in existing.scalars().all():
            await db.delete(row)

    # Allergies
    for a in data.get("allergies", []):
        db.add(Allergy(
            patient_id=patient.id,
            allergen=a["allergen"],
            reaction=a["reaction"],
            severity=a["severity"],
            recorded_at=a["recorded_at"],
        ))

    # Medications
    for m in data.get("medications", []):
        db.add(Medication(
            patient_id=patient.id,
            name=m["name"],
            dosage=m["dosage"],
            frequency=m["frequency"],
            prescribed_by=m.get("prescribed_by"),
            start_date=m["start_date"],
            end_date=m.get("end_date"),
        ))

    # Vitals
    visits_for_vitals: list[Visit] = []
    for v in data.get("vitals", []):
        vs = VitalSign(
            patient_id=patient.id,
            recorded_at=_days_ago(v["days_ago"]),
            systolic_bp=v.get("systolic_bp"),
            diastolic_bp=v.get("diastolic_bp"),
            heart_rate=v.get("heart_rate"),
            temperature=v.get("temperature"),
            respiratory_rate=v.get("respiratory_rate"),
            oxygen_saturation=v.get("oxygen_saturation"),
            weight_kg=v.get("weight_kg"),
            height_cm=v.get("height_cm"),
        )
        db.add(vs)

    # Medical records
    for r in data.get("records", []):
        db.add(MedicalRecord(
            patient_id=patient.id,
            record_type=r["record_type"],
            summary=r["summary"],
            content=r["content"],
            created_at=_days_ago(r["created_at_offset_days"]),
        ))

    # Visits — single visit (key: "visit") or multiple (key: "visits")
    single = data.get("visit")
    multiple = data.get("visits", [])
    visit_defs = [single] if single else multiple

    for vd in visit_defs:
        await _seed_visit(db, patient, vd, visit_counter)


async def seed() -> None:
    """Run the full seed."""
    logger.info("Starting seed — %d patients", len(PATIENTS))
    visit_counter = [1]
    async with AsyncSessionLocal() as db:
        for data in PATIENTS:
            await _seed_patient_data(db, data, visit_counter)
        await db.commit()
    logger.info("Seed complete.")


if __name__ == "__main__":
    asyncio.run(seed())
```

- [ ] **Step 2: Verify the seed parses without import errors**

```bash
python -c "import scripts.db.seed.seed; print('OK')"
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add scripts/db/seed/seed.py
git commit -m "feat(seed): consolidated 10-patient seeder with clinical data"
```

---

## Task 6: Delete Old Seed Files + Final Verification

**Files:**
- Delete: `scripts/db/seed/seed_mock_data.py`
- Delete: `scripts/db/seed/seed_full_flow.py`
- Delete: `scripts/db/seed/seed_detailed_clinical_data.py`
- Delete: `scripts/db/seed/seed_agents.py`
- Delete: `scripts/db/seed/seed_chat_sessions.py`

- [ ] **Step 1: Delete old seed files**

```bash
rm scripts/db/seed/seed_mock_data.py \
   scripts/db/seed/seed_full_flow.py \
   scripts/db/seed/seed_detailed_clinical_data.py \
   scripts/db/seed/seed_agents.py \
   scripts/db/seed/seed_chat_sessions.py
```

- [ ] **Step 2: Verify nothing imports the deleted files**

```bash
grep -r "seed_mock_data\|seed_full_flow\|seed_detailed\|seed_agents\|seed_chat_sessions" --include="*.py" .
```
Expected: no output.

- [ ] **Step 3: Run full test suite**

```bash
pytest tests/ -v --tb=short 2>&1 | tail -40
```
Expected: all tests pass. Fix any failures before proceeding.

- [ ] **Step 4: Verify Alembic head**

```bash
python -m alembic heads
```
Expected: `001_init (head)`

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore(seed): remove legacy seed scripts"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** All sections covered — new models (§2), dob change (§1), migrations (§4), seed (§5), file deletes (§6).
- [x] **No placeholders:** Every step has exact code or commands.
- [x] **Type consistency:** `date` type from `datetime` module used consistently. `Allergy`, `Medication`, `VitalSign` names match across all tasks. Back-populate names (`allergies`, `medications`, `vital_signs`) match `relationship()` definitions.
- [x] **Caller coverage:** All 6 dob callers identified in Task 3 steps 1–6. Tests updated in step 7.
