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
    mentions_found_set = set(mentions_found)
    mentions_missing = [item for item in exp.must_mention if item not in mentions_found_set]
    details["mentions_found"] = mentions_found
    details["mentions_missing"] = mentions_missing

    red_flags_found = [flag for flag in exp.red_flags_expected if flag.lower() in output_lower]
    details["red_flags_found"] = red_flags_found

    return StageScore(passed=len(mentions_missing) == 0, details=details)


def score_soap(case: EvalCase, output: str) -> StageScore:
    exp = case.expected.soap_note
    output_upper = output.upper()
    details: dict = {}

    # Match section headers as word boundaries (e.g., "S:", "S\n", or start of line)
    def _section_present(section: str) -> bool:
        pattern = rf"(?:^|\n){re.escape(section)}[:\s]"
        return bool(re.search(pattern, output_upper))

    sections_found = [s for s in exp.required_sections if _section_present(s)]
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
