# DDx Scoring Rubric

Score 1–5 on each dimension. Be strict — only give 5 if fully met.

## Clinical Accuracy (1–5)
- 5: All diagnoses are clinically plausible given the presentation; most likely is ranked first
- 4: Minor ranking error or one implausible diagnosis
- 3: Correct diagnoses present but poor ranking or missing key diagnosis
- 2: Major diagnostic error; critical diagnosis absent for obvious presentation
- 1: Output is not clinically coherent

## Completeness (1–5)
- 5: 3–6 diagnoses with ICD-10 codes, likelihood (High/Medium/Low), supporting evidence, and red flags
- 4: Missing one element (e.g., no red flags)
- 3: Missing ICD-10 or evidence for all diagnoses
- 2: Only 1–2 diagnoses, or missing most required fields
- 1: Less than one complete diagnosis entry

## Red Flag Identification (1–5)
- 5: All clinically significant red flags explicitly called out
- 4: Most red flags noted; one missed
- 3: Some red flags noted; important one missed
- 2: Red flags not identified despite obvious clinical triggers
- 1: No red flag discussion

## Format Adherence (1–5)
- 5: Clear numbered list, consistent structure, ICD-10 codes present
- 4: Mostly structured with minor inconsistency
- 3: Partially structured
- 2: Free text, not a structured DDx list
- 1: Unreadable or not a DDx
