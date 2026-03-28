"""Differential diagnosis tool — generates ranked DDx list with ICD-10 codes.

Uses the configured LLM provider to analyze symptoms and context,
then returns structured JSON with diagnoses, likelihood, evidence, and red flags.
"""
import json
import logging
from typing import Optional

from src.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

DDX_PROMPT_TEMPLATE = """You are an expert clinician. Given the patient information below, generate a ranked differential diagnosis list.

Chief Complaint: {chief_complaint}
Additional Context: {context}

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{{
  "diagnoses": [
    {{
      "name": "Diagnosis name",
      "icd10": "ICD-10 code",
      "likelihood": "High",
      "evidence": "Key supporting findings",
      "red_flags": ["flag1", "flag2"]
    }}
  ]
}}

Include 3-6 diagnoses ranked by likelihood (most likely first). Likelihood must be one of: High, Medium, Low."""


def _call_llm(prompt: str) -> str:
    """Call the configured LLM provider and return the raw text response."""
    from src.api.dependencies import llm_provider
    response = llm_provider.llm.invoke(prompt)
    return response.content if hasattr(response, "content") else str(response)


def generate_differential_diagnosis(
    patient_id: int,
    chief_complaint: str,
    context: Optional[str] = None,
) -> str:
    """Generate a ranked differential diagnosis list with ICD-10 codes.

    Args:
        patient_id: Patient's database ID (used for audit logging)
        chief_complaint: Patient's primary presenting complaint
        context: Additional clinical context (age, gender, history keywords)

    Returns:
        JSON string with diagnoses list: [{name, icd10, likelihood, evidence, red_flags}]
    """
    prompt = DDX_PROMPT_TEMPLATE.format(
        chief_complaint=chief_complaint,
        context=context or "No additional context provided",
    )

    try:
        raw = _call_llm(prompt)
        # Strip markdown code fences if present
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        # Validate JSON
        parsed = json.loads(raw)
        assert "diagnoses" in parsed
        logger.info("DDx generated for patient %d: %d diagnoses", patient_id, len(parsed["diagnoses"]))
        return json.dumps(parsed)
    except Exception as e:
        logger.error("DDx tool failed for patient %d: %s", patient_id, e)
        return json.dumps({"diagnoses": [], "error": str(e)})


_registry = ToolRegistry()
_registry.register(
    generate_differential_diagnosis,
    scope="assignable",
    symbol="generate_differential_diagnosis",
    allow_overwrite=True,
)
