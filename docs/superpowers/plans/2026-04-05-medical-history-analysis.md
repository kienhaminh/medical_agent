# Medical History Analysis Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `analyze_medical_history` agent tool and `medical-history-analysis` skill that produces a structured clinical analysis of a patient's full medical history on demand mid-conversation.

**Architecture:** A synchronous tool function in `src/tools/` (same pattern as `pre_visit_brief` and `generate_differential_diagnosis`) fetches all patient data via `SessionLocal`, builds a clinical context string, calls the LLM with a structured prompt, and returns a markdown analysis. A `SKILL.md` file enables semantic skill discovery. A directive in `system.py` tells the agent when to call the tool.

**Tech Stack:** SQLAlchemy (sync sessions), existing `llm_provider.llm.invoke()` pattern, Python 3.10+

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/tools/medical_history_analysis_tool.py` | Tool implementation: fetch data, build prompt, call LLM, return markdown |
| Create | `src/skills/medical-history-analysis/SKILL.md` | Skill metadata for semantic discovery |
| Modify | `src/tools/__init__.py` | Import and re-export `analyze_medical_history` |
| Modify | `src/prompt/system.py` | Add directive telling agent when to call the tool |
| Create | `tests/unit/test_medical_history_analysis_tool.py` | Unit tests with mocked DB and LLM |

---

### Task 1: Write failing tests

**Files:**
- Create: `tests/unit/test_medical_history_analysis_tool.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/test_medical_history_analysis_tool.py`:

```python
"""Unit tests for analyze_medical_history tool."""
import pytest
from datetime import date, datetime
from unittest.mock import MagicMock, patch


# ---------------------------------------------------------------------------
# Helpers — build fake ORM objects without hitting the DB
# ---------------------------------------------------------------------------

def _patient(id=1, name="Nguyen Van A", dob=date(1970, 5, 15), gender="male"):
    p = MagicMock()
    p.id = id
    p.name = name
    p.dob = dob
    p.gender = gender
    return p


def _record(record_type="text", content="Patient has hypertension.", summary=None,
            created_at=datetime(2024, 3, 1)):
    r = MagicMock()
    r.record_type = record_type
    r.content = content
    r.summary = summary
    r.created_at = created_at
    return r


def _vital(systolic_bp=130, diastolic_bp=85, heart_rate=78, temperature=36.8,
           respiratory_rate=16, oxygen_saturation=98.0, weight_kg=70.0,
           height_cm=170.0, recorded_at=datetime(2024, 6, 1)):
    v = MagicMock()
    v.systolic_bp = systolic_bp
    v.diastolic_bp = diastolic_bp
    v.heart_rate = heart_rate
    v.temperature = temperature
    v.respiratory_rate = respiratory_rate
    v.oxygen_saturation = oxygen_saturation
    v.weight_kg = weight_kg
    v.height_cm = height_cm
    v.recorded_at = recorded_at
    return v


def _medication(name="Amlodipine", dosage="5mg", frequency="once daily",
                start_date=date(2023, 1, 1), end_date=None):
    m = MagicMock()
    m.name = name
    m.dosage = dosage
    m.frequency = frequency
    m.start_date = start_date
    m.end_date = end_date
    return m


def _allergy(allergen="Penicillin", reaction="Rash", severity="moderate",
             recorded_at=date(2020, 4, 10)):
    a = MagicMock()
    a.allergen = allergen
    a.reaction = reaction
    a.severity = severity
    a.recorded_at = recorded_at
    return a


def _imaging(image_type="flair", segmentation_result=None,
             created_at=datetime(2024, 2, 20)):
    i = MagicMock()
    i.image_type = image_type
    i.segmentation_result = segmentation_result
    i.created_at = created_at
    return i


# ---------------------------------------------------------------------------
# Fixture: mock DB session that returns a fully-populated patient dataset
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_db_full(monkeypatch):
    """Patch SessionLocal to return a fully-populated patient dataset."""
    patient = _patient()
    records = [_record(), _record(record_type="pdf", content=None, summary="ECG normal sinus rhythm")]
    vitals = [_vital()]
    meds = [_medication()]
    allergies = [_allergy()]
    images = [_imaging()]

    session = MagicMock()

    def execute_side_effect(stmt):
        result = MagicMock()
        # Identify query by inspecting the WHERE clause entity
        entity = stmt.froms[0].entity_zero.entity if hasattr(stmt, 'froms') else None
        from src.models import Patient, MedicalRecord, VitalSign, Medication, Allergy, Imaging
        if entity is Patient:
            result.scalar_one_or_none.return_value = patient
        elif entity is MedicalRecord:
            result.scalars.return_value.all.return_value = records
        elif entity is VitalSign:
            result.scalars.return_value.all.return_value = vitals
        elif entity is Medication:
            result.scalars.return_value.all.return_value = meds
        elif entity is Allergy:
            result.scalars.return_value.all.return_value = allergies
        elif entity is Imaging:
            result.scalars.return_value.all.return_value = images
        else:
            result.scalars.return_value.all.return_value = []
            result.scalar_one_or_none.return_value = None
        return result

    session.execute.side_effect = execute_side_effect
    session.__enter__ = MagicMock(return_value=session)
    session.__exit__ = MagicMock(return_value=False)

    mock_session_local = MagicMock(return_value=session)

    monkeypatch.setattr(
        "src.tools.medical_history_analysis_tool.SessionLocal",
        mock_session_local,
    )
    return session


@pytest.fixture
def mock_llm(monkeypatch):
    """Patch _call_llm to return a fixed analysis string."""
    llm_output = """## Chief Concerns
- Hypertension (ongoing)

## Chronic Conditions
- Essential hypertension diagnosed 2023

## Medication Review
- Amlodipine 5mg once daily (active)

## Allergy Profile
- Penicillin — Rash (moderate)

## Key Lab & Imaging Findings
- MRI flair available (2024-02-20)

## 🔴 Red Flags
- Elevated BP readings warrant follow-up

## Clinical Recommendations
- Annual cardiology review recommended"""

    monkeypatch.setattr(
        "src.tools.medical_history_analysis_tool._call_llm",
        lambda prompt: llm_output,
    )
    return llm_output


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestAnalyzeMedicalHistory:

    def test_returns_string(self, mock_db_full, mock_llm):
        """Tool must return a string."""
        from src.tools.medical_history_analysis_tool import analyze_medical_history
        result = analyze_medical_history(patient_id=1)
        assert isinstance(result, str)

    def test_contains_clinical_sections(self, mock_db_full, mock_llm):
        """Output must contain the expected clinical section headers."""
        from src.tools.medical_history_analysis_tool import analyze_medical_history
        result = analyze_medical_history(patient_id=1)
        assert "Chief Concerns" in result
        assert "Medication Review" in result
        assert "Allergy Profile" in result
        assert "Red Flags" in result
        assert "Clinical Recommendations" in result

    def test_patient_not_found_returns_error(self, monkeypatch):
        """When patient is not in DB, return a clear error string."""
        session = MagicMock()
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = None
        session.execute.return_value = result_mock
        session.__enter__ = MagicMock(return_value=session)
        session.__exit__ = MagicMock(return_value=False)
        monkeypatch.setattr(
            "src.tools.medical_history_analysis_tool.SessionLocal",
            MagicMock(return_value=session),
        )

        from src.tools.medical_history_analysis_tool import analyze_medical_history
        result = analyze_medical_history(patient_id=999)
        assert "not found" in result.lower()

    def test_focus_area_passed_to_llm(self, mock_db_full, monkeypatch):
        """When focus_area is provided, it must appear in the prompt sent to LLM."""
        captured = {}

        def capture_llm(prompt):
            captured["prompt"] = prompt
            return "## Chief Concerns\n- Test"

        monkeypatch.setattr(
            "src.tools.medical_history_analysis_tool._call_llm",
            capture_llm,
        )
        from src.tools.medical_history_analysis_tool import analyze_medical_history
        analyze_medical_history(patient_id=1, focus_area="cardiovascular")
        assert "cardiovascular" in captured["prompt"].lower()

    def test_no_records_does_not_crash(self, monkeypatch, mock_llm):
        """Tool must handle a patient with zero records/vitals/meds/allergies/imaging."""
        patient = _patient()
        session = MagicMock()

        def execute_side_effect(stmt):
            result = MagicMock()
            from src.models import Patient
            entity = stmt.froms[0].entity_zero.entity if hasattr(stmt, 'froms') else None
            if entity is Patient:
                result.scalar_one_or_none.return_value = patient
            else:
                result.scalars.return_value.all.return_value = []
            return result

        session.execute.side_effect = execute_side_effect
        session.__enter__ = MagicMock(return_value=session)
        session.__exit__ = MagicMock(return_value=False)
        monkeypatch.setattr(
            "src.tools.medical_history_analysis_tool.SessionLocal",
            MagicMock(return_value=session),
        )

        from src.tools.medical_history_analysis_tool import analyze_medical_history
        result = analyze_medical_history(patient_id=1)
        assert isinstance(result, str)
        assert len(result) > 0

    def test_registered_in_tool_registry(self):
        """analyze_medical_history must be registered in ToolRegistry after import."""
        import src.tools.medical_history_analysis_tool  # noqa: F401 — triggers registration
        from src.tools.registry import ToolRegistry
        registry = ToolRegistry()
        tool = registry.get("analyze_medical_history")
        assert tool is not None

    def test_text_record_content_truncated(self, monkeypatch, mock_llm):
        """Text records longer than 1500 chars must be truncated in the prompt."""
        patient = _patient()
        long_content = "A" * 3000
        records = [_record(content=long_content)]
        session = MagicMock()

        def execute_side_effect(stmt):
            result = MagicMock()
            from src.models import Patient, MedicalRecord
            entity = stmt.froms[0].entity_zero.entity if hasattr(stmt, 'froms') else None
            if entity is Patient:
                result.scalar_one_or_none.return_value = patient
            elif entity is MedicalRecord:
                result.scalars.return_value.all.return_value = records
            else:
                result.scalars.return_value.all.return_value = []
            return result

        session.execute.side_effect = execute_side_effect
        session.__enter__ = MagicMock(return_value=session)
        session.__exit__ = MagicMock(return_value=False)

        captured = {}

        def capture_llm(prompt):
            captured["prompt"] = prompt
            return "## Chief Concerns\n- Test"

        monkeypatch.setattr(
            "src.tools.medical_history_analysis_tool.SessionLocal",
            MagicMock(return_value=session),
        )
        monkeypatch.setattr(
            "src.tools.medical_history_analysis_tool._call_llm",
            capture_llm,
        )

        from src.tools.medical_history_analysis_tool import analyze_medical_history
        analyze_medical_history(patient_id=1)
        assert "A" * 3000 not in captured["prompt"]
        assert "A" * 1500 in captured["prompt"]
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
python3 -m pytest tests/unit/test_medical_history_analysis_tool.py -v 2>&1 | head -30
```

Expected: `ModuleNotFoundError: No module named 'src.tools.medical_history_analysis_tool'`

---

### Task 2: Implement the tool

**Files:**
- Create: `src/tools/medical_history_analysis_tool.py`

- [ ] **Step 3: Create the tool file**

Create `src/tools/medical_history_analysis_tool.py`:

```python
"""Medical history analysis tool — structured clinical review of a patient's full history.

Fetches all patient data (records, vitals, medications, allergies, imaging),
builds a clinical context string, and calls the LLM with a structured prompt
that enforces section-based output suitable for active clinical decision-making.

Distinct from patient.health_summary (a cached narrative stored in DB):
this tool runs live, mid-conversation, and returns a clinician-grade analysis
with red flags and recommendations.
"""
import logging
from datetime import date
from typing import Optional

from sqlalchemy import select, desc

from src.models import (
    SessionLocal, Patient, MedicalRecord, VitalSign,
    Medication, Allergy, Imaging,
)
from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

HISTORY_ANALYSIS_PROMPT = """You are a senior clinician performing a structured medical history review.

Patient: {name}, {age}yo {gender}

{records_section}

{vitals_section}

{medications_section}

{allergies_section}

{imaging_section}

---

Produce a structured clinical history analysis using the sections below.
Omit any section where no data is available — do not write "None" or "N/A".
Be specific to this patient's data. Do not give generic advice.
{focus_instruction}

## Chief Concerns
Recurring complaints and active problems identified across records.

## Chronic Conditions
Established diagnoses with onset, progression, and current status.

## Surgical & Procedure History
Notable interventions, dates, and outcomes.

## Medication Review
Current medications, notable changes over time, potential interactions or concerns.

## Allergy Profile
Known allergies with reaction type and severity.

## Key Lab & Imaging Findings
Significant results and trends. Note abnormal values or worrying patterns.

## 🔴 Red Flags
Findings that warrant urgent attention or immediate follow-up. Be specific.

## Clinical Recommendations
Suggested next steps: investigations, referrals, screenings overdue, management changes."""


def _call_llm(prompt: str) -> str:
    """Call the configured LLM provider and return the raw text response."""
    from src.api.dependencies import llm_provider
    response = llm_provider.llm.invoke(prompt)
    return response.content if hasattr(response, "content") else str(response)


def _patient_age(dob: date) -> int:
    """Calculate age in years from date of birth."""
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def _build_records_section(records: list) -> str:
    if not records:
        return ""
    lines = [f"Medical Records ({len(records)} total, chronological):"]
    for r in records:
        date_str = r.created_at.strftime("%Y-%m-%d") if r.created_at else "Unknown date"
        if r.record_type == "text" and r.content:
            content = r.content[:1500] + "..." if len(r.content) > 1500 else r.content
            lines.append(f"[{date_str}] TEXT: {content}")
        elif r.summary:
            lines.append(f"[{date_str}] {r.record_type.upper()}: {r.summary}")
        else:
            lines.append(f"[{date_str}] {r.record_type.upper()}: (no summary)")
    return "\n".join(lines)


def _build_vitals_section(vitals: list) -> str:
    if not vitals:
        return ""
    lines = [f"Vital Signs (last {len(vitals)} readings):"]
    for v in vitals:
        date_str = v.recorded_at.strftime("%Y-%m-%d") if v.recorded_at else "Unknown"
        parts = []
        if v.systolic_bp and v.diastolic_bp:
            parts.append(f"BP {v.systolic_bp}/{v.diastolic_bp} mmHg")
        if v.heart_rate:
            parts.append(f"HR {v.heart_rate} bpm")
        if v.temperature:
            parts.append(f"Temp {v.temperature}°C")
        if v.respiratory_rate:
            parts.append(f"RR {v.respiratory_rate}/min")
        if v.oxygen_saturation:
            parts.append(f"SpO2 {v.oxygen_saturation}%")
        if v.weight_kg:
            parts.append(f"Weight {v.weight_kg} kg")
        if v.height_cm:
            parts.append(f"Height {v.height_cm} cm")
        if parts:
            lines.append(f"[{date_str}] {' | '.join(parts)}")
    return "\n".join(lines)


def _build_medications_section(medications: list) -> str:
    if not medications:
        return ""
    lines = ["Medications:"]
    for m in medications:
        status = "ACTIVE" if m.end_date is None else f"stopped {m.end_date}"
        lines.append(f"- {m.name} {m.dosage} {m.frequency} ({status}, since {m.start_date})")
    return "\n".join(lines)


def _build_allergies_section(allergies: list) -> str:
    if not allergies:
        return ""
    lines = ["Allergies:"]
    for a in allergies:
        lines.append(f"- {a.allergen}: {a.reaction} ({a.severity} severity, recorded {a.recorded_at})")
    return "\n".join(lines)


def _build_imaging_section(imaging: list) -> str:
    if not imaging:
        return ""
    lines = [f"Imaging ({len(imaging)} studies):"]
    for img in imaging:
        date_str = img.created_at.strftime("%Y-%m-%d") if img.created_at else "Unknown"
        seg = " — segmentation available" if img.segmentation_result else ""
        lines.append(f"- [{date_str}] {img.image_type.upper()}{seg}")
    return "\n".join(lines)


def analyze_medical_history(
    patient_id: int,
    focus_area: Optional[str] = None,
) -> str:
    """Perform a structured clinical analysis of a patient's full medical history.

    Fetches all records, vitals, medications, allergies, and imaging from the
    database and passes them through a clinical expert prompt. Returns a
    markdown-formatted analysis with sections for chief concerns, chronic
    conditions, medications, allergies, imaging findings, red flags, and
    clinical recommendations.

    ALWAYS call this tool when asked to analyse, review, or summarise a
    patient's medical history or full clinical picture. Do not attempt to
    synthesise history manually from individual record queries.

    Args:
        patient_id: Patient's database ID (from the patient context)
        focus_area: Optional clinical domain for deeper focus
                    (e.g. "cardiovascular", "medications", "oncology")

    Returns:
        Structured markdown clinical analysis
    """
    with SessionLocal() as db:
        # Fetch patient
        patient = db.execute(
            select(Patient).where(Patient.id == patient_id)
        ).scalar_one_or_none()

        if not patient:
            return f"Error: Patient {patient_id} not found in the database."

        # Fetch all related data
        records = db.execute(
            select(MedicalRecord)
            .where(MedicalRecord.patient_id == patient_id)
            .order_by(MedicalRecord.created_at)
        ).scalars().all()

        vitals = db.execute(
            select(VitalSign)
            .where(VitalSign.patient_id == patient_id)
            .order_by(desc(VitalSign.recorded_at))
            .limit(20)
        ).scalars().all()

        medications = db.execute(
            select(Medication)
            .where(Medication.patient_id == patient_id)
            .order_by(Medication.start_date)
        ).scalars().all()

        allergies = db.execute(
            select(Allergy)
            .where(Allergy.patient_id == patient_id)
        ).scalars().all()

        imaging = db.execute(
            select(Imaging)
            .where(Imaging.patient_id == patient_id)
            .order_by(Imaging.created_at)
        ).scalars().all()

    # Build prompt sections (empty string = section omitted)
    focus_instruction = (
        f"\nPay particular clinical attention to: {focus_area}.\n"
        if focus_area else ""
    )

    prompt = HISTORY_ANALYSIS_PROMPT.format(
        name=patient.name,
        age=_patient_age(patient.dob),
        gender=patient.gender,
        records_section=_build_records_section(records),
        vitals_section=_build_vitals_section(vitals),
        medications_section=_build_medications_section(medications),
        allergies_section=_build_allergies_section(allergies),
        imaging_section=_build_imaging_section(imaging),
        focus_instruction=focus_instruction,
    )

    try:
        return _call_llm(prompt)
    except Exception as e:
        logger.error("analyze_medical_history failed for patient %d: %s", patient_id, e)
        return f"Error: Failed to generate medical history analysis — {e}"


_registry = ToolRegistry()
_registry.register(
    analyze_medical_history,
    scope="assignable",
    symbol="analyze_medical_history",
    allow_overwrite=True,
)
```

- [ ] **Step 4: Run the tests**

```bash
python3 -m pytest tests/unit/test_medical_history_analysis_tool.py -v 2>&1
```

Expected: All 7 tests pass. If `test_registered_in_tool_registry` fails with a singleton conflict, it means the registry already has a stale instance — that's fine if the other tests pass; note the test resets nothing (the registry is a module-level singleton).

- [ ] **Step 5: Commit**

```bash
git add src/tools/medical_history_analysis_tool.py tests/unit/test_medical_history_analysis_tool.py
git commit -m "feat: add analyze_medical_history tool with tests"
```

---

### Task 3: Wire the tool into the agent

**Files:**
- Modify: `src/tools/__init__.py`

- [ ] **Step 6: Add import and re-export**

In `src/tools/__init__.py`, add after the `medical_img_segmentation_tool` import line:

```python
from . import medical_history_analysis_tool
```

And add to the re-exports after `from .medical_img_segmentation_tool import segment_patient_image`:

```python
from .medical_history_analysis_tool import analyze_medical_history
```

And add `"analyze_medical_history"` to the `__all__` list.

The relevant section of `src/tools/__init__.py` should look like:

```python
from . import medical_img_segmentation_tool
from . import medical_history_analysis_tool

# Re-export convenience functions
...
from .medical_img_segmentation_tool import segment_patient_image
from .medical_history_analysis_tool import analyze_medical_history

__all__ = [
    ...
    "segment_patient_image",
    "analyze_medical_history",
]
```

- [ ] **Step 7: Verify import works**

```bash
python3 -c "from src.tools import analyze_medical_history; print('OK:', analyze_medical_history)"
```

Expected: `OK: <function analyze_medical_history at 0x...>`

- [ ] **Step 8: Commit**

```bash
git add src/tools/__init__.py
git commit -m "feat: register analyze_medical_history in tools package"
```

---

### Task 4: Add the system prompt directive

**Files:**
- Modify: `src/prompt/system.py`

- [ ] **Step 9: Add directive to system prompt**

In `src/prompt/system.py`, append the following block at the end of the `SYSTEM_PROMPT` string, after the MRI segmentation directive:

```python
SYSTEM_PROMPT = """...existing content...

**Tool: analyze_medical_history — CALL THIS TOOL, DO NOT ANSWER DIRECTLY**
When any user asks to analyse, review, or summarise a patient's medical history, full clinical picture, or overall health status: call `analyze_medical_history` immediately. Do not attempt to synthesise the history yourself from individual records.

- `analyze_medical_history(patient_id=<id>)` — patient_id comes from the patient context prepended to every message.
- Optionally pass `focus_area=<area>` if the user specifies a clinical domain (e.g. "cardiovascular history", "medication review", "oncology workup").
- After the tool returns, present the result as-is. Do not paraphrase or shorten the structured sections — the clinician needs the full output.
- If no patient context is available, tell the user you need a patient ID before you can run the analysis."""
```

The directive must be inside the triple-quoted string (appended before the closing `"""`), not after it.

- [ ] **Step 10: Verify system prompt contains the new directive**

```bash
python3 -c "from src.prompt.system import SYSTEM_PROMPT; assert 'analyze_medical_history' in SYSTEM_PROMPT; print('OK')"
```

Expected: `OK`

- [ ] **Step 11: Commit**

```bash
git add src/prompt/system.py
git commit -m "feat: add analyze_medical_history directive to system prompt"
```

---

### Task 5: Add the skill metadata file

**Files:**
- Create: `src/skills/medical-history-analysis/SKILL.md`

- [ ] **Step 12: Create the skill directory and SKILL.md**

Create `src/skills/medical-history-analysis/SKILL.md`:

```markdown
---
name: medical-history-analysis
description: "Phân tích toàn diện lịch sử bệnh án bệnh nhân theo tiêu chuẩn lâm sàng. Tổng hợp hồ sơ y tế, sinh hiệu, thuốc, dị ứng và chẩn đoán hình ảnh thành báo cáo lâm sàng có cấu trúc với dấu hiệu cảnh báo và khuyến nghị."
when_to_use:
  - "Phân tích lịch sử bệnh án bệnh nhân"
  - "Tổng hợp hồ sơ lâm sàng đầy đủ"
  - "Xem xét toàn bộ tiền sử y tế"
  - "Đánh giá nguy cơ và khuyến nghị lâm sàng"
  - "Tìm dấu hiệu cảnh báo trong hồ sơ bệnh nhân"
  - "Analyse patient medical history"
  - "Full clinical picture review"
  - "Medical history summary"
when_not_to_use:
  - "Chẩn đoán phân biệt dựa trên triệu chứng hiện tại → dùng generate_differential_diagnosis"
  - "Xem ảnh y tế → dùng imaging skill"
  - "Thông tin cơ bản bệnh nhân → dùng patient-management skill"
  - "Tóm tắt tổng quan (đã có sẵn) → đọc patient.health_summary"
keywords:
  - phân tích bệnh án
  - medical history
  - lịch sử bệnh
  - tiền sử y tế
  - tổng hợp hồ sơ
  - red flag
  - dấu hiệu cảnh báo
  - khuyến nghị lâm sàng
  - clinical review
  - history analysis
  - analyze history
examples:
  - "Phân tích lịch sử bệnh án bệnh nhân này"
  - "Tổng hợp toàn bộ hồ sơ lâm sàng"
  - "Xem xét tiền sử y tế và đưa ra khuyến nghị"
  - "Analyse this patient's medical history"
  - "Give me a full clinical review of the patient"
  - "Review the patient's history and flag any red flags"
---

# Medical History Analysis Skill

## Overview

Skill này thực hiện phân tích lâm sàng toàn diện về lịch sử y tế của bệnh nhân theo yêu cầu trong cuộc hội thoại. Khác với `health_summary` (bản tóm tắt được lưu trong DB), kết quả của skill này được tạo trực tiếp khi cần và trả về inline trong cuộc trò chuyện.

## Tool

- `analyze_medical_history(patient_id, focus_area=None)`: Phân tích toàn bộ lịch sử bệnh án

## Output Sections

1. **Chief Concerns** — Vấn đề tái diễn và vấn đề đang hoạt động
2. **Chronic Conditions** — Bệnh mãn tính với tiến triển
3. **Surgical & Procedure History** — Can thiệp lớn
4. **Medication Review** — Thuốc hiện tại và nguy cơ tương tác
5. **Allergy Profile** — Dị ứng đã biết
6. **Key Lab & Imaging Findings** — Kết quả quan trọng
7. **🔴 Red Flags** — Dấu hiệu cần chú ý ngay
8. **Clinical Recommendations** — Bước tiếp theo được đề xuất

## Usage Guidelines

1. Luôn gọi tool này thay vì tự tổng hợp từ các hồ sơ riêng lẻ
2. Cần `patient_id` từ context — nếu không có, hỏi người dùng
3. Dùng `focus_area` khi người dùng chỉ định lĩnh vực cụ thể
4. Trình bày kết quả đầy đủ — không rút gọn các phần
```

- [ ] **Step 13: Verify the skill is discoverable**

```bash
python3 -c "
from src.skills.registry import SkillRegistry
SkillRegistry._instance = None
registry = SkillRegistry()
count = registry.discover_skills(['src/skills'])
skills = registry.list_skills()
names = [s['name'] for s in skills]
print('Skills found:', names)
assert 'medical-history-analysis' in names, f'Not found in: {names}'
print('OK')
"
```

Expected: `medical-history-analysis` appears in the printed list and `OK` is printed.

- [ ] **Step 14: Commit**

```bash
git add src/skills/medical-history-analysis/SKILL.md
git commit -m "feat: add medical-history-analysis skill metadata"
```

---

### Task 6: Final verification

- [ ] **Step 15: Run the full unit test suite to confirm no regressions**

```bash
python3 -m pytest tests/ -q --ignore=tests/unit/test_skill_selector.py --ignore=tests/unit/test_tool_registry.py 2>&1 | tail -5
```

Expected: All previously passing tests still pass. The count should be 212 passed (205 + 7 new).

- [ ] **Step 16: Verify tool appears in agent's tool list**

```bash
python3 -c "
from src.tools.registry import ToolRegistry
import src.tools  # triggers all registrations
registry = ToolRegistry()
tools = registry.list_tools()
names = [t['name'] if isinstance(t, dict) else t.__name__ for t in tools]
print([n for n in names if 'history' in str(n).lower()])
"
```

Expected: `['analyze_medical_history']` (or similar output confirming registration).

- [ ] **Step 17: Final commit**

```bash
git add -A
git commit -m "feat: complete medical-history-analysis skill — tool, skill metadata, system prompt"
```
