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
