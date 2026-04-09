# Medical History Analysis Skill — Design Spec

**Date:** 2026-04-05  
**Status:** Approved  

---

## Overview

Add a `medical-history-analysis` skill and `analyze_medical_history` agent tool that produces a structured clinical analysis of a patient's full medical history on demand. This is distinct from the existing `patient.health_summary` (a cached narrative overview stored in the DB) — this tool is triggered mid-conversation, runs live, and returns a clinician-grade structured report with red flags and recommendations.

---

## Problem

The agent can already:
- Fetch individual records (`records` skill)
- Generate a DDx for a chief complaint (`generate_differential_diagnosis`)
- Surface a cached health summary (`patient.health_summary`)

What it cannot do is synthesize a patient's entire history into an actionable clinical picture on the fly — the kind of analysis a clinician does before seeing a complex patient for the first time.

---

## Distinction from Health Summary

| | `health_summary` | `analyze_medical_history` |
|---|---|---|
| **Trigger** | HTTP endpoint → background task | Agent tool call (mid-conversation) |
| **Output destination** | Stored in DB, displayed in UI panel | Inline to conversation |
| **Format** | Narrative markdown overview | Structured clinical sections |
| **Includes red flags** | No | Yes |
| **Includes recommendations** | No | Yes |
| **Freshness** | Cached, can be stale | Always live |
| **Purpose** | Quick patient reference | Active clinical decision-making |

---

## Architecture

### New Files

**`src/skills/medical-history-analysis/SKILL.md`**  
Metadata file that tells the agent when to use this skill. Follows the same YAML frontmatter + markdown body format as existing skills (`diagnosis`, `records`, etc.).

**`src/skills/medical-history-analysis/__init__.py`**  
Registers `analyze_medical_history` with `ToolRegistry` using scope `"assignable"` — consistent with other clinical tools.

**`src/tools/medical_history_analysis_tool.py`**  
Tool implementation. Async function that:
1. Receives `patient_id: int` and optional `focus_area: Optional[str]`
2. Fetches all patient data from DB in one pass (records, vitals, medications, allergies, imaging)
3. Builds a structured clinical context string
4. Calls the LLM with a clinical expert prompt
5. Returns structured markdown analysis

### Modified Files

**`src/tools/__init__.py`**  
Add import and re-export of `analyze_medical_history` (same pattern as all other tools).

**`src/prompt/system.py`**  
Add a directive block for `analyze_medical_history` following the same pattern as the existing DDx and segmentation directives.

---

## Tool Signature

```python
def analyze_medical_history(patient_id: int, focus_area: Optional[str] = None) -> str
```

- **`patient_id`** — required, from patient context injected into every chat message
- **`focus_area`** — optional freetext hint (e.g., `"cardiovascular"`, `"medications"`, `"oncology"`). When provided, the LLM prompt instructs extra clinical depth in that area while still covering all sections.
- **Returns** — markdown string with the structured clinical analysis, ready to render inline in the conversation

---

## Data Fetched

The tool opens a single async DB session and fetches in parallel:

| Data | Model | Fields used |
|---|---|---|
| Patient demographics | `Patient` | name, dob, gender |
| Medical records | `MedicalRecord` | record_type, content, summary, created_at (all, ordered by date) |
| Vital signs | `VitalSign` | measurement_type, value, unit, recorded_at (last 20) |
| Medications | `Medication` | name, dosage, frequency, start_date, end_date |
| Allergies | `Allergy` | allergen, reaction, severity |
| Imaging | `Imaging` | image_type, segmentation_result summary, created_at |

Text records are truncated to 1500 chars each to stay within LLM context limits. PDF/image records include only their `summary` field.

---

## LLM Prompt Structure

```
You are a senior clinician performing a structured medical history review.

Patient: {name}, {age}yo {gender}

Medical Records ({n} total):
{chronological records}

Vital Signs (recent):
{vitals}

Current Medications:
{medications}

Allergies:
{allergies}

Imaging:
{imaging summaries}

---

Produce a structured clinical history analysis in the following sections.
Omit any section where no data is available.
{focus_area_instruction if focus_area}

## Chief Concerns
Recurring complaints and active problems identified across records.

## Chronic Conditions
Established diagnoses with onset, progression, and current status.

## Surgical & Procedure History
Notable interventions, dates, and outcomes.

## Medication Review
Current medications, notable changes over time, and any potential interactions or concerns.

## Allergy Profile
Known allergies with reaction type and severity.

## Key Lab & Imaging Findings
Significant results and trends. Note any abnormal values or worrying patterns.

## 🔴 Red Flags
Findings that warrant urgent attention or immediate follow-up. Be specific.

## Clinical Recommendations
Suggested next steps: follow-up investigations, referrals, screenings overdue, or management changes.
```

The LLM is instructed to omit empty sections, be specific (not generic), and flag uncertainty when data is sparse.

---

## SKILL.md Metadata

```yaml
name: medical-history-analysis
description: "Phân tích toàn diện lịch sử bệnh án bệnh nhân theo tiêu chuẩn lâm sàng."
when_to_use:
  - "Phân tích lịch sử bệnh án bệnh nhân"
  - "Tổng hợp hồ sơ lâm sàng đầy đủ"
  - "Xem xét toàn bộ tiền sử y tế"
  - "Đánh giá nguy cơ và khuyến nghị lâm sàng"
  - "Tìm dấu hiệu cảnh báo trong hồ sơ bệnh nhân"
when_not_to_use:
  - "Chẩn đoán phân biệt dựa trên triệu chứng hiện tại → dùng generate_differential_diagnosis"
  - "Xem ảnh y tế → dùng imaging skill"
  - "Thông tin cơ bản bệnh nhân → dùng patient-management skill"
keywords:
  - phân tích bệnh án
  - medical history
  - lịch sử bệnh
  - tiền sử y tế
  - tổng hợp hồ sơ
  - red flag
  - khuyến nghị lâm sàng
  - clinical review
```

---

## System Prompt Directive

Added to `src/prompt/system.py` after the DDx directive:

```
**Tool: analyze_medical_history — CALL THIS TOOL, DO NOT ANSWER DIRECTLY**
When any user asks to analyse, review, or summarise a patient's medical history or full clinical picture: call `analyze_medical_history` immediately.

- `analyze_medical_history(patient_id=<id>)` — patient_id comes from the patient context.
- Optionally pass `focus_area=<area>` if the user specifies a clinical domain (e.g. "cardiovascular history", "medication review").
- After the tool returns, present the result as-is. Do not paraphrase or shorten the structured sections.
- If no patient context is available, ask the user to provide a patient ID before calling.
```

---

## Error Handling

- **No patient found:** return a clear error string — agent surfaces it as a message
- **No records at all:** return a minimal analysis noting data sparsity; do not fail silently
- **LLM call fails:** raise with descriptive message; agent's existing error handling surfaces it
- **Partial data (e.g., no vitals):** omit that section; noted in the prompt as expected behavior

---

## Testing

- Unit test: `tests/unit/test_medical_history_analysis_tool.py`
  - Mock DB session returning known fixtures
  - Assert all 8 sections are present in output when data is full
  - Assert sections are omitted correctly when data is missing
  - Assert `focus_area` keyword appears in prompt when passed
- No integration test needed at this stage (LLM call is mocked)

---

## What This Does NOT Do

- Does not replace or update `patient.health_summary`
- Does not store its output anywhere
- Does not call `generate_differential_diagnosis` — it's a separate analysis pass
- Does not accept free-text history (only works with data already in the DB)
