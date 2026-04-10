# Agent Evaluation Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone E2E evaluation runner that simulates full patient journeys (intake → triage → doctor DDx/history/SOAP) and produces scored reports for clinical validation and continuous monitoring.

**Architecture:** Standalone `eval/` module that calls the running API via httpx, seeds patient data into the DB, drives multi-turn conversations by consuming SSE streams, and scores outputs using rule-based assertions plus optional LLM-as-judge. Each patient case is a YAML file.

**Tech Stack:** Python 3.10+, httpx (async HTTP + SSE), PyYAML, pydantic v2 (case schema), SQLAlchemy async (patient seeding), anthropic SDK (LLM judge, optional)

**Prerequisites:** The Medera API server must be running at `http://localhost:8000` (or `EVAL_BASE_URL` env var). PostgreSQL must be reachable at `DATABASE_URL` env var.

---

## File Map

```
eval/
├── __init__.py
├── case_loader.py         # Pydantic models + YAML loading/validation
├── api_client.py          # httpx wrapper: chat (SSE), patients, form-response
├── patient_seeder.py      # Seed + teardown patient data in DB
├── intake_simulator.py    # Drive multi-turn intake conversation
├── doctor_simulator.py    # Trigger DDx, history analysis, SOAP note
├── scorer.py              # Rule-based assertions per stage
├── judge.py               # LLM-as-judge scoring (optional --judge flag)
├── report.py              # JSON + Markdown report generation
├── runner.py              # CLI orchestrator
├── rubrics/
│   ├── ddx.md
│   ├── history.md
│   └── soap.md
├── cases/
│   ├── cardiology-chest-pain.yaml
│   ├── cardiology-palpitations.yaml
│   ├── neurology-headache.yaml
│   ├── neurology-stroke-symptoms.yaml
│   ├── gastro-abdominal-pain.yaml
│   ├── gastro-nausea-vomiting.yaml
│   ├── ent-sore-throat.yaml
│   ├── ent-ear-pain.yaml
│   ├── emergency-stroke-red-flag.yaml
│   ├── emergency-chest-pain-high-risk.yaml
│   ├── internal-fatigue-diabetes.yaml
│   ├── internal-fever-unknown.yaml
│   ├── returning-patient-cardio.yaml
│   ├── returning-patient-neuro.yaml
│   ├── low-confidence-ambiguous.yaml
│   ├── pediatric-abdominal.yaml
│   ├── dermatology-rash.yaml
│   ├── orthopedics-joint-pain.yaml
│   ├── urology-pain.yaml
│   └── mental-health-anxiety.yaml
└── results/               # gitignored; one JSON per run

tests/eval/
├── __init__.py
├── test_case_loader.py
├── test_api_client.py
├── test_patient_seeder.py
├── test_intake_simulator.py
├── test_doctor_simulator.py
├── test_scorer.py
└── test_report.py
```

---

## Task 1: Scaffold + Case Loader

**Files:**
- Create: `eval/__init__.py`
- Create: `eval/case_loader.py`
- Create: `eval/cases/cardiology-chest-pain.yaml`
- Create: `eval/cases/neurology-headache.yaml`
- Create: `eval/cases/emergency-stroke.yaml`
- Create: `tests/eval/__init__.py`
- Create: `tests/eval/test_case_loader.py`

- [ ] **Step 1.1: Write the failing test**

```python
# tests/eval/test_case_loader.py
from pathlib import Path
import pytest
from eval.case_loader import load_case, load_all_cases, EvalCase

FIXTURES_DIR = Path(__file__).parent / "fixtures"

def test_load_case_returns_eval_case(tmp_path):
    yaml_content = """
id: test-case-001
description: "Test case"
patient:
  name: "John Doe"
  age: 55
  sex: male
  medical_history:
    - type: chronic_condition
      name: Hypertension
    - type: medication
      name: Lisinopril
      dosage: "10mg daily"
  allergies:
    - Penicillin
intake:
  turns:
    - "I have chest pain"
    - "It's crushing, 8 out of 10"
expected:
  triage:
    department: Cardiology
    min_confidence: 0.7
    red_flags:
      - chest pain
  ddx:
    top_3_must_include:
      - "Acute Myocardial Infarction"
    icd10_present: true
  history_analysis:
    must_mention:
      - Hypertension
      - Penicillin allergy
    red_flags_expected:
      - hypertension with chest pain
  soap_note:
    required_sections: [S, O, A, P]
    assessment_must_mention:
      - chest pain
"""
    case_file = tmp_path / "test-case-001.yaml"
    case_file.write_text(yaml_content)

    case = load_case(case_file)

    assert isinstance(case, EvalCase)
    assert case.id == "test-case-001"
    assert case.patient.name == "John Doe"
    assert case.patient.age == 55
    assert case.patient.sex == "male"
    assert len(case.patient.medical_history) == 2
    assert case.patient.medical_history[0].type == "chronic_condition"
    assert case.patient.medical_history[1].dosage == "10mg daily"
    assert case.patient.allergies == ["Penicillin"]
    assert case.intake.turns == ["I have chest pain", "It's crushing, 8 out of 10"]
    assert case.expected.triage.department == "Cardiology"
    assert case.expected.triage.min_confidence == 0.7
    assert case.expected.ddx.top_3_must_include == ["Acute Myocardial Infarction"]
    assert case.expected.history_analysis.must_mention == ["Hypertension", "Penicillin allergy"]
    assert case.expected.soap_note.required_sections == ["S", "O", "A", "P"]


def test_load_all_cases_returns_list(tmp_path):
    yaml = """
id: case-a
description: "A"
patient:
  name: "Alice"
  age: 30
  sex: female
intake:
  turns: ["I feel sick"]
expected:
  triage:
    department: Internal Medicine
"""
    (tmp_path / "case-a.yaml").write_text(yaml)
    cases = load_all_cases(tmp_path)
    assert len(cases) == 1
    assert cases[0].id == "case-a"


def test_load_case_missing_required_field_raises(tmp_path):
    bad_yaml = """
id: bad-case
description: "Missing patient"
intake:
  turns: ["hello"]
expected:
  triage:
    department: Cardiology
"""
    case_file = tmp_path / "bad.yaml"
    case_file.write_text(bad_yaml)

    with pytest.raises(Exception):
        load_case(case_file)
```

- [ ] **Step 1.2: Run test to verify it fails**

```bash
cd /Users/kien.ha/Code/medical_agent
python -m pytest tests/eval/test_case_loader.py -v
```

Expected: `ModuleNotFoundError: No module named 'eval'`

- [ ] **Step 1.3: Create `eval/__init__.py`**

```python
# eval/__init__.py
```

- [ ] **Step 1.4: Create `eval/case_loader.py`**

```python
# eval/case_loader.py
from pathlib import Path
from typing import Optional
import yaml
from pydantic import BaseModel


class MedicalHistoryItem(BaseModel):
    type: str  # chronic_condition | medication | allergy
    name: str
    dosage: Optional[str] = None


class PatientProfile(BaseModel):
    name: str
    age: int
    sex: str
    medical_history: list[MedicalHistoryItem] = []
    allergies: list[str] = []


class IntakeScript(BaseModel):
    turns: list[str]


class TriageExpectation(BaseModel):
    department: str
    min_confidence: float = 0.7
    red_flags: list[str] = []


class DdxExpectation(BaseModel):
    top_3_must_include: list[str] = []
    icd10_present: bool = True


class HistoryExpectation(BaseModel):
    must_mention: list[str] = []
    red_flags_expected: list[str] = []


class SoapExpectation(BaseModel):
    required_sections: list[str] = ["S", "O", "A", "P"]
    assessment_must_mention: list[str] = []


class CaseExpected(BaseModel):
    triage: TriageExpectation
    ddx: DdxExpectation = DdxExpectation()
    history_analysis: HistoryExpectation = HistoryExpectation()
    soap_note: SoapExpectation = SoapExpectation()


class EvalCase(BaseModel):
    id: str
    description: str
    patient: PatientProfile
    intake: IntakeScript
    expected: CaseExpected


def load_case(path: Path) -> EvalCase:
    with open(path) as f:
        data = yaml.safe_load(f)
    return EvalCase(**data)


def load_all_cases(cases_dir: Path) -> list[EvalCase]:
    return [load_case(p) for p in sorted(cases_dir.glob("*.yaml"))]
```

- [ ] **Step 1.5: Create `tests/eval/__init__.py`**

```python
# tests/eval/__init__.py
```

- [ ] **Step 1.6: Run test to verify it passes**

```bash
python -m pytest tests/eval/test_case_loader.py -v
```

Expected: 3 PASSED

- [ ] **Step 1.7: Create `eval/cases/cardiology-chest-pain.yaml`**

```yaml
id: cardiology-chest-pain-001
description: "55-year-old male with acute chest pain, hypertension, radiating to left arm"

patient:
  name: "James Carter"
  age: 55
  sex: male
  medical_history:
    - type: chronic_condition
      name: Hypertension
    - type: medication
      name: Lisinopril
      dosage: "10mg daily"
    - type: medication
      name: Aspirin
      dosage: "81mg daily"
  allergies:
    - Penicillin

intake:
  turns:
    - "I've been having crushing chest pain for the past 2 hours"
    - "It's about 8 out of 10. It radiates to my left arm"
    - "I'm also sweating a lot and feel nauseous"
    - "No fever. I take Lisinopril for blood pressure"

expected:
  triage:
    department: Cardiology
    min_confidence: 0.7
    red_flags:
      - chest pain
      - left arm radiation

  ddx:
    top_3_must_include:
      - "Acute Myocardial Infarction"
      - "Unstable Angina"
      - "STEMI"
    icd10_present: true

  history_analysis:
    must_mention:
      - Hypertension
      - Lisinopril
      - Penicillin
    red_flags_expected:
      - chest pain
      - hypertension

  soap_note:
    required_sections: [S, O, A, P]
    assessment_must_mention:
      - chest pain
      - cardiac
```

- [ ] **Step 1.8: Create `eval/cases/neurology-headache.yaml`**

```yaml
id: neurology-headache-001
description: "38-year-old female with sudden severe thunderclap headache"

patient:
  name: "Sarah Chen"
  age: 38
  sex: female
  medical_history:
    - type: chronic_condition
      name: Migraines
    - type: medication
      name: Sumatriptan
      dosage: "50mg as needed"
  allergies: []

intake:
  turns:
    - "I have the worst headache of my life, it came on suddenly"
    - "It started about 30 minutes ago, it's a 10 out of 10"
    - "I have a history of migraines but this feels completely different"
    - "No fever, no neck stiffness that I know of"

expected:
  triage:
    department: Neurology
    min_confidence: 0.7
    red_flags:
      - thunderclap headache
      - worst headache of life

  ddx:
    top_3_must_include:
      - "Subarachnoid Hemorrhage"
      - "Migraine"
      - "Intracranial"
    icd10_present: true

  history_analysis:
    must_mention:
      - Migraines
      - Sumatriptan
    red_flags_expected:
      - thunderclap
      - subarachnoid

  soap_note:
    required_sections: [S, O, A, P]
    assessment_must_mention:
      - headache
      - neurolog
```

- [ ] **Step 1.9: Create `eval/cases/emergency-stroke.yaml`**

```yaml
id: emergency-stroke-001
description: "68-year-old male with sudden facial droop, arm weakness, and slurred speech"

patient:
  name: "Robert Williams"
  age: 68
  sex: male
  medical_history:
    - type: chronic_condition
      name: Atrial Fibrillation
    - type: chronic_condition
      name: Type 2 Diabetes
    - type: medication
      name: Warfarin
      dosage: "5mg daily"
    - type: medication
      name: Metformin
      dosage: "1000mg twice daily"
  allergies:
    - Sulfa drugs

intake:
  turns:
    - "My face is drooping on one side and my speech is slurred"
    - "My left arm is very weak, I can barely lift it"
    - "This started about 20 minutes ago out of nowhere"
    - "I take Warfarin for my heart condition"

expected:
  triage:
    department: Emergency
    min_confidence: 0.85
    red_flags:
      - facial droop
      - arm weakness
      - slurred speech
      - stroke

  ddx:
    top_3_must_include:
      - "Ischemic Stroke"
      - "TIA"
      - "Hemorrhagic Stroke"
    icd10_present: true

  history_analysis:
    must_mention:
      - Atrial Fibrillation
      - Warfarin
      - Diabetes
    red_flags_expected:
      - stroke
      - anticoagulant

  soap_note:
    required_sections: [S, O, A, P]
    assessment_must_mention:
      - stroke
      - neurolog
```

- [ ] **Step 1.10: Commit**

```bash
git add eval/ tests/eval/
git commit -m "feat(eval): scaffold case loader and 3 starter cases"
```

---

## Task 2: API Client

**Files:**
- Create: `eval/api_client.py`
- Create: `tests/eval/test_api_client.py`

- [ ] **Step 2.1: Write the failing test**

```python
# tests/eval/test_api_client.py
import json
import pytest
import httpx
from unittest.mock import AsyncMock, patch, MagicMock
from eval.api_client import EvalApiClient, ChatEvent


def _sse_lines(*events: dict) -> list[str]:
    """Build SSE line list from event dicts."""
    lines = []
    for event in events:
        lines.append(f"data: {json.dumps(event)}")
        lines.append("")
    return lines


@pytest.mark.asyncio
async def test_chat_parses_sse_chunks():
    """chat() collects chunk text and tool_calls from SSE stream."""
    sse_events = [
        {"chunk": "Hello "},
        {"chunk": "patient."},
        {"tool_call": {"name": "complete_triage", "args": {"department": "Cardiology", "confidence": 0.85}}},
        {"session_id": 42},
        {"done": True},
    ]

    async def mock_aiter_lines():
        for event in sse_events:
            yield f"data: {json.dumps(event)}"
            yield ""

    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.aiter_lines = mock_aiter_lines

    mock_stream_ctx = MagicMock()
    mock_stream_ctx.__aenter__ = AsyncMock(return_value=mock_response)
    mock_stream_ctx.__aexit__ = AsyncMock(return_value=False)

    async with EvalApiClient("http://localhost:8000") as client:
        with patch.object(client._client, "stream", return_value=mock_stream_ctx):
            event = await client.chat(message="I have chest pain", patient_id=1)

    assert event.content == "Hello patient."
    assert len(event.tool_calls) == 1
    assert event.tool_calls[0]["name"] == "complete_triage"
    assert event.tool_calls[0]["args"]["department"] == "Cardiology"
    assert event.session_id == 42


@pytest.mark.asyncio
async def test_create_patient_posts_correct_payload():
    """create_patient() POSTs to /api/patients and returns parsed JSON."""
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.json.return_value = {"id": 7, "name": "John Doe", "dob": "1970-01-01", "gender": "male", "created_at": "2026-04-10T00:00:00"}

    async with EvalApiClient("http://localhost:8000") as client:
        with patch.object(client._client, "post", return_value=mock_response) as mock_post:
            result = await client.create_patient("John Doe", "1970-01-01", "male")

    mock_post.assert_called_once_with(
        "/api/patients",
        json={"name": "John Doe", "dob": "1970-01-01", "gender": "male"},
    )
    assert result["id"] == 7


@pytest.mark.asyncio
async def test_form_response_posts_to_correct_url():
    """form_response() POSTs to /api/chat/{session_id}/form-response."""
    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()

    async with EvalApiClient("http://localhost:8000") as client:
        with patch.object(client._client, "post", return_value=mock_response) as mock_post:
            await client.form_response(
                session_id=42,
                form_id="form-abc",
                answers={"chief_complaint": "chest pain"},
                template="patient_intake",
            )

    mock_post.assert_called_once_with(
        "/api/chat/42/form-response",
        json={"form_id": "form-abc", "answers": {"chief_complaint": "chest pain"}, "template": "patient_intake"},
    )


@pytest.mark.asyncio
async def test_chat_ignores_non_data_lines():
    """chat() skips blank lines and comment lines in SSE stream."""
    async def mock_aiter_lines():
        yield ": keep-alive"
        yield ""
        yield "data: {\"chunk\": \"hello\"}"
        yield ""
        yield "data: {\"done\": true}"

    mock_response = MagicMock()
    mock_response.raise_for_status = MagicMock()
    mock_response.aiter_lines = mock_aiter_lines

    mock_stream_ctx = MagicMock()
    mock_stream_ctx.__aenter__ = AsyncMock(return_value=mock_response)
    mock_stream_ctx.__aexit__ = AsyncMock(return_value=False)

    async with EvalApiClient("http://localhost:8000") as client:
        with patch.object(client._client, "stream", return_value=mock_stream_ctx):
            event = await client.chat(message="hi", patient_id=1)

    assert event.content == "hello"
```

- [ ] **Step 2.2: Run test to verify it fails**

```bash
python -m pytest tests/eval/test_api_client.py -v
```

Expected: `ModuleNotFoundError: No module named 'eval.api_client'`

- [ ] **Step 2.3: Create `eval/api_client.py`**

```python
# eval/api_client.py
import json
import os
from dataclasses import dataclass, field

import httpx

BASE_URL = os.getenv("EVAL_BASE_URL", "http://localhost:8000")


@dataclass
class ChatEvent:
    chunks: list[str] = field(default_factory=list)
    tool_calls: list[dict] = field(default_factory=list)
    session_id: int | None = None

    @property
    def content(self) -> str:
        return "".join(self.chunks)


class EvalApiClient:
    def __init__(self, base_url: str = BASE_URL):
        self._base_url = base_url
        self._client = httpx.AsyncClient(base_url=base_url, timeout=120.0)

    async def __aenter__(self) -> "EvalApiClient":
        return self

    async def __aexit__(self, *args) -> None:
        await self._client.aclose()

    async def create_patient(self, name: str, dob: str, gender: str) -> dict:
        """POST /api/patients — returns patient dict with 'id'."""
        resp = await self._client.post(
            "/api/patients",
            json={"name": name, "dob": dob, "gender": gender},
        )
        resp.raise_for_status()
        return resp.json()

    async def form_response(
        self,
        session_id: int,
        form_id: str,
        answers: dict,
        template: str | None = None,
    ) -> None:
        """POST /api/chat/{session_id}/form-response."""
        payload: dict = {"form_id": form_id, "answers": answers}
        if template:
            payload["template"] = template
        resp = await self._client.post(
            f"/api/chat/{session_id}/form-response",
            json=payload,
        )
        resp.raise_for_status()

    async def chat(
        self,
        message: str,
        patient_id: int | None = None,
        visit_id: int | None = None,
        session_id: int | None = None,
        mode: str | None = None,
        user_id: str = "eval-user",
    ) -> ChatEvent:
        """POST /api/chat with streaming=True. Consumes SSE stream and returns ChatEvent."""
        payload: dict = {
            "message": message,
            "user_id": user_id,
            "stream": True,
        }
        if patient_id is not None:
            payload["patient_id"] = patient_id
        if visit_id is not None:
            payload["visit_id"] = visit_id
        if session_id is not None:
            payload["session_id"] = session_id
        if mode is not None:
            payload["mode"] = mode

        event = ChatEvent()
        async with self._client.stream("POST", "/api/chat", json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                try:
                    data = json.loads(line[6:])
                except json.JSONDecodeError:
                    continue

                if "chunk" in data:
                    event.chunks.append(data["chunk"])
                elif "tool_call" in data:
                    event.tool_calls.append(data["tool_call"])
                elif "session_id" in data:
                    event.session_id = data["session_id"]
                elif data.get("done"):
                    break

        return event
```

- [ ] **Step 2.4: Run test to verify it passes**

```bash
python -m pytest tests/eval/test_api_client.py -v
```

Expected: 4 PASSED

- [ ] **Step 2.5: Commit**

```bash
git add eval/api_client.py tests/eval/test_api_client.py
git commit -m "feat(eval): add API client with SSE stream parsing"
```

---

## Task 3: Patient Seeder

**Files:**
- Create: `eval/patient_seeder.py`
- Create: `tests/eval/test_patient_seeder.py`

- [ ] **Step 3.1: Write the failing test**

```python
# tests/eval/test_patient_seeder.py
import pytest
from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch, call
from eval.case_loader import EvalCase, PatientProfile, MedicalHistoryItem, IntakeScript, CaseExpected, TriageExpectation
from eval.patient_seeder import PatientSeeder


def _make_case(age: int = 55) -> EvalCase:
    return EvalCase(
        id="test-seed-001",
        description="Test seeding case",
        patient=PatientProfile(
            name="John Doe",
            age=age,
            sex="male",
            medical_history=[
                MedicalHistoryItem(type="chronic_condition", name="Hypertension"),
                MedicalHistoryItem(type="medication", name="Lisinopril", dosage="10mg daily"),
            ],
            allergies=["Penicillin"],
        ),
        intake=IntakeScript(turns=["I have chest pain"]),
        expected=CaseExpected(triage=TriageExpectation(department="Cardiology")),
    )


@pytest.mark.asyncio
async def test_seed_creates_patient_via_api():
    """seed() calls create_patient with name, calculated dob, and sex."""
    mock_api = AsyncMock()
    mock_api.create_patient.return_value = {"id": 42}
    mock_db = AsyncMock()

    seeder = PatientSeeder(db=mock_db, api_client=mock_api)
    case = _make_case(age=55)

    patient_id = await seeder.seed(case)

    assert patient_id == 42
    mock_api.create_patient.assert_called_once()
    call_args = mock_api.create_patient.call_args
    assert call_args.kwargs["name"] == "John Doe" or call_args.args[0] == "John Doe"


@pytest.mark.asyncio
async def test_seed_creates_medical_records_in_db():
    """seed() inserts MedicalRecord rows for history items and allergies."""
    mock_api = AsyncMock()
    mock_api.create_patient.return_value = {"id": 10}
    mock_db = AsyncMock()
    added_objects = []
    mock_db.add.side_effect = lambda obj: added_objects.append(obj)

    seeder = PatientSeeder(db=mock_db, api_client=mock_api)
    case = _make_case()

    await seeder.seed(case)

    # 2 history items + 1 allergy = 3 records
    assert len(added_objects) == 3
    record_types = [obj.record_type for obj in added_objects]
    assert "chronic_condition" in record_types
    assert "medication" in record_types
    assert "allergy" in record_types
    mock_db.commit.assert_called_once()


@pytest.mark.asyncio
async def test_teardown_deletes_records_and_patient():
    """teardown() executes DELETE for records then patient."""
    mock_db = AsyncMock()
    seeder = PatientSeeder(db=mock_db, api_client=AsyncMock())

    await seeder.teardown(patient_id=42)

    assert mock_db.execute.call_count >= 2  # at least records + patient
    mock_db.commit.assert_called_once()
```

- [ ] **Step 3.2: Run test to verify it fails**

```bash
python -m pytest tests/eval/test_patient_seeder.py -v
```

Expected: `ModuleNotFoundError: No module named 'eval.patient_seeder'`

- [ ] **Step 3.3: Create `eval/patient_seeder.py`**

```python
# eval/patient_seeder.py
from datetime import date

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from eval.api_client import EvalApiClient
from eval.case_loader import EvalCase
from src.models import MedicalRecord, Patient


class PatientSeeder:
    def __init__(self, db: AsyncSession, api_client: EvalApiClient) -> None:
        self._db = db
        self._api = api_client

    async def seed(self, case: EvalCase) -> int:
        """Seed patient + medical records. Returns patient_id."""
        today = date.today()
        # Use Jan 1 of birth year for simplicity
        dob = date(today.year - case.patient.age, 1, 1).isoformat()

        patient_data = await self._api.create_patient(
            name=case.patient.name,
            dob=dob,
            gender=case.patient.sex,
        )
        patient_id: int = patient_data["id"]

        for item in case.patient.medical_history:
            content = item.name
            if item.dosage:
                content = f"{item.name} - {item.dosage}"
            self._db.add(
                MedicalRecord(
                    patient_id=patient_id,
                    record_type=item.type,
                    content=content,
                )
            )

        for allergy in case.patient.allergies:
            self._db.add(
                MedicalRecord(
                    patient_id=patient_id,
                    record_type="allergy",
                    content=allergy,
                )
            )

        await self._db.commit()
        return patient_id

    async def teardown(self, patient_id: int) -> None:
        """Remove all seeded records and the patient row."""
        await self._db.execute(
            delete(MedicalRecord).where(MedicalRecord.patient_id == patient_id)
        )
        await self._db.execute(
            delete(Patient).where(Patient.id == patient_id)
        )
        await self._db.commit()
```

- [ ] **Step 3.4: Run test to verify it passes**

```bash
python -m pytest tests/eval/test_patient_seeder.py -v
```

Expected: 3 PASSED

- [ ] **Step 3.5: Commit**

```bash
git add eval/patient_seeder.py tests/eval/test_patient_seeder.py
git commit -m "feat(eval): add patient seeder with DB teardown"
```

---

## Task 4: Intake Simulator

**Files:**
- Create: `eval/intake_simulator.py`
- Create: `tests/eval/test_intake_simulator.py`

- [ ] **Step 4.1: Write the failing test**

```python
# tests/eval/test_intake_simulator.py
import pytest
from unittest.mock import AsyncMock
from eval.api_client import ChatEvent
from eval.case_loader import EvalCase, PatientProfile, IntakeScript, CaseExpected, TriageExpectation
from eval.intake_simulator import IntakeSimulator, TriageResult


def _make_case(turns: list[str]) -> EvalCase:
    from eval.case_loader import MedicalHistoryItem
    return EvalCase(
        id="sim-test-001",
        description="Test",
        patient=PatientProfile(name="John", age=55, sex="male"),
        intake=IntakeScript(turns=turns),
        expected=CaseExpected(triage=TriageExpectation(department="Cardiology")),
    )


def _make_event(content: str = "", tool_calls: list | None = None, session_id: int | None = None) -> ChatEvent:
    event = ChatEvent()
    event.chunks = [content] if content else []
    event.tool_calls = tool_calls or []
    event.session_id = session_id
    return event


@pytest.mark.asyncio
async def test_run_detects_complete_triage_tool_call():
    """run() returns TriageResult when complete_triage appears in tool_calls."""
    triage_tool_call = {
        "name": "complete_triage",
        "args": {"department": "Cardiology", "confidence": 0.88, "visit_id": 99},
    }
    mock_client = AsyncMock()
    mock_client.chat.side_effect = [
        _make_event("Tell me more", session_id=10),
        _make_event("Routing you now", tool_calls=[triage_tool_call], session_id=10),
    ]

    case = _make_case(turns=["I have chest pain", "It's crushing"])
    sim = IntakeSimulator(client=mock_client)
    result = await sim.run(case, patient_id=5)

    assert isinstance(result, TriageResult)
    assert result.department == "Cardiology"
    assert result.confidence == 0.88
    assert result.visit_id == 99
    assert result.session_id == 10
    assert len(result.agent_responses) == 2


@pytest.mark.asyncio
async def test_run_returns_none_department_when_triage_not_completed():
    """run() returns TriageResult with None department if complete_triage never fires."""
    mock_client = AsyncMock()
    mock_client.chat.return_value = _make_event("Please describe your symptoms", session_id=5)

    case = _make_case(turns=["I feel bad"])
    sim = IntakeSimulator(client=mock_client)
    result = await sim.run(case, patient_id=3)

    assert result.department is None
    assert result.confidence is None
    assert result.visit_id is None


@pytest.mark.asyncio
async def test_run_passes_patient_id_and_mode_to_chat():
    """run() sends patient_id and mode='intake' to every chat call."""
    mock_client = AsyncMock()
    mock_client.chat.return_value = _make_event("ok")

    case = _make_case(turns=["Hello", "I feel sick"])
    sim = IntakeSimulator(client=mock_client)
    await sim.run(case, patient_id=7)

    for call in mock_client.chat.call_args_list:
        assert call.kwargs.get("patient_id") == 7 or call.args[1] == 7
        assert call.kwargs.get("mode") == "intake" or "intake" in str(call)


@pytest.mark.asyncio
async def test_run_reuses_session_id_across_turns():
    """run() passes the session_id from the first response into subsequent calls."""
    mock_client = AsyncMock()
    mock_client.chat.side_effect = [
        _make_event("First response", session_id=99),
        _make_event("Second response"),
    ]

    case = _make_case(turns=["turn 1", "turn 2"])
    sim = IntakeSimulator(client=mock_client)
    await sim.run(case, patient_id=1)

    second_call_kwargs = mock_client.chat.call_args_list[1].kwargs
    assert second_call_kwargs.get("session_id") == 99
```

- [ ] **Step 4.2: Run test to verify it fails**

```bash
python -m pytest tests/eval/test_intake_simulator.py -v
```

Expected: `ModuleNotFoundError: No module named 'eval.intake_simulator'`

- [ ] **Step 4.3: Create `eval/intake_simulator.py`**

```python
# eval/intake_simulator.py
from dataclasses import dataclass, field

from eval.api_client import EvalApiClient
from eval.case_loader import EvalCase


@dataclass
class TriageResult:
    department: str | None
    confidence: float | None
    visit_id: int | None
    session_id: int | None
    agent_responses: list[str] = field(default_factory=list)
    tool_calls: list[dict] = field(default_factory=list)


class IntakeSimulator:
    def __init__(self, client: EvalApiClient) -> None:
        self._client = client

    async def run(self, case: EvalCase, patient_id: int) -> TriageResult:
        """Drive all intake turns. Returns TriageResult with routing info if triage completed."""
        session_id: int | None = None
        all_responses: list[str] = []
        all_tool_calls: list[dict] = []

        for turn in case.intake.turns:
            event = await self._client.chat(
                message=turn,
                patient_id=patient_id,
                session_id=session_id,
                mode="intake",
            )
            if event.session_id is not None:
                session_id = event.session_id
            all_responses.append(event.content)
            all_tool_calls.extend(event.tool_calls)

            triage_call = self._find_tool_call(event.tool_calls, "complete_triage")
            if triage_call:
                args = triage_call.get("args", {})
                return TriageResult(
                    department=args.get("department"),
                    confidence=args.get("confidence"),
                    visit_id=args.get("visit_id"),
                    session_id=session_id,
                    agent_responses=all_responses,
                    tool_calls=all_tool_calls,
                )

        return TriageResult(
            department=None,
            confidence=None,
            visit_id=None,
            session_id=session_id,
            agent_responses=all_responses,
            tool_calls=all_tool_calls,
        )

    def _find_tool_call(self, tool_calls: list[dict], name: str) -> dict | None:
        return next((tc for tc in tool_calls if tc.get("name") == name), None)
```

- [ ] **Step 4.4: Run test to verify it passes**

```bash
python -m pytest tests/eval/test_intake_simulator.py -v
```

Expected: 4 PASSED

- [ ] **Step 4.5: Commit**

```bash
git add eval/intake_simulator.py tests/eval/test_intake_simulator.py
git commit -m "feat(eval): add intake simulator with triage detection"
```

---

## Task 5: Doctor Simulator

**Files:**
- Create: `eval/doctor_simulator.py`
- Create: `tests/eval/test_doctor_simulator.py`

- [ ] **Step 5.1: Write the failing test**

```python
# tests/eval/test_doctor_simulator.py
import pytest
from unittest.mock import AsyncMock
from eval.api_client import ChatEvent
from eval.doctor_simulator import DoctorSimulator, DoctorResult


def _make_event(content: str, session_id: int | None = None) -> ChatEvent:
    event = ChatEvent()
    event.chunks = [content]
    event.session_id = session_id
    return event


@pytest.mark.asyncio
async def test_run_returns_doctor_result_with_all_outputs():
    """run() calls chat 3 times and returns DDx, history, and SOAP outputs."""
    mock_client = AsyncMock()
    mock_client.chat.side_effect = [
        _make_event("1. Acute MI (I21.9) - High\n2. Unstable Angina (I20.0) - Medium", session_id=20),
        _make_event("Chief Concerns: Chest pain\nRed Flags: Hypertension", session_id=20),
        _make_event("S: Patient reports crushing chest pain\nO: BP 150/90\nA: Likely ACS\nP: ECG, troponin", session_id=20),
    ]

    sim = DoctorSimulator(client=mock_client)
    result = await sim.run(patient_id=5, visit_id=10)

    assert isinstance(result, DoctorResult)
    assert "Acute MI" in result.ddx_output
    assert "Chief Concerns" in result.history_output
    assert "S:" in result.soap_output
    assert mock_client.chat.call_count == 3


@pytest.mark.asyncio
async def test_run_passes_patient_and_visit_id():
    """run() includes patient_id and visit_id in all chat calls."""
    mock_client = AsyncMock()
    mock_client.chat.return_value = _make_event("output")

    sim = DoctorSimulator(client=mock_client)
    await sim.run(patient_id=7, visit_id=3)

    for call in mock_client.chat.call_args_list:
        assert call.kwargs.get("patient_id") == 7
        assert call.kwargs.get("visit_id") == 3


@pytest.mark.asyncio
async def test_run_reuses_session_across_calls():
    """run() passes session_id from first response into subsequent calls."""
    mock_client = AsyncMock()
    mock_client.chat.side_effect = [
        _make_event("DDx output", session_id=55),
        _make_event("History output"),
        _make_event("SOAP output"),
    ]

    sim = DoctorSimulator(client=mock_client)
    await sim.run(patient_id=1)

    second_call = mock_client.chat.call_args_list[1].kwargs
    third_call = mock_client.chat.call_args_list[2].kwargs
    assert second_call.get("session_id") == 55
    assert third_call.get("session_id") == 55
```

- [ ] **Step 5.2: Run test to verify it fails**

```bash
python -m pytest tests/eval/test_doctor_simulator.py -v
```

Expected: `ModuleNotFoundError: No module named 'eval.doctor_simulator'`

- [ ] **Step 5.3: Create `eval/doctor_simulator.py`**

```python
# eval/doctor_simulator.py
from dataclasses import dataclass

from eval.api_client import EvalApiClient

DDX_PROMPT = (
    "Please generate a differential diagnosis for this patient based on their "
    "presentation. Include ICD-10 codes and rank by likelihood (High/Medium/Low)."
)
HISTORY_PROMPT = (
    "Please analyze this patient's full medical history. Summarize chronic conditions, "
    "medications, allergies, and flag any clinical red flags or concerns."
)
SOAP_PROMPT = (
    "Please write a SOAP note for this patient's current visit, covering Subjective, "
    "Objective, Assessment, and Plan sections."
)


@dataclass
class DoctorResult:
    ddx_output: str
    history_output: str
    soap_output: str
    session_id: int | None


class DoctorSimulator:
    def __init__(self, client: EvalApiClient) -> None:
        self._client = client

    async def run(self, patient_id: int, visit_id: int | None = None) -> DoctorResult:
        """Fire DDx, history analysis, and SOAP note requests. Returns all outputs."""
        session_id: int | None = None

        ddx_event = await self._client.chat(
            message=DDX_PROMPT,
            patient_id=patient_id,
            visit_id=visit_id,
            session_id=session_id,
            user_id="eval-doctor",
        )
        if ddx_event.session_id is not None:
            session_id = ddx_event.session_id

        history_event = await self._client.chat(
            message=HISTORY_PROMPT,
            patient_id=patient_id,
            visit_id=visit_id,
            session_id=session_id,
            user_id="eval-doctor",
        )
        if history_event.session_id is not None:
            session_id = history_event.session_id

        soap_event = await self._client.chat(
            message=SOAP_PROMPT,
            patient_id=patient_id,
            visit_id=visit_id,
            session_id=session_id,
            user_id="eval-doctor",
        )

        return DoctorResult(
            ddx_output=ddx_event.content,
            history_output=history_event.content,
            soap_output=soap_event.content,
            session_id=session_id,
        )
```

- [ ] **Step 5.4: Run test to verify it passes**

```bash
python -m pytest tests/eval/test_doctor_simulator.py -v
```

Expected: 3 PASSED

- [ ] **Step 5.5: Commit**

```bash
git add eval/doctor_simulator.py tests/eval/test_doctor_simulator.py
git commit -m "feat(eval): add doctor simulator for DDx, history, and SOAP"
```

---

## Task 6: Scorer

**Files:**
- Create: `eval/scorer.py`
- Create: `tests/eval/test_scorer.py`

- [ ] **Step 6.1: Write the failing test**

```python
# tests/eval/test_scorer.py
import pytest
from eval.case_loader import (
    EvalCase, PatientProfile, IntakeScript, CaseExpected,
    TriageExpectation, DdxExpectation, HistoryExpectation, SoapExpectation,
)
from eval.intake_simulator import TriageResult
from eval.doctor_simulator import DoctorResult
from eval.scorer import score_triage, score_ddx, score_history, score_soap, score_case


def _base_case() -> EvalCase:
    return EvalCase(
        id="score-test-001",
        description="Scorer test case",
        patient=PatientProfile(name="Jane", age=40, sex="female"),
        intake=IntakeScript(turns=["I have headache"]),
        expected=CaseExpected(
            triage=TriageExpectation(
                department="Neurology",
                min_confidence=0.7,
                red_flags=["thunderclap", "worst headache"],
            ),
            ddx=DdxExpectation(
                top_3_must_include=["Subarachnoid Hemorrhage", "Migraine"],
                icd10_present=True,
            ),
            history_analysis=HistoryExpectation(
                must_mention=["Migraines", "Sumatriptan"],
                red_flags_expected=["thunderclap"],
            ),
            soap_note=SoapExpectation(
                required_sections=["S", "O", "A", "P"],
                assessment_must_mention=["headache"],
            ),
        ),
    )


def test_score_triage_passes_when_department_matches_and_confidence_ok():
    case = _base_case()
    triage = TriageResult(
        department="Neurology",
        confidence=0.85,
        visit_id=1,
        session_id=1,
        agent_responses=["thunderclap headache is very serious, worst headache of life"],
        tool_calls=[],
    )
    score = score_triage(case, triage)
    assert score.passed is True
    assert score.details["department_match"] is True
    assert score.details["confidence_ok"] is True


def test_score_triage_fails_when_wrong_department():
    case = _base_case()
    triage = TriageResult(
        department="Cardiology",
        confidence=0.8,
        visit_id=1,
        session_id=1,
        agent_responses=["routing to cardiology"],
        tool_calls=[],
    )
    score = score_triage(case, triage)
    assert score.passed is False
    assert score.details["department_match"] is False


def test_score_triage_fails_when_confidence_below_threshold():
    case = _base_case()
    triage = TriageResult(
        department="Neurology",
        confidence=0.6,
        visit_id=1,
        session_id=1,
        agent_responses=[],
        tool_calls=[],
    )
    score = score_triage(case, triage)
    assert score.passed is False
    assert score.details["confidence_ok"] is False


def test_score_ddx_passes_when_diagnosis_in_top_3():
    case = _base_case()
    output = "1. Subarachnoid Hemorrhage (I60.9) - High\n2. Migraine (G43.909) - Medium"
    score = score_ddx(case, output)
    assert score.passed is True
    assert score.details["top_3_hit"] is True
    assert score.details["icd10_present"] is True


def test_score_ddx_fails_when_diagnosis_missing():
    case = _base_case()
    output = "1. Tension headache - High\n2. Sinusitis - Low"
    score = score_ddx(case, output)
    assert score.passed is False
    assert score.details["top_3_hit"] is False


def test_score_ddx_fails_when_icd10_missing():
    case = _base_case()
    output = "1. Subarachnoid Hemorrhage - High"
    score = score_ddx(case, output)
    assert score.passed is False
    assert score.details["icd10_present"] is False


def test_score_history_passes_when_all_items_mentioned():
    case = _base_case()
    output = "Patient has chronic Migraines. Current medication: Sumatriptan 50mg as needed."
    score = score_history(case, output)
    assert score.passed is True
    assert score.details["mentions_missing"] == []


def test_score_history_fails_when_item_missing():
    case = _base_case()
    output = "Patient has migraines."
    score = score_history(case, output)
    assert score.passed is False
    assert "Sumatriptan" in score.details["mentions_missing"]


def test_score_soap_passes_when_all_sections_present():
    case = _base_case()
    output = "S: Patient reports headache\nO: Neuro exam normal\nA: Likely subarachnoid\nP: CT scan"
    score = score_soap(case, output)
    assert score.passed is True
    assert score.details["sections_missing"] == []


def test_score_soap_fails_when_section_missing():
    case = _base_case()
    output = "S: Patient reports headache\nA: Likely migraine"
    score = score_soap(case, output)
    assert score.passed is False
    assert "O" in score.details["sections_missing"] or "P" in score.details["sections_missing"]


def test_score_case_aggregates_all_stages():
    case = _base_case()
    triage = TriageResult(department="Neurology", confidence=0.9, visit_id=1, session_id=1, agent_responses=[], tool_calls=[])
    doctor = DoctorResult(
        ddx_output="Subarachnoid Hemorrhage (I60.9)",
        history_output="Migraines, Sumatriptan",
        soap_output="S: headache\nO: ok\nA: neuro\nP: CT",
        session_id=1,
    )
    case_score = score_case(case, triage, doctor)
    assert case_score.case_id == "score-test-001"
    assert case_score.all_passed is True
```

- [ ] **Step 6.2: Run test to verify it fails**

```bash
python -m pytest tests/eval/test_scorer.py -v
```

Expected: `ModuleNotFoundError: No module named 'eval.scorer'`

- [ ] **Step 6.3: Create `eval/scorer.py`**

```python
# eval/scorer.py
import re
from dataclasses import dataclass

from eval.case_loader import EvalCase
from eval.doctor_simulator import DoctorResult
from eval.intake_simulator import TriageResult

ICD10_PATTERN = re.compile(r"[A-Z]\d{2}\.?\d*")


@dataclass
class StageScore:
    passed: bool
    details: dict


@dataclass
class CaseScore:
    case_id: str
    triage: StageScore
    ddx: StageScore
    history: StageScore
    soap: StageScore

    @property
    def all_passed(self) -> bool:
        return all([self.triage.passed, self.ddx.passed, self.history.passed, self.soap.passed])


def score_triage(case: EvalCase, result: TriageResult) -> StageScore:
    exp = case.expected.triage
    details: dict = {}

    dept_match = result.department is not None and result.department.lower() == exp.department.lower()
    details["department_match"] = dept_match
    details["expected_department"] = exp.department
    details["actual_department"] = result.department

    conf_ok = result.confidence is not None and result.confidence >= exp.min_confidence
    details["confidence_ok"] = conf_ok
    details["actual_confidence"] = result.confidence

    all_text = " ".join(result.agent_responses).lower()
    red_flags_found = [flag for flag in exp.red_flags if flag.lower() in all_text]
    details["red_flags_found"] = red_flags_found
    details["red_flags_expected"] = exp.red_flags

    return StageScore(passed=dept_match and conf_ok, details=details)


def score_ddx(case: EvalCase, output: str) -> StageScore:
    exp = case.expected.ddx
    details: dict = {}

    output_lower = output.lower()
    top_3_hit = any(d.lower() in output_lower for d in exp.top_3_must_include)
    details["top_3_hit"] = top_3_hit
    details["must_include"] = exp.top_3_must_include

    icd10_ok = not exp.icd10_present or bool(ICD10_PATTERN.search(output))
    details["icd10_present"] = icd10_ok

    return StageScore(passed=top_3_hit and icd10_ok, details=details)


def score_history(case: EvalCase, output: str) -> StageScore:
    exp = case.expected.history_analysis
    output_lower = output.lower()
    details: dict = {}

    mentions_found = [item for item in exp.must_mention if item.lower() in output_lower]
    mentions_missing = [item for item in exp.must_mention if item not in mentions_found]
    details["mentions_found"] = mentions_found
    details["mentions_missing"] = mentions_missing

    red_flags_found = [flag for flag in exp.red_flags_expected if flag.lower() in output_lower]
    details["red_flags_found"] = red_flags_found

    return StageScore(passed=len(mentions_missing) == 0, details=details)


def score_soap(case: EvalCase, output: str) -> StageScore:
    exp = case.expected.soap_note
    output_upper = output.upper()
    details: dict = {}

    sections_found = [s for s in exp.required_sections if s in output_upper]
    sections_missing = [s for s in exp.required_sections if s not in sections_found]
    details["sections_found"] = sections_found
    details["sections_missing"] = sections_missing

    output_lower = output.lower()
    assessment_found = [kw for kw in exp.assessment_must_mention if kw.lower() in output_lower]
    details["assessment_keywords_found"] = assessment_found

    return StageScore(passed=len(sections_missing) == 0, details=details)


def score_case(case: EvalCase, triage: TriageResult, doctor: DoctorResult) -> CaseScore:
    return CaseScore(
        case_id=case.id,
        triage=score_triage(case, triage),
        ddx=score_ddx(case, doctor.ddx_output),
        history=score_history(case, doctor.history_output),
        soap=score_soap(case, doctor.soap_output),
    )
```

- [ ] **Step 6.4: Run test to verify it passes**

```bash
python -m pytest tests/eval/test_scorer.py -v
```

Expected: 11 PASSED

- [ ] **Step 6.5: Commit**

```bash
git add eval/scorer.py tests/eval/test_scorer.py
git commit -m "feat(eval): add rule-based scorer for all 4 stages"
```

---

## Task 7: Runner + Report

**Files:**
- Create: `eval/report.py`
- Create: `eval/runner.py`
- Create: `eval/results/.gitkeep`
- Modify: `.gitignore` (add `eval/results/*.json` and `eval/results/*.md`)
- Create: `tests/eval/test_report.py`

- [ ] **Step 7.1: Write the failing test**

```python
# tests/eval/test_report.py
import json
from pathlib import Path
from eval.scorer import CaseScore, StageScore
from eval.report import generate_report


def _make_score(case_id: str, all_pass: bool) -> CaseScore:
    s = StageScore(passed=all_pass, details={})
    return CaseScore(case_id=case_id, triage=s, ddx=s, history=s, soap=s)


def test_generate_report_writes_json_file(tmp_path):
    scores = [_make_score("case-001", True), _make_score("case-002", False)]
    json_path = generate_report(scores, results_dir=tmp_path)

    assert json_path.exists()
    data = json.loads(json_path.read_text())
    assert data["summary"]["total_cases"] == 2
    assert data["summary"]["triage_accuracy"] == 0.5
    assert len(data["cases"]) == 2


def test_generate_report_writes_markdown_file(tmp_path):
    scores = [_make_score("case-001", True)]
    json_path = generate_report(scores, results_dir=tmp_path)

    md_path = json_path.with_suffix(".md")
    assert md_path.exists()
    content = md_path.read_text()
    assert "case-001" in content
    assert "Triage accuracy" in content


def test_generate_report_100_percent_when_all_pass(tmp_path):
    scores = [_make_score(f"case-{i}", True) for i in range(5)]
    json_path = generate_report(scores, results_dir=tmp_path)

    data = json.loads(json_path.read_text())
    assert data["summary"]["triage_accuracy"] == 1.0
    assert data["summary"]["ddx_recall_at_3"] == 1.0


def test_generate_report_zero_percent_when_all_fail(tmp_path):
    scores = [_make_score("case-001", False)]
    json_path = generate_report(scores, results_dir=tmp_path)

    data = json.loads(json_path.read_text())
    assert data["summary"]["triage_accuracy"] == 0.0
```

- [ ] **Step 7.2: Run test to verify it fails**

```bash
python -m pytest tests/eval/test_report.py -v
```

Expected: `ModuleNotFoundError: No module named 'eval.report'`

- [ ] **Step 7.3: Create `eval/report.py`**

```python
# eval/report.py
import json
from datetime import datetime
from pathlib import Path

from eval.scorer import CaseScore

DEFAULT_RESULTS_DIR = Path(__file__).parent / "results"


def generate_report(
    scores: list[CaseScore],
    results_dir: Path = DEFAULT_RESULTS_DIR,
) -> Path:
    """Write JSON + Markdown report. Returns path to JSON file."""
    results_dir.mkdir(parents=True, exist_ok=True)
    run_id = datetime.now().strftime("%Y-%m-%d-%H-%M")

    total = len(scores)
    triage_acc = sum(1 for s in scores if s.triage.passed) / total if total else 0.0
    ddx_acc = sum(1 for s in scores if s.ddx.passed) / total if total else 0.0
    history_acc = sum(1 for s in scores if s.history.passed) / total if total else 0.0
    soap_acc = sum(1 for s in scores if s.soap.passed) / total if total else 0.0

    report = {
        "run_id": run_id,
        "summary": {
            "total_cases": total,
            "triage_accuracy": triage_acc,
            "ddx_recall_at_3": ddx_acc,
            "history_pass_rate": history_acc,
            "soap_format_pass_rate": soap_acc,
        },
        "cases": [
            {
                "id": s.case_id,
                "all_passed": s.all_passed,
                "triage": {"pass": s.triage.passed, **s.triage.details},
                "ddx": {"pass": s.ddx.passed, **s.ddx.details},
                "history": {"pass": s.history.passed, **s.history.details},
                "soap": {"pass": s.soap.passed, **s.soap.details},
            }
            for s in scores
        ],
    }

    json_path = results_dir / f"{run_id}.json"
    json_path.write_text(json.dumps(report, indent=2))

    def icon(b: bool) -> str:
        return "PASS" if b else "FAIL"

    md_lines = [
        f"# Eval Run {run_id}",
        "",
        "## Summary",
        "",
        "| Metric | Score |",
        "|--------|-------|",
        f"| Triage accuracy | {triage_acc:.0%} |",
        f"| DDx recall@3 | {ddx_acc:.0%} |",
        f"| History pass rate | {history_acc:.0%} |",
        f"| SOAP format pass rate | {soap_acc:.0%} |",
        "",
        "## Cases",
        "",
        "| Case | Triage | DDx | History | SOAP |",
        "|------|--------|-----|---------|------|",
        *[
            f"| {s.case_id} | {icon(s.triage.passed)} | {icon(s.ddx.passed)} | {icon(s.history.passed)} | {icon(s.soap.passed)} |"
            for s in scores
        ],
    ]
    (json_path.with_suffix(".md")).write_text("\n".join(md_lines))

    return json_path
```

- [ ] **Step 7.4: Run test to verify it passes**

```bash
python -m pytest tests/eval/test_report.py -v
```

Expected: 4 PASSED

- [ ] **Step 7.5: Create `eval/results/.gitkeep`**

```bash
touch eval/results/.gitkeep
```

- [ ] **Step 7.6: Add results to .gitignore**

Append to `.gitignore`:
```
eval/results/*.json
eval/results/*.md
```

- [ ] **Step 7.7: Create `eval/runner.py`**

```python
# eval/runner.py
"""
Medera Agent Evaluation Runner

Usage:
  python eval/runner.py                          # run all cases
  python eval/runner.py --case cardiology-chest-pain-001
  python eval/runner.py --judge                  # enable LLM-as-judge scoring

Prerequisites:
  - API server running at EVAL_BASE_URL (default: http://localhost:8000)
  - DATABASE_URL set to the PostgreSQL connection string
"""
import asyncio
import argparse
import os
from pathlib import Path

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from eval.api_client import EvalApiClient
from eval.case_loader import EvalCase, load_all_cases, load_case
from eval.doctor_simulator import DoctorSimulator
from eval.intake_simulator import IntakeSimulator
from eval.patient_seeder import PatientSeeder
from eval.report import generate_report
from eval.scorer import CaseScore, score_case

CASES_DIR = Path(__file__).parent / "cases"
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost/medera",
)


async def run_case(
    case: EvalCase,
    client: EvalApiClient,
    engine,
) -> CaseScore:
    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async with session_factory() as db:
        seeder = PatientSeeder(db=db, api_client=client)
        patient_id = await seeder.seed(case)

        try:
            intake_result = await IntakeSimulator(client=client).run(case, patient_id)
            doctor_result = await DoctorSimulator(client=client).run(
                patient_id=patient_id,
                visit_id=intake_result.visit_id,
            )
            return score_case(case, intake_result, doctor_result)
        finally:
            await seeder.teardown(patient_id)


async def main() -> None:
    parser = argparse.ArgumentParser(description="Medera Agent Evaluation Runner")
    parser.add_argument("--case", help="Run a specific case by ID (without .yaml extension)")
    parser.add_argument("--judge", action="store_true", help="Enable LLM-as-judge scoring (requires ANTHROPIC_API_KEY)")
    args = parser.parse_args()

    base_url = os.getenv("EVAL_BASE_URL", "http://localhost:8000")
    engine = create_async_engine(DATABASE_URL)

    if args.case:
        cases = [load_case(CASES_DIR / f"{args.case}.yaml")]
    else:
        cases = load_all_cases(CASES_DIR)

    print(f"Running {len(cases)} case(s) against {base_url}")

    scores: list[CaseScore] = []
    async with EvalApiClient(base_url) as client:
        for case in cases:
            print(f"  [{case.id}] ...", end=" ", flush=True)
            try:
                score = await run_case(case, client, engine)
                scores.append(score)
                status = "PASS" if score.all_passed else "FAIL"
                print(
                    f"{status} "
                    f"(triage={score.triage.passed} "
                    f"ddx={score.ddx.passed} "
                    f"history={score.history.passed} "
                    f"soap={score.soap.passed})"
                )
            except Exception as exc:
                print(f"ERROR: {exc}")

    if scores:
        json_path = generate_report(scores)
        print(f"\nReport: {json_path}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 7.8: Run all eval tests to verify no regressions**

```bash
python -m pytest tests/eval/ -v
```

Expected: all tests pass

- [ ] **Step 7.9: Commit**

```bash
git add eval/report.py eval/runner.py eval/results/.gitkeep tests/eval/test_report.py .gitignore
git commit -m "feat(eval): add runner CLI and report generator"
```

---

## Task 8: LLM Judge + Rubrics + Remaining 17 Cases

**Files:**
- Create: `eval/judge.py`
- Create: `eval/rubrics/ddx.md`
- Create: `eval/rubrics/history.md`
- Create: `eval/rubrics/soap.md`
- Create: 17 remaining YAML case files

- [ ] **Step 8.1: Create `eval/rubrics/ddx.md`**

```markdown
# DDx Scoring Rubric

Score 1–5 on each dimension. Be strict — only give 5 if fully met.

## Clinical Accuracy (1–5)
- 5: All diagnoses are clinically plausible given the presentation; most likely is ranked first
- 4: Minor ranking error or one implausible diagnosis
- 3: Correct diagnoses present but poor ranking or missing key diagnosis
- 2: Major diagnostic error; critical diagnosis absent for obvious presentation
- 1: Output is not clinically coherent

## Completeness (1–5)
- 5: 3–6 diagnoses with ICD-10 codes, likelihood (High/Medium/Low), supporting evidence, and red flags
- 4: Missing one element (e.g., no red flags)
- 3: Missing ICD-10 or evidence for all diagnoses
- 2: Only 1–2 diagnoses, or missing most required fields
- 1: Less than one complete diagnosis entry

## Red Flag Identification (1–5)
- 5: All clinically significant red flags explicitly called out
- 4: Most red flags noted; one missed
- 3: Some red flags noted; important one missed
- 2: Red flags not identified despite obvious clinical triggers
- 1: No red flag discussion

## Format Adherence (1–5)
- 5: Clear numbered list, consistent structure, ICD-10 codes present
- 4: Mostly structured with minor inconsistency
- 3: Partially structured
- 2: Free text, not a structured DDx list
- 1: Unreadable or not a DDx
```

- [ ] **Step 8.2: Create `eval/rubrics/history.md`**

```markdown
# Medical History Analysis Scoring Rubric

Score 1–5 on each dimension.

## Clinical Accuracy (1–5)
- 5: Accurately summarizes all conditions, medications, allergies with correct clinical context
- 4: Minor inaccuracy or missed nuance
- 3: Key information present but some inaccuracy
- 2: Significant omissions or clinical errors
- 1: Factually incorrect or generic (not based on patient's actual records)

## Completeness (1–5)
- 5: Covers all sections: Chief Concerns, Chronic Conditions, Medications, Allergy Profile, Red Flags, Recommendations
- 4: Missing one section
- 3: Missing two sections
- 2: Only covers 1–2 sections
- 1: No structured analysis

## Red Flag Identification (1–5)
- 5: All clinically significant interactions, contraindications, or dangerous patterns explicitly flagged
- 4: Most flagged; one missed
- 3: Some flagged; important one missed
- 2: Known dangerous pattern not flagged
- 1: No red flags identified when they exist

## Specificity (1–5)
- 5: All statements reference the specific patient's data (names, dosages, dates)
- 4: Mostly specific; one generic statement
- 3: Mix of specific and generic
- 2: Mostly generic advice not tied to this patient
- 1: Entirely generic — could apply to any patient
```

- [ ] **Step 8.3: Create `eval/rubrics/soap.md`**

```markdown
# SOAP Note Scoring Rubric

Score 1–5 on each dimension.

## Clinical Accuracy (1–5)
- 5: Assessment is clinically sound given the subjective and objective findings; plan follows evidence-based guidelines
- 4: Minor clinical gap
- 3: Some clinical content but notable gap in assessment or plan
- 2: Assessment not supported by findings; plan inappropriate
- 1: Clinically incorrect

## Completeness (1–5)
- 5: All four SOAP sections present with substantive content in each
- 4: All sections present; one is thin
- 3: All sections present; two or more are thin
- 2: One section missing
- 1: Two or more sections missing

## Format Adherence (1–5)
- 5: Clear S/O/A/P headers, appropriate clinical vocabulary, concise
- 4: Headers present; minor formatting issue
- 3: Sections identifiable but not clearly labeled
- 2: Free text without SOAP structure
- 1: Not a clinical note

## Specificity (1–5)
- 5: All statements specific to this patient (vitals, symptoms, history referenced)
- 4: Mostly specific; one generic statement
- 3: Mix of specific and generic
- 2: Mostly generic
- 1: Entirely generic template
```

- [ ] **Step 8.4: Create `eval/judge.py`**

```python
# eval/judge.py
"""Optional LLM-as-judge scoring using Claude claude-sonnet-4-6.

Enable with: python eval/runner.py --judge
Requires: ANTHROPIC_API_KEY environment variable
"""
import json
import re
from pathlib import Path

import anthropic

RUBRICS_DIR = Path(__file__).parent / "rubrics"


def _load_rubric(name: str) -> str:
    return (RUBRICS_DIR / f"{name}.md").read_text()


def _call_judge(prompt: str) -> dict:
    client = anthropic.Anthropic()
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    text = response.content[0].text
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group())
    return {}


def judge_ddx(patient_summary: str, ddx_output: str) -> dict:
    """Score DDx output. Returns dict with clinical_accuracy, completeness, red_flag_identification, format (each 1-5)."""
    rubric = _load_rubric("ddx")
    prompt = f"""You are a senior physician evaluating an AI-generated differential diagnosis.

Patient context: {patient_summary}

AI DDx output:
{ddx_output}

Scoring rubric:
{rubric}

Return ONLY a JSON object (no other text) with these keys:
- clinical_accuracy: integer 1-5
- completeness: integer 1-5
- red_flag_identification: integer 1-5
- format: integer 1-5
- reasoning: string (one sentence)"""
    return _call_judge(prompt)


def judge_history(patient_summary: str, history_output: str) -> dict:
    """Score medical history analysis. Returns dict with clinical_accuracy, completeness, red_flag_identification, specificity (each 1-5)."""
    rubric = _load_rubric("history")
    prompt = f"""You are a senior physician evaluating an AI-generated medical history analysis.

Patient context: {patient_summary}

AI history analysis output:
{history_output}

Scoring rubric:
{rubric}

Return ONLY a JSON object (no other text) with these keys:
- clinical_accuracy: integer 1-5
- completeness: integer 1-5
- red_flag_identification: integer 1-5
- specificity: integer 1-5
- reasoning: string (one sentence)"""
    return _call_judge(prompt)


def judge_soap(patient_summary: str, soap_output: str) -> dict:
    """Score SOAP note. Returns dict with clinical_accuracy, completeness, format, specificity (each 1-5)."""
    rubric = _load_rubric("soap")
    prompt = f"""You are a senior physician evaluating an AI-generated SOAP note.

Patient context: {patient_summary}

AI SOAP note:
{soap_output}

Scoring rubric:
{rubric}

Return ONLY a JSON object (no other text) with these keys:
- clinical_accuracy: integer 1-5
- completeness: integer 1-5
- format: integer 1-5
- specificity: integer 1-5
- reasoning: string (one sentence)"""
    return _call_judge(prompt)
```

- [ ] **Step 8.5: Create the remaining 17 YAML cases**

Create `eval/cases/cardiology-palpitations.yaml`:
```yaml
id: cardiology-palpitations-001
description: "45-year-old female with rapid palpitations and lightheadedness"
patient:
  name: "Maria Lopez"
  age: 45
  sex: female
  medical_history:
    - type: chronic_condition
      name: Hyperthyroidism
    - type: medication
      name: Methimazole
      dosage: "10mg daily"
  allergies: []
intake:
  turns:
    - "My heart is racing and I feel very lightheaded"
    - "It started suddenly about an hour ago"
    - "I have hyperthyroidism and take methimazole"
    - "No chest pain but I'm short of breath"
expected:
  triage:
    department: Cardiology
    min_confidence: 0.7
    red_flags: [palpitations, lightheadedness]
  ddx:
    top_3_must_include: ["Atrial Fibrillation", "Supraventricular Tachycardia", "Thyroid"]
    icd10_present: true
  history_analysis:
    must_mention: [Hyperthyroidism, Methimazole]
    red_flags_expected: [thyroid, palpitations]
  soap_note:
    required_sections: [S, O, A, P]
    assessment_must_mention: [cardiac, palpitation]
```

Create `eval/cases/neurology-stroke-symptoms.yaml`:
```yaml
id: neurology-stroke-symptoms-001
description: "72-year-old male with transient vision loss and confusion"
patient:
  name: "Harold Bennett"
  age: 72
  sex: male
  medical_history:
    - type: chronic_condition
      name: Hypertension
    - type: chronic_condition
      name: Hyperlipidemia
    - type: medication
      name: Atorvastatin
      dosage: "40mg daily"
    - type: medication
      name: Amlodipine
      dosage: "5mg daily"
  allergies: [Aspirin]
intake:
  turns:
    - "I suddenly lost vision in my right eye for a few minutes, it came back"
    - "I was also confused for a bit but I'm clearer now"
    - "I have high blood pressure and high cholesterol"
    - "I'm allergic to aspirin"
expected:
  triage:
    department: Neurology
    min_confidence: 0.75
    red_flags: [transient vision loss, TIA, stroke]
  ddx:
    top_3_must_include: ["TIA", "Transient Ischemic Attack", "Retinal Artery Occlusion"]
    icd10_present: true
  history_analysis:
    must_mention: [Hypertension, Aspirin, Atorvastatin]
    red_flags_expected: [TIA, aspirin allergy, anticoagulation]
  soap_note:
    required_sections: [S, O, A, P]
    assessment_must_mention: [TIA, neurolog]
```

Create `eval/cases/gastro-abdominal-pain.yaml`:
```yaml
id: gastro-abdominal-pain-001
description: "32-year-old female with right lower quadrant pain and nausea"
patient:
  name: "Emma Watson"
  age: 32
  sex: female
  medical_history: []
  allergies: [Ibuprofen]
intake:
  turns:
    - "I have sharp pain in my lower right abdomen"
    - "It started yesterday and has gotten worse, maybe 7 out of 10"
    - "I feel nauseous and had a low fever of 37.8"
    - "No vomiting, last period was 3 weeks ago"
expected:
  triage:
    department: Gastroenterology
    min_confidence: 0.7
    red_flags: [right lower quadrant, appendicitis]
  ddx:
    top_3_must_include: ["Appendicitis", "Ovarian Cyst", "Ectopic Pregnancy"]
    icd10_present: true
  history_analysis:
    must_mention: [Ibuprofen]
    red_flags_expected: [appendicitis, ibuprofen allergy]
  soap_note:
    required_sections: [S, O, A, P]
    assessment_must_mention: [abdominal, append]
```

Create `eval/cases/gastro-nausea-vomiting.yaml`:
```yaml
id: gastro-nausea-vomiting-001
description: "50-year-old male with persistent nausea, vomiting, and epigastric pain"
patient:
  name: "David Kim"
  age: 50
  sex: male
  medical_history:
    - type: chronic_condition
      name: GERD
    - type: medication
      name: Omeprazole
      dosage: "20mg daily"
  allergies: []
intake:
  turns:
    - "I've been vomiting repeatedly and have bad stomach pain above my belly button"
    - "It's been 2 days, pain is 6 out of 10"
    - "I have GERD and take omeprazole but this is worse than usual"
    - "I drank heavily at a party 3 days ago"
expected:
  triage:
    department: Gastroenterology
    min_confidence: 0.7
    red_flags: [persistent vomiting, alcohol, epigastric]
  ddx:
    top_3_must_include: ["Acute Pancreatitis", "Gastritis", "Peptic Ulcer"]
    icd10_present: true
  history_analysis:
    must_mention: [GERD, Omeprazole]
    red_flags_expected: [alcohol, pancreatitis]
  soap_note:
    required_sections: [S, O, A, P]
    assessment_must_mention: [gastro, nausea]
```

Create `eval/cases/ent-sore-throat.yaml`:
```yaml
id: ent-sore-throat-001
description: "24-year-old female with severe sore throat and high fever"
patient:
  name: "Sophie Turner"
  age: 24
  sex: female
  medical_history: []
  allergies: []
intake:
  turns:
    - "I have a very sore throat and high fever of 39.5"
    - "It's been 2 days, I can barely swallow"
    - "My lymph nodes are swollen"
    - "No cough, no runny nose"
expected:
  triage:
    department: ENT
    min_confidence: 0.7
    red_flags: [high fever, difficulty swallowing]
  ddx:
    top_3_must_include: ["Streptococcal Pharyngitis", "Peritonsillar Abscess", "Mononucleosis"]
    icd10_present: true
  history_analysis:
    must_mention: []
    red_flags_expected: [peritonsillar, airway]
  soap_note:
    required_sections: [S, O, A, P]
    assessment_must_mention: [throat, pharyngi]
```

Create `eval/cases/ent-ear-pain.yaml`:
```yaml
id: ent-ear-pain-001
description: "8-year-old with ear pain and discharge (presented by parent)"
patient:
  name: "Tommy Chen"
  age: 8
  sex: male
  medical_history:
    - type: chronic_condition
      name: Recurrent Otitis Media
  allergies: [Amoxicillin]
intake:
  turns:
    - "My son has been crying about ear pain for 2 days"
    - "There's some yellowish discharge from his right ear"
    - "He had otitis media before. He's allergic to amoxicillin"
    - "Fever of 38.5, no hearing loss that I can tell"
expected:
  triage:
    department: ENT
    min_confidence: 0.7
    red_flags: [ear discharge, pediatric, amoxicillin allergy]
  ddx:
    top_3_must_include: ["Otitis Media", "Otitis Externa", "Perforated Tympanic Membrane"]
    icd10_present: true
  history_analysis:
    must_mention: [Otitis Media, Amoxicillin]
    red_flags_expected: [amoxicillin allergy, alternative antibiotic]
  soap_note:
    required_sections: [S, O, A, P]
    assessment_must_mention: [ear, otitis]
```

Create `eval/cases/emergency-chest-pain-high-risk.yaml`:
```yaml
id: emergency-chest-pain-high-risk-001
description: "60-year-old male diabetic with silent MI presentation — atypical chest pain"
patient:
  name: "George Miller"
  age: 60
  sex: male
  medical_history:
    - type: chronic_condition
      name: Type 2 Diabetes
    - type: chronic_condition
      name: Hypertension
    - type: medication
      name: Metformin
      dosage: "500mg twice daily"
    - type: medication
      name: Amlodipine
      dosage: "10mg daily"
  allergies: []
intake:
  turns:
    - "I just feel very tired and have some jaw pain"
    - "Also a bit of indigestion and shortness of breath"
    - "No chest pain exactly, maybe some pressure"
    - "I'm diabetic and have high blood pressure"
expected:
  triage:
    department: Emergency
    min_confidence: 0.75
    red_flags: [diabetic, atypical MI, jaw pain, shortness of breath]
  ddx:
    top_3_must_include: ["Myocardial Infarction", "Acute Coronary Syndrome", "NSTEMI"]
    icd10_present: true
  history_analysis:
    must_mention: [Diabetes, Hypertension, Metformin]
    red_flags_expected: [silent MI, diabetic neuropathy, atypical]
  soap_note:
    required_sections: [S, O, A, P]
    assessment_must_mention: [cardiac, MI]
```

Create `eval/cases/internal-fatigue-diabetes.yaml`:
```yaml
id: internal-fatigue-diabetes-001
description: "58-year-old female with extreme fatigue, polyuria, and polydipsia"
patient:
  name: "Linda Park"
  age: 58
  sex: female
  medical_history:
    - type: chronic_condition
      name: Obesity
  allergies: []
intake:
  turns:
    - "I've been extremely tired for the past month and urinating very frequently"
    - "I'm also very thirsty all the time and my vision is blurry"
    - "I haven't been diagnosed with diabetes but my mother has it"
    - "I've gained weight this year"
expected:
  triage:
    department: Internal Medicine
    min_confidence: 0.7
    red_flags: [polyuria, polydipsia, new diabetes]
  ddx:
    top_3_must_include: ["Type 2 Diabetes Mellitus", "Diabetes Insipidus", "Hypothyroidism"]
    icd10_present: true
  history_analysis:
    must_mention: [Obesity]
    red_flags_expected: [undiagnosed diabetes, family history]
  soap_note:
    required_sections: [S, O, A, P]
    assessment_must_mention: [diabetes, metabolic]
```

Create `eval/cases/internal-fever-unknown.yaml`:
```yaml
id: internal-fever-unknown-001
description: "35-year-old male with fever of unknown origin for 3 weeks"
patient:
  name: "Alex Nguyen"
  age: 35
  sex: male
  medical_history:
    - type: chronic_condition
      name: HIV (well-controlled)
    - type: medication
      name: Bictegravir/Emtricitabine/Tenofovir
      dosage: "1 tablet daily"
  allergies: []
intake:
  turns:
    - "I've had a fever between 38 and 39 degrees for 3 weeks"
    - "Night sweats, weight loss of 4 kg, and fatigue"
    - "I'm HIV positive but well controlled on ART"
    - "No cough, no specific localized pain"
expected:
  triage:
    department: Internal Medicine
    min_confidence: 0.7
    red_flags: [fever unknown origin, HIV, weight loss, night sweats]
  ddx:
    top_3_must_include: ["Lymphoma", "Tuberculosis", "Opportunistic Infection"]
    icd10_present: true
  history_analysis:
    must_mention: [HIV, Bictegravir]
    red_flags_expected: [immunocompromised, opportunistic infection]
  soap_note:
    required_sections: [S, O, A, P]
    assessment_must_mention: [fever, immunocompromised]
```

Create `eval/cases/returning-patient-cardio.yaml`:
```yaml
id: returning-patient-cardio-001
description: "Returning patient, 62yo male with heart failure, presenting with worsening edema"
patient:
  name: "Frank Thompson"
  age: 62
  sex: male
  medical_history:
    - type: chronic_condition
      name: Heart Failure with Reduced Ejection Fraction
    - type: medication
      name: Furosemide
      dosage: "40mg daily"
    - type: medication
      name: Carvedilol
      dosage: "12.5mg twice daily"
    - type: medication
      name: Lisinopril
      dosage: "10mg daily"
  allergies: []
intake:
  turns:
    - "My ankles are much more swollen than usual this past week"
    - "I'm also more short of breath when I lie flat"
    - "I've been taking my furosemide but it doesn't seem to be working"
    - "I gained 4 pounds in the last 3 days"
expected:
  triage:
    department: Cardiology
    min_confidence: 0.7
    red_flags: [decompensated heart failure, rapid weight gain, orthopnea]
  ddx:
    top_3_must_include: ["Decompensated Heart Failure", "Acute Pulmonary Edema", "Cardiac"]
    icd10_present: true
  history_analysis:
    must_mention: [Heart Failure, Furosemide, Carvedilol, Lisinopril]
    red_flags_expected: [decompensation, diuretic resistance]
  soap_note:
    required_sections: [S, O, A, P]
    assessment_must_mention: [heart failure, edema]
```

Create `eval/cases/returning-patient-neuro.yaml`:
```yaml
id: returning-patient-neuro-001
description: "Returning epilepsy patient with breakthrough seizure"
patient:
  name: "Rachel Adams"
  age: 28
  sex: female
  medical_history:
    - type: chronic_condition
      name: Epilepsy (focal seizures)
    - type: medication
      name: Levetiracetam
      dosage: "500mg twice daily"
  allergies: [Phenytoin]
intake:
  turns:
    - "I had a seizure this morning even though I've been taking my medication"
    - "It lasted about 2 minutes, I lost consciousness briefly"
    - "I have epilepsy and take levetiracetam, allergic to phenytoin"
    - "I haven't been sleeping well and missed one dose yesterday"
expected:
  triage:
    department: Neurology
    min_confidence: 0.7
    red_flags: [breakthrough seizure, missed dose, phenytoin allergy]
  ddx:
    top_3_must_include: ["Breakthrough Seizure", "Epilepsy", "Status Epilepticus Risk"]
    icd10_present: true
  history_analysis:
    must_mention: [Epilepsy, Levetiracetam, Phenytoin]
    red_flags_expected: [phenytoin allergy, missed dose, breakthrough]
  soap_note:
    required_sections: [S, O, A, P]
    assessment_must_mention: [seizure, epilepsy]
```

Create `eval/cases/low-confidence-ambiguous.yaml`:
```yaml
id: low-confidence-ambiguous-001
description: "25-year-old with vague fatigue and mild headache — ambiguous presentation"
patient:
  name: "Chris Jordan"
  age: 25
  sex: male
  medical_history: []
  allergies: []
intake:
  turns:
    - "I just feel really tired and have a mild headache"
    - "It's been about a week, maybe 3 out of 10"
    - "No fever, no nausea, no specific other symptoms"
    - "I've been stressed at work"
expected:
  triage:
    department: Internal Medicine
    min_confidence: 0.5
    red_flags: []
  ddx:
    top_3_must_include: ["Tension Headache", "Stress", "Viral Syndrome"]
    icd10_present: true
  history_analysis:
    must_mention: []
    red_flags_expected: []
  soap_note:
    required_sections: [S, O, A, P]
    assessment_must_mention: [fatigue, headache]
```

Create `eval/cases/pediatric-abdominal.yaml`:
```yaml
id: pediatric-abdominal-001
description: "6-year-old girl with recurrent abdominal pain and school avoidance"
patient:
  name: "Lily Evans"
  age: 6
  sex: female
  medical_history: []
  allergies: []
intake:
  turns:
    - "My daughter keeps complaining of tummy aches every morning before school"
    - "It's been 3 weeks, happens almost every day"
    - "No vomiting, no diarrhea, normal stools"
    - "The pain goes away after she's allowed to stay home"
expected:
  triage:
    department: Gastroenterology
    min_confidence: 0.6
    red_flags: [pediatric, recurrent, school avoidance]
  ddx:
    top_3_must_include: ["Functional Abdominal Pain", "Anxiety", "Constipation"]
    icd10_present: true
  history_analysis:
    must_mention: []
    red_flags_expected: [psychosomatic, anxiety]
  soap_note:
    required_sections: [S, O, A, P]
    assessment_must_mention: [abdominal, pediatric]
```

Create `eval/cases/dermatology-rash.yaml`:
```yaml
id: dermatology-rash-001
description: "42-year-old female with spreading itchy rash after starting new medication"
patient:
  name: "Diana Prince"
  age: 42
  sex: female
  medical_history:
    - type: chronic_condition
      name: Hypertension
    - type: medication
      name: Lisinopril
      dosage: "5mg daily (started 2 weeks ago)"
  allergies: []
intake:
  turns:
    - "I have an itchy red rash on my arms and chest that appeared 3 days ago"
    - "It's spreading and some areas look like hives"
    - "I started a new blood pressure pill 2 weeks ago called lisinopril"
    - "No breathing difficulty but the itch is terrible"
expected:
  triage:
    department: Internal Medicine
    min_confidence: 0.7
    red_flags: [drug reaction, angioedema risk, spreading rash]
  ddx:
    top_3_must_include: ["Drug Hypersensitivity Reaction", "Urticaria", "ACE Inhibitor Reaction"]
    icd10_present: true
  history_analysis:
    must_mention: [Lisinopril, Hypertension]
    red_flags_expected: [ACE inhibitor, angioedema, drug reaction]
  soap_note:
    required_sections: [S, O, A, P]
    assessment_must_mention: [drug, rash]
```

Create `eval/cases/orthopedics-joint-pain.yaml`:
```yaml
id: orthopedics-joint-pain-001
description: "55-year-old male with sudden severe right knee pain and swelling"
patient:
  name: "Michael Scott"
  age: 55
  sex: male
  medical_history:
    - type: chronic_condition
      name: Gout
    - type: medication
      name: Allopurinol
      dosage: "300mg daily"
  allergies: []
intake:
  turns:
    - "My right knee is extremely swollen and painful, I can barely walk"
    - "It came on suddenly overnight, very hot and red"
    - "I have gout and take allopurinol"
    - "I ate a lot of shellfish and drank beer at a party 2 days ago"
expected:
  triage:
    department: Internal Medicine
    min_confidence: 0.7
    red_flags: [acute joint, septic arthritis risk, gout flare]
  ddx:
    top_3_must_include: ["Gout Flare", "Pseudogout", "Septic Arthritis"]
    icd10_present: true
  history_analysis:
    must_mention: [Gout, Allopurinol]
    red_flags_expected: [septic arthritis, dietary trigger]
  soap_note:
    required_sections: [S, O, A, P]
    assessment_must_mention: [gout, joint]
```

Create `eval/cases/urology-pain.yaml`:
```yaml
id: urology-pain-001
description: "38-year-old male with acute flank pain and hematuria"
patient:
  name: "Ryan Cooper"
  age: 38
  sex: male
  medical_history: []
  allergies: [Sulfa drugs]
intake:
  turns:
    - "I have severe pain on my right side, in my back, it comes in waves"
    - "I also noticed blood in my urine this morning"
    - "The pain is maybe 9 out of 10 at its worst, radiates to my groin"
    - "No fever, no vomiting, I'm allergic to sulfa drugs"
expected:
  triage:
    department: Internal Medicine
    min_confidence: 0.7
    red_flags: [hematuria, renal colic, sulfa allergy]
  ddx:
    top_3_must_include: ["Nephrolithiasis", "Renal Calculi", "Urinary Tract Infection"]
    icd10_present: true
  history_analysis:
    must_mention: [Sulfa]
    red_flags_expected: [sulfa allergy, stone]
  soap_note:
    required_sections: [S, O, A, P]
    assessment_must_mention: [renal, urol]
```

Create `eval/cases/mental-health-anxiety.yaml`:
```yaml
id: mental-health-anxiety-001
description: "29-year-old female with panic attacks and chest tightness"
patient:
  name: "Anna White"
  age: 29
  sex: female
  medical_history:
    - type: chronic_condition
      name: Generalized Anxiety Disorder
    - type: medication
      name: Sertraline
      dosage: "50mg daily"
  allergies: []
intake:
  turns:
    - "I keep having episodes where my heart races, I can't breathe, and I feel like I'm dying"
    - "They come on suddenly and last about 10 minutes"
    - "I have anxiety and take sertraline but it's not helping with these episodes"
    - "My last episode was yesterday and I went to the ER but they said my heart was fine"
expected:
  triage:
    department: Internal Medicine
    min_confidence: 0.65
    red_flags: [panic attack, cardiac ruled out, medication inefficacy]
  ddx:
    top_3_must_include: ["Panic Disorder", "Generalized Anxiety", "Cardiac Arrhythmia"]
    icd10_present: true
  history_analysis:
    must_mention: [Anxiety, Sertraline]
    red_flags_expected: [medication inadequacy, panic]
  soap_note:
    required_sections: [S, O, A, P]
    assessment_must_mention: [anxiety, panic]
```

- [ ] **Step 8.6: Run all eval tests**

```bash
python -m pytest tests/eval/ -v
```

Expected: all tests pass

- [ ] **Step 8.7: Verify all 20 case files exist**

```bash
ls eval/cases/*.yaml | wc -l
```

Expected: `20`

- [ ] **Step 8.8: Commit**

```bash
git add eval/judge.py eval/rubrics/ eval/cases/
git commit -m "feat(eval): add LLM judge, rubrics, and all 20 patient cases"
```

---

## Final Verification

- [ ] **Run all eval module tests**

```bash
python -m pytest tests/eval/ -v --tb=short
```

Expected: all tests in `tests/eval/` pass

- [ ] **Dry-run the runner with one case (server must be running)**

```bash
# In one terminal: start the server
uvicorn src.api.server:app --port 8000

# In another terminal:
python eval/runner.py --case cardiology-chest-pain-001
```

Expected: output like `[cardiology-chest-pain-001] ... PASS (triage=True ddx=True history=True soap=True)` and a report file in `eval/results/`.

- [ ] **Final commit**

```bash
git add .
git commit -m "feat(eval): complete evaluation framework with runner, scorer, and 20 cases"
```
