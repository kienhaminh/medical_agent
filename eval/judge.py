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

# Module-level async client — reused across all judge calls in a run.
_client: anthropic.AsyncAnthropic | None = None


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic()
    return _client


def _load_rubric(name: str) -> str:
    return (RUBRICS_DIR / f"{name}.md").read_text()


async def _call_judge(prompt: str) -> dict:
    response = await _get_client().messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    text = response.content[0].text
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except json.JSONDecodeError:
            return {}
    return {}


async def judge_ddx(patient_summary: str, ddx_output: str) -> dict:
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
    return await _call_judge(prompt)


async def judge_history(patient_summary: str, history_output: str) -> dict:
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
    return await _call_judge(prompt)


async def judge_soap(patient_summary: str, soap_output: str) -> dict:
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
    return await _call_judge(prompt)
