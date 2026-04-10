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
