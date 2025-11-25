"""Output Schema Definitions for Sub-Agents.

Defines structured output formats and validation rules for specialist agents.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, validator
from enum import Enum


class ClinicalPriority(str, Enum):
    """Priority levels for clinical findings."""
    ROUTINE = "routine"
    URGENT = "urgent"
    EMERGENT = "emergent"


class InternistOutputSchema(BaseModel):
    """Structured output format for Internist Agent.

    This schema ensures consistent, parseable responses from the clinical text specialist.
    """

    # 1. Patient Context Summary
    patient_summary: str = Field(
        ...,
        description="Brief 1-2 sentence summary of patient demographics and presenting complaint",
        min_length=10,
        max_length=500
    )

    # 2. Key Clinical Findings
    key_findings: List[str] = Field(
        ...,
        description="List of 3-5 most significant clinical findings from history, symptoms, or records",
        min_items=1,
        max_items=10
    )

    # 3. Differential Diagnosis
    differential_diagnosis: Optional[List[Dict[str, str]]] = Field(
        default=None,
        description="List of potential diagnoses with rationale. Each item should have 'diagnosis' and 'reasoning' keys",
        max_items=5
    )

    # 4. Assessment
    clinical_assessment: str = Field(
        ...,
        description="Comprehensive clinical assessment synthesizing all findings (2-4 sentences)",
        min_length=50,
        max_length=1000
    )

    # 5. Recommendations
    recommendations: List[str] = Field(
        ...,
        description="Ordered list of specific, actionable recommendations (3-7 items)",
        min_items=1,
        max_items=10
    )

    # 6. Priority Level
    priority: ClinicalPriority = Field(
        ...,
        description="Overall priority assessment for this case"
    )

    # 7. Red Flags (Optional)
    red_flags: Optional[List[str]] = Field(
        default=None,
        description="List of warning signs requiring immediate attention (if any)",
        max_items=5
    )

    # 8. Additional Notes (Optional)
    additional_notes: Optional[str] = Field(
        default=None,
        description="Any additional context, caveats, or considerations",
        max_length=500
    )

    @validator('differential_diagnosis')
    def validate_differential(cls, v):
        """Ensure each differential item has required keys."""
        if v is None or len(v) == 0:
            return v  # Allow empty or None
        
        for item in v:
            if not isinstance(item, dict):
                raise ValueError("Each differential diagnosis must be a dictionary")
            if 'diagnosis' not in item or 'reasoning' not in item:
                raise ValueError("Each differential diagnosis must have 'diagnosis' and 'reasoning' keys")
            if not item['diagnosis'].strip() or not item['reasoning'].strip():
                raise ValueError("Diagnosis and reasoning cannot be empty")
        return v

    @validator('key_findings', 'recommendations')
    def validate_non_empty_list_items(cls, v):
        """Ensure list items are not empty strings."""
        for item in v:
            if not item.strip():
                raise ValueError("List items cannot be empty")
        return v


def format_internist_output(data: Dict[str, Any]) -> str:
    """Format Internist output data into readable markdown report.

    Args:
        data: Dictionary matching InternistOutputSchema structure

    Returns:
        Formatted markdown report
    """
    # Validate against schema
    try:
        schema = InternistOutputSchema(**data)
    except Exception as e:
        raise ValueError(f"Invalid output format: {e}")

    # Build markdown report
    sections = []

    # Priority Badge
    priority_emoji = {
        ClinicalPriority.ROUTINE: "🟢",
        ClinicalPriority.URGENT: "🟡",
        ClinicalPriority.EMERGENT: "🔴"
    }
    sections.append(f"**Priority:** {priority_emoji.get(schema.priority, '')} {schema.priority.value.upper()}\n")

    # Patient Summary
    sections.append(f"**Patient Summary:**\n{schema.patient_summary}\n")

    # Key Findings
    sections.append("**Key Clinical Findings:**")
    for i, finding in enumerate(schema.key_findings, 1):
        sections.append(f"{i}. {finding}")
    sections.append("")

    # Red Flags (if any)
    if schema.red_flags:
        sections.append("**⚠️ Red Flags:**")
        for flag in schema.red_flags:
            sections.append(f"- {flag}")
        sections.append("")

    # Differential Diagnosis
    if schema.differential_diagnosis:
        sections.append("**Differential Diagnosis:**")
        for i, dx in enumerate(schema.differential_diagnosis, 1):
            sections.append(f"{i}. **{dx['diagnosis']}**")
            sections.append(f"   - Reasoning: {dx['reasoning']}")
        sections.append("")

    # Clinical Assessment
    sections.append(f"**Clinical Assessment:**\n{schema.clinical_assessment}\n")

    # Recommendations
    sections.append("**Recommendations:**")
    for i, rec in enumerate(schema.recommendations, 1):
        sections.append(f"{i}. {rec}")
    sections.append("")

    # Additional Notes (if any)
    if schema.additional_notes:
        sections.append(f"**Additional Notes:**\n{schema.additional_notes}\n")

    return "\n".join(sections)


def create_internist_instruction() -> str:
    """Create instruction text for Internist Agent on output format.

    Returns:
        Instruction text to append to system prompt
    """
    return """
## OUTPUT FORMAT REQUIREMENTS

You MUST structure your response as a JSON object with the following fields:

```json
{
  "patient_summary": "Brief 1-2 sentence summary of patient demographics and complaint",
  "key_findings": [
    "Finding 1: description",
    "Finding 2: description",
    "Finding 3: description"
  ],
  "differential_diagnosis": [
    {
      "diagnosis": "Primary diagnosis name",
      "reasoning": "Why this diagnosis is being considered"
    },
    {
      "diagnosis": "Alternative diagnosis name",
      "reasoning": "Supporting evidence for this consideration"
    }
  ],
  "clinical_assessment": "2-4 sentence comprehensive assessment synthesizing all findings",
  "recommendations": [
    "Specific recommendation 1",
    "Specific recommendation 2",
    "Specific recommendation 3"
  ],
  "priority": "routine|urgent|emergent",
  "red_flags": [
    "Warning sign 1 (if applicable)",
    "Warning sign 2 (if applicable)"
  ],
  "additional_notes": "Optional context or caveats"
}
```

### Field Requirements:
- **patient_summary**: 10-500 characters
- **key_findings**: 1-10 items, each non-empty
- **differential_diagnosis**: OPTIONAL - 0-5 diagnoses, each with 'diagnosis' and 'reasoning'
- **clinical_assessment**: 50-1000 characters
- **recommendations**: 1-10 specific, actionable items
- **priority**: Must be one of: routine, urgent, emergent
- **red_flags**: Optional, 0-5 items
- **additional_notes**: Optional, max 500 characters

### Priority Definitions:
- **routine**: Standard follow-up, no immediate concerns
- **urgent**: Needs attention within 24-48 hours
- **emergent**: Requires immediate medical attention

IMPORTANT: Always respond with valid JSON matching this exact structure. The system will parse and format your response for display.
"""


# Generic output schema for other specialists (can be extended)
class GenericSpecialistOutputSchema(BaseModel):
    """Generic structured output for specialists without custom schemas."""

    summary: str = Field(..., description="Brief summary of findings")
    findings: List[str] = Field(..., description="Key findings or observations")
    recommendations: List[str] = Field(..., description="Specific recommendations")
    additional_context: Optional[str] = Field(None, description="Additional context")


def get_output_schema_for_agent(agent_role: str) -> Optional[type[BaseModel]]:
    """Get the appropriate output schema for an agent role.

    Args:
        agent_role: The role identifier for the agent

    Returns:
        The Pydantic schema class, or None if no custom schema exists
    """
    schema_map = {
        "clinical_text": InternistOutputSchema,
        "internist": InternistOutputSchema,
    }

    return schema_map.get(agent_role)


def get_output_instructions_for_agent(agent_role: str) -> Optional[str]:
    """Get output format instructions for an agent role.

    Args:
        agent_role: The role identifier for the agent

    Returns:
        Instruction text to append to system prompt, or None
    """
    instruction_map = {
        "clinical_text": create_internist_instruction(),
        "internist": create_internist_instruction(),
    }

    return instruction_map.get(agent_role)
