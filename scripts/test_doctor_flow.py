#!/usr/bin/env python3
"""
Doctor flow test script for the medical agent.

Simulates a doctor consulting the Internist agent about a patient.
Verifies the agent queries patient data via tools and that clinical notes are saved.

Usage:
    python scripts/test_doctor_flow.py                        # run all scenarios
    python scripts/test_doctor_flow.py --scenario cardiac_review
    python scripts/test_doctor_flow.py --base-url http://localhost:9000
    python scripts/test_doctor_flow.py --no-cleanup
    python scripts/test_doctor_flow.py --verbose
"""

import argparse
import asyncio
import json
import sys
import time
from dataclasses import dataclass, field
from typing import Optional

import httpx

BASE_URL = "http://localhost:8000"
DOCTOR_AGENT_ROLE = "clinical_text"
BETWEEN_SCENARIOS_DELAY = 3.0  # seconds — lets the backend settle between scenarios

SCENARIOS = [
    # --- ORIGINAL 3 ---
    {
        "id": "cardiac_review",
        "description": "Cardiologist reviewing 65yo male post-MI",
        "patient": {"name": "[DRTEST] Robert Mills", "dob": "1960-03-12", "gender": "male"},
        "seed_records": [
            {"content": "Discharge summary: MI event 6 weeks ago. Treated with PCI. EF 45%. On aspirin, atorvastatin, metoprolol, ramipril.", "title": "Discharge summary"},
            {"content": "ECG report: Sinus rhythm. Old inferior Q waves consistent with prior MI. No acute changes.", "title": "ECG report"},
        ],
        "turns": [
            "I need to review patient Robert Mills. Can you pull up their information?",
            "What medications is he currently on and how is his cardiac function?",
            "Given his EF of 45%, what follow-up do you recommend?",
        ],
        "expected_tools": ["query_patient_basic_info", "query_patient_medical_records"],
        "clinical_note": "Post-MI review: EF 45%, hemodynamically stable. Continue current medications. Schedule echocardiogram in 3 months. Cardiac rehab referral placed.",
    },
    {
        "id": "diabetes_management",
        "description": "Endocrinologist reviewing 58yo female with T2DM",
        "patient": {"name": "[DRTEST] Carol Jensen", "dob": "1967-08-20", "gender": "female"},
        "seed_records": [
            {"content": "HbA1c: 8.9% (target <7%). Fasting glucose: 178 mg/dL. On metformin 1000mg BD.", "title": "HbA1c labs"},
            {"content": "Medication list: Metformin 1000mg BD, Lisinopril 10mg OD, Atorvastatin 20mg OD.", "title": "Current medications"},
        ],
        "turns": [
            "I need to review patient Carol Jensen. Can you pull up their information?",
            "What are her latest HbA1c results and current medications?",
            "Her HbA1c is above target — what adjustments would you suggest?",
        ],
        "expected_tools": ["query_patient_basic_info", "query_patient_medical_records"],
        "clinical_note": "HbA1c 8.9%, above target. Increase metformin to 2000mg daily. Consider adding SGLT2 inhibitor. Dietary counseling referral placed. Recheck HbA1c in 3 months.",
    },
    {
        "id": "pediatric_fever",
        "description": "Pediatrician reviewing 8yo with recurring fevers",
        "patient": {"name": "[DRTEST] Liam O'Brien", "dob": "2017-06-05", "gender": "male"},
        "seed_records": [
            {"content": "Fever log: 4 episodes over 6 weeks. Max temp 39.2°C. Each lasting 2-3 days. No localizing symptoms.", "title": "Fever log"},
            {"content": "CBC: WBC 11.2, Neutrophils 78%, CRP 24 mg/L during febrile episode. Normal between episodes.", "title": "Blood count results"},
        ],
        "turns": [
            "I need to review patient Liam O'Brien. Can you pull up their information?",
            "What does the fever pattern look like and are there any abnormal labs?",
            "No clear infectious source — what workup should we pursue?",
        ],
        "expected_tools": ["query_patient_basic_info", "query_patient_medical_records"],
        "clinical_note": "Recurrent fevers, no clear source. Pattern may suggest PFAPA or occult infection. Order ANA, complement levels, ESR. Refer to infectious disease specialist.",
    },
    # --- EXTENDED 7 ---
    {
        "id": "orthopedic_imaging",
        "description": "Orthopedic surgeon reviewing 42yo male post-fracture",
        "patient": {"name": "[DRTEST] Marcus Webb", "dob": "1983-11-17", "gender": "male"},
        "seed_records": [
            {"content": "X-ray report: Displaced distal radius fracture, right wrist. ORIF performed 8 weeks ago. Hardware in good position.", "title": "Fracture X-ray report"},
            {"content": "Surgical notes: ORIF right distal radius with volar plate and screws. No intraoperative complications.", "title": "Surgical notes"},
        ],
        "turns": [
            "I need to review patient Marcus Webb. Can you pull up their information?",
            "What was the fracture type and what procedure was performed?",
            "He's 8 weeks post-op — is he ready for hardware removal?",
        ],
        "expected_tools": ["query_patient_basic_info", "query_patient_medical_records"],
        "clinical_note": "8 weeks post-ORIF right distal radius. Healing well on X-ray. Remove cast. Commence physiotherapy. Hardware removal not indicated at this stage.",
    },
    {
        "id": "oncology_review",
        "description": "Oncologist reviewing 54yo female mid-chemotherapy",
        "patient": {"name": "[DRTEST] Patricia Nguyen", "dob": "1971-04-28", "gender": "female"},
        "seed_records": [
            {"content": "Chemo cycle notes: Cycle 3 of 6 FOLFOX completed. Mild nausea, no febrile neutropenia.", "title": "Chemotherapy cycle notes"},
            {"content": "CBC post-cycle 3: WBC 2.8, ANC 1.1 (borderline), Hgb 10.2, Plt 145.", "title": "CBC labs post-cycle 3"},
        ],
        "turns": [
            "I need to review patient Patricia Nguyen. Can you pull up their information?",
            "How has she tolerated chemotherapy so far and what are her latest counts?",
            "Her ANC is borderline — should we delay the next cycle?",
        ],
        "expected_tools": ["query_patient_basic_info", "query_patient_medical_records"],
        "clinical_note": "Cycle 3 FOLFOX tolerated. ANC 1.1 — borderline neutropenia. Delay cycle 4 by 1 week. Recheck CBC before proceeding. Continue G-CSF prophylaxis.",
    },
    {
        "id": "neurology_followup",
        "description": "Neurologist reviewing 71yo male post-stroke",
        "patient": {"name": "[DRTEST] Edward Chang", "dob": "1954-09-03", "gender": "male"},
        "seed_records": [
            {"content": "Stroke admission notes: Left MCA ischaemic stroke. Treated with IV tPA within 3.5h. NIHSS 8 on admission, 3 at discharge.", "title": "Stroke admission notes"},
            {"content": "MRI brain report: Left MCA territory infarct, no haemorrhagic transformation. Mild periventricular white matter changes.", "title": "MRI brain report"},
        ],
        "turns": [
            "I need to review patient Edward Chang. Can you pull up their information?",
            "What was the stroke severity and what does the MRI show?",
            "He's 3 months post-stroke — what are the priorities for this review?",
        ],
        "expected_tools": ["query_patient_basic_info", "query_patient_medical_records"],
        "clinical_note": "3-month post-stroke review. NIHSS improved from 8 to 3. Continue dual antiplatelet therapy for 90 days then switch to monotherapy. Repeat MRI in 6 months. Continue speech therapy.",
    },
    {
        "id": "pre_op_assessment",
        "description": "Anesthesiologist reviewing 60yo female before elective surgery",
        "patient": {"name": "[DRTEST] Helen Burke", "dob": "1965-12-09", "gender": "female"},
        "seed_records": [
            {"content": "Medication list: Metformin 500mg BD, Ramipril 5mg OD, Aspirin 100mg OD. Allergy: Penicillin (anaphylaxis).", "title": "Medications and allergies"},
            {"content": "Pre-op ECG: Normal sinus rhythm, no acute changes. No prior cardiac history.", "title": "Pre-op ECG"},
        ],
        "turns": [
            "I need to review patient Helen Burke for pre-op clearance. Can you pull up their information?",
            "What medications is she on and are there any allergies I need to know about?",
            "Any cardiac concerns that might affect general anaesthesia?",
        ],
        "expected_tools": ["query_patient_basic_info", "query_patient_medical_records"],
        "clinical_note": "Cleared for general anaesthesia. Hold metformin 24h pre-op. Hold aspirin 7 days pre-op. Penicillin allergy documented — use alternative antibiotics. ECG normal.",
    },
    {
        "id": "respiratory_copd",
        "description": "Pulmonologist reviewing 66yo male with COPD",
        "patient": {"name": "[DRTEST] George Harman", "dob": "1959-02-14", "gender": "male"},
        "seed_records": [
            {"content": "Spirometry: FEV1 42% predicted, FEV1/FVC 0.58. GOLD Stage 3 COPD. Worsening from 51% last year.", "title": "Spirometry results"},
            {"content": "O2 saturation logs: Resting SpO2 91-93%. Exercise desaturation to 85%. On LABA/LAMA inhaler.", "title": "O2 saturation logs"},
        ],
        "turns": [
            "I need to review patient George Harman. Can you pull up their information?",
            "What do the spirometry results show and what is he currently on?",
            "His FEV1 has dropped — how should we escalate treatment?",
        ],
        "expected_tools": ["query_patient_basic_info", "query_patient_medical_records"],
        "clinical_note": "GOLD Stage 3 COPD, FEV1 declining to 42%. Escalate to triple therapy (LABA/LAMA/ICS). Refer for pulmonary rehabilitation. Assess for long-term oxygen therapy. Flu vaccine up to date.",
    },
    {
        "id": "emergency_polytrauma",
        "description": "ER physician rapidly reviewing 35yo trauma patient",
        "patient": {"name": "[DRTEST] Ryan Kovacs", "dob": "1990-07-22", "gender": "male"},
        "seed_records": [
            {"content": "Trauma notes: MVA. GCS 15. Multiple rib fractures (4th-7th left). No pneumothorax on CXR. Stable vitals.", "title": "Trauma assessment notes"},
            {"content": "CT chest report: Fractures ribs 4-7 left side. Small left pleural effusion. No pneumothorax. No aortic injury.", "title": "CT chest report"},
        ],
        "turns": [
            "I need to review trauma patient Ryan Kovacs. Can you pull up their information?",
            "What injuries were found on imaging and what is his current status?",
            "No pneumothorax — does he need admission or can he be managed conservatively?",
        ],
        "expected_tools": ["query_patient_basic_info", "query_patient_medical_records"],
        "clinical_note": "Multiple left rib fractures (4-7), small pleural effusion, no pneumothorax. Admit for 24h observation. IV analgesia. Incentive spirometry. Repeat CXR in 12h to monitor effusion.",
    },
    {
        "id": "pediatric_growth",
        "description": "Pediatrician reviewing 10yo with growth concerns",
        "patient": {"name": "[DRTEST] Sophia Patel", "dob": "2015-10-30", "gender": "female"},
        "seed_records": [
            {"content": "Growth chart: Height velocity 3.2 cm/year (below 3rd percentile for age). Weight tracking 10th percentile.", "title": "Growth chart records"},
            {"content": "Thyroid function: TSH 3.8 mIU/L (normal), Free T4 12.1 pmol/L (normal). Ordered to rule out hypothyroidism.", "title": "Thyroid lab results"},
        ],
        "turns": [
            "I need to review patient Sophia Patel. Can you pull up their information?",
            "What is her growth velocity and are the thyroid results back?",
            "Thyroid is normal — what is the next step to investigate the growth delay?",
        ],
        "expected_tools": ["query_patient_basic_info", "query_patient_medical_records"],
        "clinical_note": "Growth velocity below 3rd percentile. Thyroid normal. Order IGF-1, IGF-BP3, bone age X-ray. Refer to pediatric endocrinology for growth hormone evaluation.",
    },
    # --- EXTENDED 14 ---
    {
        "id": "dermatology_psoriasis",
        "description": "Dermatologist reviewing 38yo with chronic psoriasis on biologic therapy",
        "patient": {"name": "[DRTEST] Nina Johansson", "dob": "1987-05-16", "gender": "female"},
        "seed_records": [
            {"content": "Psoriasis history: Plaque psoriasis, PASI 18 at diagnosis. On adalimumab 40mg fortnightly for 6 months. Current PASI 4.", "title": "Psoriasis treatment history"},
            {"content": "Safety labs: LFTs normal. Hepatitis B surface antigen negative. Quantiferon-TB negative. Performed pre-biologic workup.", "title": "Pre-biologic safety labs"},
        ],
        "turns": [
            "I need to review patient Nina Johansson. Can you pull up their information?",
            "How has she responded to adalimumab and are her safety labs in order?",
            "PASI improved from 18 to 4 — should we continue, escalate, or maintain?",
        ],
        "expected_tools": ["query_patient_basic_info", "query_patient_medical_records"],
        "clinical_note": "Excellent response to adalimumab — PASI 4 from 18. Continue current regimen. Annual TB and hepatitis screening due. No adverse effects reported.",
    },
    {
        "id": "rheumatology_ra",
        "description": "Rheumatologist reviewing 52yo on methotrexate for RA",
        "patient": {"name": "[DRTEST] Diane Fletcher", "dob": "1973-01-08", "gender": "female"},
        "seed_records": [
            {"content": "RA history: Seropositive RA (RF+, anti-CCP+). On methotrexate 20mg weekly + folic acid. DAS28 score 3.8 (moderate activity).", "title": "RA disease activity"},
            {"content": "Hand X-ray report: Bilateral periarticular osteopenia. Early erosive changes at MCP joints bilaterally. No significant joint space loss.", "title": "Hand X-ray report"},
        ],
        "turns": [
            "I need to review patient Diane Fletcher. Can you pull up their information?",
            "What is her current disease activity and what do the hand X-rays show?",
            "DAS28 is 3.8 with erosive changes — is methotrexate monotherapy sufficient?",
        ],
        "expected_tools": ["query_patient_basic_info", "query_patient_medical_records"],
        "clinical_note": "Moderate RA activity (DAS28 3.8) with early erosive changes. Insufficient response to methotrexate monotherapy. Add hydroxychloroquine. If no improvement in 3 months, consider biologic (TNF inhibitor).",
    },
    {
        "id": "nephrology_ckd",
        "description": "Nephrologist reviewing 67yo with CKD stage 4 approaching dialysis",
        "patient": {"name": "[DRTEST] Frank Sorensen", "dob": "1958-08-31", "gender": "male"},
        "seed_records": [
            {"content": "Renal function: eGFR 18 ml/min/1.73m2 (CKD stage 4). Creatinine 312 umol/L. Proteinuria 2.1g/day. Trending down 3 ml/min/year.", "title": "Renal function labs"},
            {"content": "Current medications: Amlodipine 10mg, Furosemide 40mg, Calcium carbonate, Erythropoietin 4000 IU weekly, Sodium bicarbonate.", "title": "Nephrology medications"},
        ],
        "turns": [
            "I need to review patient Frank Sorensen. Can you pull up their information?",
            "What is his current eGFR trend and what is he on?",
            "eGFR at 18 — should we start dialysis planning?",
        ],
        "expected_tools": ["query_patient_basic_info", "query_patient_medical_records"],
        "clinical_note": "CKD stage 4, eGFR 18 and declining. Initiate dialysis education and access planning (AV fistula referral). Reassess in 3 months. Optimise BP and anaemia management.",
    },
    {
        "id": "psychiatry_depression",
        "description": "Psychiatrist reviewing 29yo with treatment-resistant depression",
        "patient": {"name": "[DRTEST] Alex Morgan", "dob": "1996-03-25", "gender": "male"},
        "seed_records": [
            {"content": "Psychiatric history: MDD, 2 prior episodes. Failed sertraline (side effects) and fluoxetine (insufficient response). Currently on venlafaxine 225mg, PHQ-9 score 16 (moderate-severe).", "title": "Psychiatric treatment history"},
            {"content": "Risk assessment: No active suicidal ideation. Passive death wishes reported at last review. Good social support. Engages with psychotherapy.", "title": "Risk assessment"},
        ],
        "turns": [
            "I need to review patient Alex Morgan. Can you pull up their information?",
            "What treatments has he tried and what is his current symptom score?",
            "PHQ-9 of 16 after two failed SSRIs and current SNRI — what are the options?",
        ],
        "expected_tools": ["query_patient_basic_info", "query_patient_medical_records"],
        "clinical_note": "Treatment-resistant MDD. PHQ-9 16 on venlafaxine 225mg. Augment with lithium 400mg nocte. If no response in 6 weeks, refer for TMS or ECT evaluation. Continue CBT.",
    },
    {
        "id": "gastroenterology_ibd",
        "description": "Gastroenterologist reviewing 34yo Crohn's disease post-colonoscopy",
        "patient": {"name": "[DRTEST] Isabella Reyes", "dob": "1991-12-14", "gender": "female"},
        "seed_records": [
            {"content": "Colonoscopy report: Active ileocolonic Crohn's disease. Skip lesions in terminal ileum. Moderate inflammatory activity. No strictures or fistulae.", "title": "Colonoscopy report"},
            {"content": "CRP 32 mg/L, faecal calprotectin 820 ug/g. On azathioprine 150mg OD. CDAI score 240 (moderate).", "title": "Inflammatory markers"},
        ],
        "turns": [
            "I need to review patient Isabella Reyes. Can you pull up their information?",
            "What did the colonoscopy show and what are her inflammatory markers?",
            "Moderate Crohn's on azathioprine alone — is escalation needed?",
        ],
        "expected_tools": ["query_patient_basic_info", "query_patient_medical_records"],
        "clinical_note": "Moderate ileocolonic Crohn's, CDAI 240, CRP 32, calprotectin 820. Inadequate response to azathioprine. Initiate infliximab induction. Pre-biologic screening ordered.",
    },
    {
        "id": "infectious_disease_sepsis",
        "description": "ID specialist reviewing 48yo recovering from sepsis",
        "patient": {"name": "[DRTEST] Thomas Okafor", "dob": "1977-07-19", "gender": "male"},
        "seed_records": [
            {"content": "Sepsis admission: E. coli bacteraemia from urinary source. Treated with IV meropenem 10 days. Blood cultures cleared at day 3.", "title": "Sepsis admission notes"},
            {"content": "Antibiotic history: Meropenem 1g TDS x10 days (completed). Transitioning to oral co-amoxiclav per sensitivities.", "title": "Antibiotic course"},
        ],
        "turns": [
            "I need to review patient Thomas Okafor. Can you pull up their information?",
            "What was the causative organism and what antibiotics was he on?",
            "Blood cultures are clear — is the oral step-down appropriate?",
        ],
        "expected_tools": ["query_patient_basic_info", "query_patient_medical_records"],
        "clinical_note": "E. coli bacteraemia, source controlled. Meropenem course completed, blood cultures cleared. Step down to oral co-amoxiclav 625mg TDS for 5 days appropriate. Repeat urine culture at completion.",
    },
    {
        "id": "hematology_anemia",
        "description": "Haematologist reviewing 44yo with iron-deficiency anaemia",
        "patient": {"name": "[DRTEST] Claire Whitfield", "dob": "1981-09-02", "gender": "female"},
        "seed_records": [
            {"content": "CBC: Hgb 7.8 g/dL, MCV 68 fL (microcytic). Ferritin 4 ug/L (very low). Transferrin saturation 6%.", "title": "CBC and iron studies"},
            {"content": "GI workup: Upper endoscopy normal. Colonoscopy: no polyps or malignancy. Gynaecology review: menorrhagia confirmed as likely source.", "title": "Source investigation"},
        ],
        "turns": [
            "I need to review patient Claire Whitfield. Can you pull up their information?",
            "How severe is the anaemia and has the source been identified?",
            "Menorrhagia as the source — what is the treatment plan?",
        ],
        "expected_tools": ["query_patient_basic_info", "query_patient_medical_records"],
        "clinical_note": "Severe IDA (Hgb 7.8) secondary to menorrhagia. Oral iron poorly tolerated. Arrange IV iron infusion (ferric carboxymaltose). Liaise with gynaecology for menorrhagia management. Recheck CBC in 6 weeks.",
    },
    {
        "id": "gynecology_prenatal",
        "description": "Obstetrician reviewing 31yo high-risk pregnancy at 28 weeks",
        "patient": {"name": "[DRTEST] Amara Diallo", "dob": "1994-05-07", "gender": "female"},
        "seed_records": [
            {"content": "Obstetric history: G2P1, previous gestational hypertension. Current BP 148/94 at 28 weeks. On labetalol 200mg BD.", "title": "Obstetric history and BP"},
            {"content": "20-week anomaly scan: Normal fetal morphology. Placenta posterior, not low-lying. Fundal height 26cm at 28 weeks.", "title": "Anomaly scan and fundal height"},
        ],
        "turns": [
            "I need to review patient Amara Diallo. Can you pull up their information?",
            "What is her current blood pressure and how is the pregnancy progressing?",
            "BP 148/94 at 28 weeks — is this gestational hypertension or preeclampsia?",
        ],
        "expected_tools": ["query_patient_basic_info", "query_patient_medical_records"],
        "clinical_note": "28/40, BP 148/94, no proteinuria — gestational hypertension. Increase labetalol to 200mg TDS. Twice-weekly BP monitoring. Growth scan at 32 weeks. Low-dose aspirin continued.",
    },
    {
        "id": "urology_kidney_stones",
        "description": "Urologist reviewing 50yo with recurrent kidney stones",
        "patient": {"name": "[DRTEST] Victor Petrov", "dob": "1975-04-11", "gender": "male"},
        "seed_records": [
            {"content": "Stone history: 3 episodes of renal colic over 2 years. Stone analysis: calcium oxalate. 24h urine: hypercalciuria, low citrate.", "title": "Stone history and analysis"},
            {"content": "KUB X-ray: 6mm stone right lower pole. No hydronephrosis. Previous stones passed spontaneously.", "title": "Current imaging"},
        ],
        "turns": [
            "I need to review patient Victor Petrov. Can you pull up their information?",
            "What type of stones is he forming and what does current imaging show?",
            "6mm stone in the lower pole — watch and wait or intervene?",
        ],
        "expected_tools": ["query_patient_basic_info", "query_patient_medical_records"],
        "clinical_note": "Recurrent calcium oxalate stones with hypercalciuria. 6mm lower pole stone — conservative management, likely to pass. Increase fluid intake to 3L/day. Start potassium citrate for low citrate. 24h urine repeat in 3 months.",
    },
    {
        "id": "allergy_severe_asthma",
        "description": "Allergist reviewing 25yo with severe allergic asthma",
        "patient": {"name": "[DRTEST] Priya Krishnamurthy", "dob": "2000-11-23", "gender": "female"},
        "seed_records": [
            {"content": "Asthma history: Severe persistent asthma. 3 ED visits in past year. On high-dose ICS/LABA + LAMA. ACQ score 2.8 (uncontrolled).", "title": "Asthma control history"},
            {"content": "Allergy workup: Skin prick test positive: house dust mite, cat dander, grass pollen. Total IgE 840 IU/mL. Blood eosinophils 0.6 x10^9/L.", "title": "Allergy skin prick test and IgE"},
        ],
        "turns": [
            "I need to review patient Priya Krishnamurthy. Can you pull up their information?",
            "What allergens are driving her asthma and what is her control like?",
            "Elevated IgE and eosinophils, uncontrolled on triple therapy — what biologics are indicated?",
        ],
        "expected_tools": ["query_patient_basic_info", "query_patient_medical_records"],
        "clinical_note": "Severe uncontrolled allergic asthma. IgE 840, eosinophils 0.6. Eligible for dupilumab (Type 2 inflammation). Initiate omalizumab given high IgE and allergen sensitisation. Allergen immunotherapy referral.",
    },
    {
        "id": "geriatrics_polypharmacy",
        "description": "Geriatrician reviewing 82yo on 9 medications",
        "patient": {"name": "[DRTEST] Dorothy Simmons", "dob": "1943-06-18", "gender": "female"},
        "seed_records": [
            {"content": "Medication list: Warfarin 3mg, Digoxin 125mcg, Furosemide 40mg, Spironolactone 25mg, Omeprazole 20mg, Amlodipine 5mg, Metformin 500mg, Aspirin 100mg, Zopiclone 7.5mg.", "title": "Full medication list (9 drugs)"},
            {"content": "Recent issues: 2 falls in past 3 months. Mild cognitive impairment (MMSE 22/30). Renal function: eGFR 38.", "title": "Geriatric syndromes and renal function"},
        ],
        "turns": [
            "I need to review patient Dorothy Simmons. Can you pull up their information?",
            "What is she on and are there any high-risk medications given her falls and cognition?",
            "eGFR 38 and on metformin, digoxin, and warfarin — what needs to be addressed?",
        ],
        "expected_tools": ["query_patient_basic_info", "query_patient_medical_records"],
        "clinical_note": "Polypharmacy review: Stop zopiclone (falls risk). Hold metformin (eGFR 38). Reduce digoxin dose and monitor levels. Deprescribe aspirin (benefit unclear vs risk). Refer to falls clinic and cognitive assessment team.",
    },
    {
        "id": "sports_medicine_knee",
        "description": "Sports medicine doctor reviewing 22yo athlete with ACL tear",
        "patient": {"name": "[DRTEST] Ethan Lindqvist", "dob": "2003-02-28", "gender": "male"},
        "seed_records": [
            {"content": "MRI knee: Complete ACL tear, right knee. Associated medial meniscus posterior horn tear. No chondral damage. Grade 1 MCL sprain.", "title": "MRI knee report"},
            {"content": "Physiotherapy notes: Pre-op rehab completed. Quadriceps strength 85% of contralateral side. ROM full. Ready for surgical planning.", "title": "Pre-op physiotherapy notes"},
        ],
        "turns": [
            "I need to review patient Ethan Lindqvist. Can you pull up their information?",
            "What does the MRI show and how has pre-op rehab gone?",
            "Complete ACL tear with meniscus involvement — what is the surgical plan?",
        ],
        "expected_tools": ["query_patient_basic_info", "query_patient_medical_records"],
        "clinical_note": "Complete ACL tear + medial meniscus tear, right knee. Pre-op rehab satisfactory. Plan: ACL reconstruction (hamstring graft) + meniscus repair. Target return to sport 9-12 months post-op.",
    },
    {
        "id": "palliative_care_review",
        "description": "Palliative care physician reviewing 74yo with end-stage lung cancer",
        "patient": {"name": "[DRTEST] Harold Bennett", "dob": "1951-10-05", "gender": "male"},
        "seed_records": [
            {"content": "Oncology notes: Stage IV NSCLC, EGFR wild-type, PD-L1 20%. Completed 4 cycles carboplatin/pemetrexed. Progressive disease on CT. No further active treatment planned.", "title": "Oncology treatment summary"},
            {"content": "Symptom assessment: Pain 6/10 (pleuritic, right chest). Dyspnoea at rest. ECOG performance status 3. Morphine SR 30mg BD with breakthrough.", "title": "Symptom control assessment"},
        ],
        "turns": [
            "I need to review patient Harold Bennett. Can you pull up their information?",
            "What is his oncology status and how is his symptom burden?",
            "ECOG 3 with progressive disease — what is the focus for this review?",
        ],
        "expected_tools": ["query_patient_basic_info", "query_patient_medical_records"],
        "clinical_note": "End-stage NSCLC, ECOG 3, no further oncological treatment. Goals of care: comfort-focused. Increase morphine SR to 60mg BD. Add dexamethasone 4mg for dyspnoea. Social work and family meeting arranged. Referral to hospice.",
    },
    {
        "id": "endocrinology_thyroid",
        "description": "Endocrinologist reviewing 40yo with hypothyroidism, TSH trend",
        "patient": {"name": "[DRTEST] Lauren Fitzgerald", "dob": "1985-08-14", "gender": "female"},
        "seed_records": [
            {"content": "TSH trend: 6 months ago TSH 8.2 → started levothyroxine 50mcg. 3 months ago TSH 4.1. Today TSH 6.8 (rising again). Free T4 10.2 pmol/L.", "title": "TSH trend over 6 months"},
            {"content": "Symptoms: Fatigue, cold intolerance, weight gain 3kg over 3 months. No dysphagia. Thyroid not palpably enlarged.", "title": "Hypothyroid symptoms"},
        ],
        "turns": [
            "I need to review patient Lauren Fitzgerald. Can you pull up their information?",
            "What is her TSH trend and is she symptomatic?",
            "TSH rose from 4.1 to 6.8 despite being on levothyroxine — what's the plan?",
        ],
        "expected_tools": ["query_patient_basic_info", "query_patient_medical_records"],
        "clinical_note": "Hypothyroidism, TSH rising to 6.8 on levothyroxine 50mcg. Increase to 75mcg. Check compliance and timing of dose. Recheck TFTs in 6 weeks. Screen for malabsorption if TSH remains elevated.",
    },
]


@dataclass
class StageResult:
    name: str
    passed: bool
    detail: str
    duration_s: float = 0.0

    def __str__(self) -> str:
        icon = "✅" if self.passed else "❌"
        label = f"[{self.name}]".ljust(35)
        status = "PASS" if self.passed else "FAIL"
        return f"  {icon} {label} {status}  {self.detail}  ({self.duration_s:.1f}s)"


@dataclass
class StreamResult:
    """Parsed output from one SSE response."""
    full_text: str = ""
    session_id: Optional[int] = None
    tool_calls: list[dict] = field(default_factory=list)
    done: bool = False


async def read_sse_stream(response: httpx.Response, timeout_s: float = 60.0) -> StreamResult:
    """Parse a streaming SSE response from POST /api/chat.

    Reads lines of the form:
        data: <json_payload>

    Accumulates text from {"chunk": "..."} events.
    Captures session_id from {"session_id": ...} events (arrives at end of stream).
    Records tool calls from {"tool_call": {...}} events.
    Stops on {"done": true} or connection close.
    """
    result = StreamResult()
    deadline = time.monotonic() + timeout_s

    async for line in response.aiter_lines():
        if time.monotonic() > deadline:
            break
        if not line.startswith("data: "):
            continue
        raw = line[len("data: "):]
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            continue

        if "chunk" in payload:
            result.full_text += payload["chunk"]
        elif "session_id" in payload:
            result.session_id = payload["session_id"]
        elif "tool_call" in payload:
            result.tool_calls.append(payload["tool_call"])
        elif payload.get("done"):
            result.done = True
            # ⚠️ Do NOT add `break` here. This intentionally diverges from test_full_flow.py.
            # The backend sends session_id AFTER the done event, so we must keep reading.

    return result


class DoctorFlowTester:
    def __init__(self, scenario: dict, base_url: str, cleanup: bool = True, verbose: bool = False):
        self.scenario = scenario
        self.base_url = base_url.rstrip("/")
        self.cleanup = cleanup
        self.verbose = verbose
        self.session_id: Optional[int] = None
        self.patient_id: Optional[int] = None
        self.record_ids: list[int] = []
        self.note_record_id: Optional[int] = None
        self.tool_calls_seen: list[str] = []

    async def stage_1_setup_patient(self, client: httpx.AsyncClient) -> StageResult:
        """Create test patient and seed medical records."""
        t0 = time.monotonic()
        name = "Stage 1: Setup patient + records"
        p = self.scenario["patient"]
        try:
            # Create patient
            resp = await client.post(
                f"{self.base_url}/api/patients",
                json={"name": p["name"], "dob": p["dob"], "gender": p["gender"]},
                timeout=30.0,
            )
            resp.raise_for_status()
            self.patient_id = resp.json()["id"]

            # Seed records
            for rec in self.scenario["seed_records"]:
                r = await client.post(
                    f"{self.base_url}/api/patients/{self.patient_id}/records",
                    json={"title": rec["title"], "content": rec["content"]},
                    timeout=30.0,
                )
                r.raise_for_status()
                self.record_ids.append(r.json()["id"])

            return StageResult(
                name, True,
                f"patient_id={self.patient_id}, {len(self.record_ids)} records seeded",
                time.monotonic() - t0,
            )
        except Exception as e:
            return StageResult(name, False, str(e), time.monotonic() - t0)

    async def stage_2_open_session(self, client: httpx.AsyncClient) -> StageResult:
        """Open a chat session with the Internist agent using a neutral opener."""
        t0 = time.monotonic()
        name = "Stage 2: Open Internist session"
        if self.patient_id is None:
            return StageResult(name, False, "skipped — patient_id unknown (Stage 1 failed)", time.monotonic() - t0)

        for attempt in range(1, 3):
            try:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/api/chat",
                    json={
                        "message": "Hello, I need to consult about a patient.",
                        "agent_role": DOCTOR_AGENT_ROLE,
                        "patient_id": self.patient_id,
                        "stream": True,
                    },
                    timeout=60.0,
                ) as resp:
                    resp.raise_for_status()
                    stream = await read_sse_stream(resp)

                # Collect any tool calls from opening turn
                for tc in stream.tool_calls:
                    tool_name = tc.get("name", "")
                    if tool_name:
                        self.tool_calls_seen.append(tool_name)

                if stream.session_id is not None:
                    self.session_id = stream.session_id
                    return StageResult(name, True, f"session_id={self.session_id}", time.monotonic() - t0)

                if attempt < 2:
                    await asyncio.sleep(2.0)
            except Exception as e:
                if attempt < 2:
                    await asyncio.sleep(2.0)
                    continue
                return StageResult(name, False, str(e), time.monotonic() - t0)

        return StageResult(name, False, "session_id not returned after retries", time.monotonic() - t0)
