import type { Patient, MedicalRecord, PatientDetail } from "./api";

export type PatientWithDetails = PatientDetail;

export const mockPatients: PatientWithDetails[] = [
  {
    id: 1,
    name: "Sarah Johnson",
    dob: "1978-03-15",
    gender: "Female",
    created_at: "2024-01-10T08:00:00Z",
    records: [
      {
        id: 101,
        patient_id: 1,
        record_type: "image",
        title: "Chest X-Ray - Annual Physical",
        description:
          "Routine chest radiograph. Clear lung fields, normal cardiac silhouette. No acute cardiopulmonary abnormalities detected.",
        file_url: "/mock/chest-xray-sarah.jpg",
        file_type: "xray",
        created_at: "2023-10-15T10:30:00Z",
      },
      {
        id: 102,
        patient_id: 1,
        record_type: "pdf",
        title: "Comprehensive Metabolic Panel",
        description:
          "Fasting blood glucose: 118 mg/dL. HbA1c: 6.8%. Lipid panel: Total cholesterol 185, LDL 110, HDL 62, Triglycerides 95. Kidney function normal (Creatinine 0.9, eGFR >90).",
        file_url: "/mock/lab-report-sarah-cmp.pdf",
        file_type: "lab_report",
        created_at: "2024-01-14T08:15:00Z",
      },
    ],
  },
  {
    id: 2,
    name: "Michael Chen",
    dob: "1985-11-22",
    gender: "Male",
    created_at: "2024-02-05T09:30:00Z",
    records: [
      {
        id: 201,
        patient_id: 2,
        record_type: "image",
        title: "Lumbar Spine MRI",
        description:
          "MRI L-spine without contrast. Mild degenerative disc disease at L4-L5 with small disc bulge, no significant canal stenosis. No nerve root compression. Age-appropriate changes.",
        file_url: "/mock/mri-spine-michael.jpg",
        file_type: "mri",
        created_at: "2024-02-18T16:45:00Z",
      },
      {
        id: 202,
        patient_id: 2,
        record_type: "image",
        title: "Right Knee X-Ray - Post-ACL Follow-up",
        description:
          "AP and lateral views of right knee. Well-positioned ACL reconstruction hardware. Joint space preserved. No evidence of hardware loosening or complications.",
        file_url: "/mock/knee-xray-michael.jpg",
        file_type: "xray",
        created_at: "2024-02-10T11:20:00Z",
      },
      {
        id: 203,
        patient_id: 2,
        record_type: "pdf",
        title: "Sports Physical Examination",
        description:
          "Annual sports physical. Cardiovascular exam normal, EKG normal sinus rhythm. Pulmonary function test normal. Cleared for continued athletic activity.",
        file_url: "/mock/sports-physical-michael.pdf",
        file_type: "lab_report",
        created_at: "2024-02-05T10:00:00Z",
      },
      {
        id: 204,
        patient_id: 2,
        record_type: "text",
        title: "Physical Therapy Progress Note",
        description: "Lower back pain management",
        content: `CHIEF COMPLAINT: Lower back pain, 3-week duration

SUBJECTIVE: Patient reports improvement in lower back pain since initiating PT. Pain reduced from 7/10 to 3/10. Able to resume light running (3-5 miles). Compliance with home exercise program good. Pain worse with prolonged sitting, relieved with stretching.

OBJECTIVE: Lumbar range of motion improved. Flexion 80% normal, extension 90% normal. Core strength assessment shows improvement. No neurological deficits. Straight leg raise negative bilaterally.

ASSESSMENT: Mechanical lower back pain, improving with conservative management. Likely related to training intensity and core weakness.

PLAN: Continue physical therapy 2x/week for 4 more weeks. Progress core strengthening exercises. Gradual return to full running schedule. Patient educated on proper running mechanics and importance of cross-training. Follow-up in 2 weeks.`,
        created_at: "2024-02-15T13:30:00Z",
      },
    ],
  },
  {
    id: 3,
    name: "Emily Rodriguez",
    dob: "1992-07-08",
    gender: "Female",
    created_at: "2024-03-01T11:00:00Z",
    records: [
      {
        id: 301,
        patient_id: 3,
        record_type: "pdf",
        title: "Thyroid Function Panel",
        description:
          "TSH: 2.1 mIU/L (normal), Free T4: 1.3 ng/dL (normal). Thyroid function well-controlled on current levothyroxine dose. Anti-TPO antibodies elevated (consistent with Hashimoto's).",
        file_url: "/mock/thyroid-panel-emily.pdf",
        file_type: "lab_report",
        created_at: "2024-03-05T09:00:00Z",
      },
      {
        id: 302,
        patient_id: 3,
        record_type: "pdf",
        title: "Complete Blood Count",
        description:
          "CBC with differential. Hemoglobin 11.8 g/dL (mild anemia), MCV 82 fL. Iron studies: Serum iron 45 mcg/dL, Ferritin 18 ng/mL (low). Consistent with iron deficiency anemia.",
        file_url: "/mock/cbc-emily.pdf",
        file_type: "lab_report",
        created_at: "2024-03-05T09:00:00Z",
      },
      {
        id: 303,
        patient_id: 3,
        record_type: "text",
        title: "Annual Wellness Visit",
        description: "Comprehensive health maintenance",
        content: `CHIEF COMPLAINT: Annual physical examination

SUBJECTIVE: Patient reports feeling well overall. Energy levels improved compared to last year. Managing anxiety with therapy sessions biweekly. Sleep quality good (7-8 hours/night). Diet balanced, exercises 3-4x/week (yoga, walking). Concerns about family history of thyroid and autoimmune disorders.

OBJECTIVE: Vitals - BP 115/72, HR 68, BMI 23.1, Temp 98.4°F. General appearance: well-nourished, no acute distress. Thyroid: mildly enlarged, non-tender, no nodules palpable. Cardiovascular: regular rhythm, no murmurs. Lungs: clear bilaterally. Abdomen: C-section scar well-healed, soft, non-tender.

ASSESSMENT:
1. Hypothyroidism - well controlled
2. Iron deficiency anemia - mild
3. Anxiety disorder - stable
4. Health maintenance

PLAN:
1. Continue levothyroxine 75mcg daily
2. Initiate iron supplementation 325mg daily
3. Repeat CBC in 3 months to assess anemia response
4. Thyroid ultrasound ordered due to gland enlargement (screening)
5. Continue mental health counseling
6. Mammogram not yet indicated (age <40, no high-risk factors)
7. Pap smear due next visit
8. Follow-up in 6 months or sooner if symptoms arise`,
        created_at: "2024-03-01T14:30:00Z",
      },
    ],
  },
  {
    id: 4,
    name: "Robert Thompson",
    dob: "1965-12-03",
    gender: "Male",
    created_at: "2023-11-15T10:00:00Z",
    records: [
      {
        id: 401,
        patient_id: 4,
        record_type: "image",
        title: "Cardiac CT Angiography",
        description:
          "CTA coronary arteries. LAD stent patent with no in-stent restenosis. Mild diffuse coronary calcification. RCA and LCx with minimal disease (<30% stenosis). Left ventricular function normal.",
        file_url: "/mock/cardiac-cta-robert.jpg",
        file_type: "mri",
        created_at: "2024-01-20T15:00:00Z",
      },
      {
        id: 402,
        patient_id: 4,
        record_type: "pdf",
        title: "Cardiac Stress Test Results",
        description:
          "Exercise stress test. Functional capacity 8.5 METs. No chest pain or significant ST changes during exercise. Heart rate response appropriate. Blood pressure response normal. Negative for ischemia.",
        file_url: "/mock/stress-test-robert.pdf",
        file_type: "lab_report",
        created_at: "2024-01-18T10:30:00Z",
      },
      {
        id: 403,
        patient_id: 4,
        record_type: "pdf",
        title: "Lipid Panel & HbA1c",
        description:
          "Total cholesterol: 165, LDL: 95, HDL: 48, Triglycerides: 110. HbA1c: 6.0% (prediabetic range). BNP: 45 pg/mL (normal). eGFR: 75 mL/min/1.73m² (CKD stage 2).",
        file_url: "/mock/lipid-panel-robert.pdf",
        file_type: "lab_report",
        created_at: "2024-01-15T08:00:00Z",
      },
      {
        id: 404,
        patient_id: 4,
        record_type: "text",
        title: "Cardiology Follow-Up",
        description: "6-month post-stent evaluation",
        content: `CHIEF COMPLAINT: Routine cardiology follow-up, post-PCI with stent placement

SUBJECTIVE: Patient doing well since last visit. No chest pain, dyspnea, or palpitations. Exercise tolerance excellent - walks 2 miles daily without difficulty. Medication compliance excellent. Quit smoking 3 years ago, no relapses. Diet modifications ongoing with cardiac rehab dietitian guidance. Mild knee pain from osteoarthritis, not limiting activity.

OBJECTIVE: Vitals - BP 128/76, HR 62, O2 sat 97% on room air. Cardiovascular exam: regular rate and rhythm, S1/S2 normal, no murmurs/rubs/gallops. Lungs: clear with good air movement bilaterally. Extremities: no edema, pulses 2+ throughout.

REVIEW OF SYSTEMS: Stress test negative for ischemia. CTA shows patent stent, no restenosis. Echocardiogram (6 months ago): EF 58%, normal LV function, no wall motion abnormalities.

ASSESSMENT:
1. Coronary artery disease s/p LAD stent - stable, no evidence of restenosis
2. Hypertension - well controlled
3. Hyperlipidemia - managed with ezetimibe (statin intolerant)
4. Prediabetes - lifestyle modifications ongoing
5. COPD - mild, stable
6. CKD stage 2 - stable

PLAN:
1. Continue all current medications
2. Annual cardiac CT angiography to monitor stent
3. Lifestyle: continue cardiac rehab diet, regular exercise
4. Weight loss goal: 10 pounds over next 6 months (current BMI 28)
5. Diabetes screening - repeat HbA1c in 6 months
6. Pneumococcal and influenza vaccines up to date
7. Follow-up in 6 months, sooner if chest pain or concerning symptoms
8. Patient educated on warning signs of ACS - call 911 if symptoms occur`,
        created_at: "2024-01-22T14:00:00Z",
      },
    ],
  },
  {
    id: 5,
    name: "Jennifer Martinez",
    dob: "2001-04-25",
    gender: "Female",
    created_at: "2024-02-20T13:00:00Z",
    records: [
      {
        id: 501,
        patient_id: 5,
        record_type: "image",
        title: "Brain MRI with and without contrast",
        description:
          "MRI brain for migraine workup. No acute intracranial abnormality. No mass, hemorrhage, or infarction. Ventricular system normal. No evidence of demyelinating disease. Normal brain parenchyma for age.",
        file_url: "/mock/brain-mri-jennifer.jpg",
        file_type: "mri",
        created_at: "2024-02-25T11:00:00Z",
      },
      {
        id: 502,
        patient_id: 5,
        record_type: "pdf",
        title: "Vitamin D & Basic Metabolic Panel",
        description:
          "Vitamin D 25-OH: 18 ng/mL (deficient, <20). Calcium: 9.2 mg/dL (normal). Basic metabolic panel: all values within normal limits. Thyroid function (TSH): 2.5 mIU/L (normal).",
        file_url: "/mock/vitamin-d-jennifer.pdf",
        file_type: "lab_report",
        created_at: "2024-02-20T09:30:00Z",
      },
      {
        id: 503,
        patient_id: 5,
        record_type: "text",
        title: "Neurology Consultation - Migraine Management",
        description: "Initial neurology evaluation for chronic migraines",
        content: `CHIEF COMPLAINT: Chronic migraines with aura, increasing frequency

HISTORY OF PRESENT ILLNESS: 23 yo F with 7-year history of migraines presents for evaluation of worsening headache frequency. Migraines typically begin with visual aura (scintillating scotoma) followed by unilateral throbbing headache, photophobia, phonophobia, and nausea. Episodes last 4-12 hours. Current frequency 4-6 per month, up from 2-3 per month last year. Triggers include stress, sleep deprivation, hormonal changes, and bright lights. Sumatriptan effective but patient concerned about frequency of use.

PAST MEDICAL HISTORY: ADHD, Anxiety disorder, Vitamin D deficiency

CURRENT MEDICATIONS: As listed above

PHYSICAL EXAM: Neurological exam within normal limits. Cranial nerves II-XII intact. Motor strength 5/5 all extremities. Sensation intact. Reflexes 2+ symmetric. Coordination normal. Gait normal.

IMAGING: Brain MRI reviewed - no structural abnormality to explain headaches.

ASSESSMENT: Migraine with aura, chronic (>15 headache days/month meets chronic criteria if pattern continues). Currently episodic but trending toward chronic.

DISCUSSION: Reviewed migraine pathophysiology with patient. Discussed importance of trigger identification and avoidance. Medication overuse headache education provided (triptans should be limited to <10 days/month).

PLAN:
1. Start propranolol 40mg BID for migraine prophylaxis (beta-blocker)
2. Continue sumatriptan 100mg for acute treatment, limit to 2x/week
3. Add magnesium glycinate 400mg daily (evidence for migraine prevention)
4. Maintain headache diary to identify triggers
5. Stress reduction techniques: recommend mindfulness meditation
6. Sleep hygiene counseling - aim for 7-8 hours/night, consistent schedule
7. Consider CGRP antagonist if propranolol ineffective after 3-month trial
8. F/U in 6 weeks to assess response to prophylaxis
9. Patient educated on when to seek emergency care (thunderclap headache, neurological deficits, fever with headache)`,
        created_at: "2024-02-28T15:30:00Z",
      },
    ],
  },
];

// Helper function to get patient by ID with full details
export function getMockPatientById(id: number): PatientWithDetails | undefined {
  return mockPatients.find((p) => p.id === id);
}

// Helper function to get all mock patients (basic info only)
export function getAllMockPatients(): Patient[] {
  return mockPatients.map(({ records, ...patient }) => patient);
}
