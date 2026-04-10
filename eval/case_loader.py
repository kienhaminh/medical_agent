# eval/case_loader.py
from pathlib import Path
from typing import Optional
import yaml
from pydantic import BaseModel


class MedicalHistoryItem(BaseModel):
    type: str  # chronic_condition | medication
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
    if not isinstance(data, dict):
        raise ValueError(f"Expected a YAML mapping in {path}, got {type(data).__name__}")
    return EvalCase(**data)


def load_all_cases(cases_dir: Path) -> list[EvalCase]:
    return [load_case(p) for p in sorted(cases_dir.glob("*.yaml"))]
