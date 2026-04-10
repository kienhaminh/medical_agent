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
    assert data["summary"]["history_pass_rate"] == 1.0
    assert data["summary"]["soap_format_pass_rate"] == 1.0


def test_generate_report_zero_percent_when_all_fail(tmp_path):
    scores = [_make_score("case-001", False)]
    json_path = generate_report(scores, results_dir=tmp_path)

    data = json.loads(json_path.read_text())
    assert data["summary"]["triage_accuracy"] == 0.0
    assert data["summary"]["ddx_recall_at_3"] == 0.0
    assert data["summary"]["history_pass_rate"] == 0.0
    assert data["summary"]["soap_format_pass_rate"] == 0.0
