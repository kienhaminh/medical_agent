# tests/eval/test_case_loader.py
from pathlib import Path
import pytest
from eval.case_loader import load_case, load_all_cases, EvalCase


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
