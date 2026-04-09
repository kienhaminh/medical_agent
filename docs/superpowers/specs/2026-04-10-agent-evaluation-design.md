# Medera Agent Evaluation Framework — Design Spec

**Date:** 2026-04-10
**Status:** Approved
**Scope:** End-to-end evaluation of triage agent + doctor assistant agent

---

## Goals

1. **Clinical validation** — demonstrate the agent meets a clinical quality bar across representative patient cases
2. **Continuous monitoring** — track output quality over time, catch regressions when models or prompts change

---

## What We Evaluate

Both agents across the full patient journey:

| Stage | Agent | Output |
|-------|-------|--------|
| Intake triage | Triage agent | Department routing, confidence score, red flag detection |
| Differential diagnosis | Doctor assistant | Ranked DDx list with ICD-10 codes |
| Medical history analysis | Doctor assistant | Structured clinical summary with red flags |
| SOAP note | Doctor assistant | S/O/A/P structured clinical note |

---

## Architecture: Standalone Eval Runner

Separate from `tests/` — produces scores, not pass/fail.

```
eval/
├── cases/                    # YAML patient case definitions
├── rubrics/                  # Markdown rubrics for LLM-as-judge per task
├── results/                  # Run outputs (gitignored), one JSON per run
├── runner.py                 # Orchestrates full journey per case
├── scorer.py                 # Rule-based + LLM-as-judge scoring
├── report.py                 # JSON + Markdown report generation
└── conftest.py               # Shared fixtures (API client, auth tokens)
```

---

## Case Definition Format

Each case is a YAML file in `eval/cases/`. Cases cover all major departments and edge scenarios.

```yaml
id: cardiology-chest-pain-001
description: "55-year-old male with acute chest pain and hypertension history"

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
    - "I've been having chest pain for the past 2 hours"
    - "It's a crushing feeling, maybe 8 out of 10"
    - "It radiates to my left arm"
    - "No, I haven't taken anything for it"

expected:
  triage:
    department: Cardiology
    min_confidence: 0.7
    red_flags: ["chest pain", "left arm radiation"]

  ddx:
    top_3_must_include:
      - "Acute Myocardial Infarction"
      - "Unstable Angina"
    icd10_present: true

  history_analysis:
    must_mention: ["Hypertension", "Lisinopril", "Penicillin allergy"]
    red_flags_expected: ["hypertension with chest pain"]

  soap_note:
    required_sections: [S, O, A, P]
    assessment_must_mention: ["chest pain", "cardiac"]
```

**Initial case set: ~20 cases** covering:
- Cardiology (chest pain, palpitations)
- Neurology (headache, stroke symptoms)
- Gastroenterology (abdominal pain)
- ENT (fast-path)
- Emergency (red flag escalation)
- Returning patient recognition
- Low-confidence / ambiguous presentation
- Pediatric variation

---

## Runner: Execution Flow

The runner calls the real API — no mocks. Each case:

```
Load YAML case
    ↓
Seed patient via POST /api/patients
    ↓
[Intake stage]
POST /api/chat (patient role) — one request per turn
    → Poll until complete_triage tool fires
    → Collect: department, confidence, agent response text
    ↓
[Doctor stage]
POST /api/chat (doctor role): "Run DDx for this patient"
    → Collect DDx output
POST /api/chat (doctor role): "Analyze medical history"
    → Collect history analysis output
POST /api/chat (doctor role): "Write SOAP note"
    → Collect SOAP note output
    ↓
Score all outputs
    ↓
Teardown: delete seeded patient
```

**CLI:**
```bash
python eval/runner.py                              # all cases
python eval/runner.py --case cardiology-chest-pain-001
python eval/runner.py --judge                      # enable LLM-as-judge scoring
```

---

## Scorer

### Rule-Based (always runs)

| Stage | Checks |
|-------|--------|
| Triage | Department exact match; confidence ≥ `min_confidence`; red flag keywords present in response |
| DDx | At least one `top_3_must_include` item in agent's top 3; ICD-10 format valid (`[A-Z]\d{2}\.?\d*`) |
| History | All `must_mention` items found in output; `red_flags_expected` mentioned |
| SOAP | S/O/A/P section headers present; `assessment_must_mention` keywords found |

### LLM-as-Judge (`--judge` flag)

- Model: `claude-sonnet-4-6`
- Input: case context + agent output + task rubric
- Output: score 1–5 per dimension (clinical accuracy, completeness, format, red flag identification)
- Rubrics stored in `eval/rubrics/ddx.md`, `eval/rubrics/history.md`, `eval/rubrics/soap.md`

---

## Report Format

Each run outputs `eval/results/YYYY-MM-DD-HH-MM.json`:

```json
{
  "run_id": "2026-04-10-14-30",
  "summary": {
    "total_cases": 20,
    "triage_accuracy": 0.90,
    "ddx_recall_at_3": 0.85,
    "soap_format_pass_rate": 1.0,
    "avg_llm_judge_score": 4.1
  },
  "cases": [
    {
      "id": "cardiology-chest-pain-001",
      "triage": { "pass": true, "department": "Cardiology", "confidence": 0.87 },
      "ddx": { "pass": true, "top_match": "Acute Myocardial Infarction" },
      "history": { "pass": true, "red_flags_found": ["hypertension with chest pain"] },
      "soap": { "pass": true, "judge_score": 4 }
    }
  ]
}
```

A markdown summary is committed per run for trend visibility. `eval/results/` is gitignored.

---

## Continuous Monitoring

- Schedule `python eval/runner.py` after any model/prompt/tool change
- Commit the markdown summary to track score trends in git history
- Alert threshold: triage accuracy < 0.80 or avg DDx recall@3 < 0.75 triggers investigation

---

## Out of Scope

- MRI segmentation accuracy (requires labeled imaging data)
- Human doctor review (deferred — recommended for future compliance validation)
- Load/latency benchmarking
