"""
Enhanced mock data seeder with detailed clinical notes.
Generates comprehensive medical records similar to real-world EHR systems.
"""
import asyncio
import random
from datetime import datetime, timedelta
from sqlalchemy import select
from src.config.database import AsyncSessionLocal, Patient, MedicalRecord

# --- Patient Demographics ---
FIRST_NAMES = [
    "James", "Mary", "John", "Patricia", "Robert", "Jennifer", "Michael", "Linda",
    "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica",
    "Thomas", "Sarah", "Charles", "Karen", "Christopher", "Nancy", "Daniel", "Lisa",
    "Matthew", "Betty", "Anthony", "Margaret", "Mark", "Sandra", "Donald", "Ashley",
    "Steven", "Kimberly", "Paul", "Emily", "Andrew", "Donna", "Joshua", "Michelle"
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
    "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
    "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
    "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker"
]

BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
GENDERS = ["male", "female"]

# --- Vital Signs Ranges ---
VITAL_RANGES = {
    "height_cm": (150, 195),  # cm
    "weight_kg": (50, 120),  # kg
    "systolic_bp": (110, 160),  # mmHg
    "diastolic_bp": (70, 100),  # mmHg
    "heart_rate": (60, 100),  # bpm
    "respiratory_rate": (12, 20),  # breaths/min
    "temperature_c": (36.1, 37.8),  # Celsius
    "oxygen_saturation": (95, 100),  # %
}

# --- Medical Conditions with Detailed Clinical Data ---
DETAILED_CONDITIONS = [
    {
        "condition": "Type 2 Diabetes Mellitus",
        "icd10": "E11.9",
        "chief_complaint": "Polyuria, polydipsia, and fatigue",
        "hpi": "58-year-old patient presents with 3-month history of increased urination, excessive thirst, and unexplained weight loss (15 lbs). Family history of diabetes. Reports blurred vision occasionally.",
        "physical_exam": "Alert and oriented. BMI 31.2. No acute distress. Fundoscopic exam shows early diabetic retinopathy changes.",
        "medications": [
            "Metformin 1000mg PO BID with meals",
            "Empagliflozin 10mg PO daily",
            "Atorvastatin 20mg PO nightly"
        ],
        "labs_abnormal": {
            "glucose_fasting": "185 mg/dL (H)",
            "hba1c": "8.2% (H)",
            "total_cholesterol": "245 mg/dL (H)",
            "ldl": "155 mg/dL (H)",
            "triglycerides": "210 mg/dL (H)"
        },
        "treatment_plan": "Initiated on metformin and SGLT2 inhibitor. Diabetic diet education provided. Home glucose monitoring prescribed. Ophthalmology referral for retinopathy evaluation. Follow-up in 3 months for HbA1c recheck.",
        "follow_up": "3 months"
    },
    {
        "condition": "Essential Hypertension",
        "icd10": "I10",
        "chief_complaint": "Elevated blood pressure on routine screening",
        "hpi": "45-year-old asymptomatic patient found to have BP 156/98 on routine physical. No headaches, chest pain, or visual changes. Positive family history. Sedentary lifestyle.",
        "physical_exam": "Well-appearing. BP 158/96 (repeated). Normal cardiac exam. No bruits. Peripheral pulses intact.",
        "medications": [
            "Lisinopril 10mg PO daily",
            "Amlodipine 5mg PO daily",
            "Aspirin 81mg PO daily"
        ],
        "labs_abnormal": {
            "creatinine": "1.2 mg/dL (borderline)",
            "egfr": "68 mL/min/1.73m²"
        },
        "treatment_plan": "Started ACE inhibitor and calcium channel blocker. Lifestyle modifications counseled: DASH diet, reduce sodium <2g/day, exercise 30min 5x/week, weight loss goal 10 lbs. Home BP monitoring. Renal function monitoring.",
        "follow_up": "4 weeks"
    },
    {
        "condition": "Community-Acquired Pneumonia",
        "icd10": "J18.9",
        "chief_complaint": "Fever, productive cough, and shortness of breath",
        "hpi": "72-year-old patient presents with 4-day history of fever (max 102.5°F), productive cough with yellow-green sputum, pleuritic chest pain, and dyspnea on exertion. Recent URI in grandchild.",
        "physical_exam": "Ill-appearing. Temp 101.8°F. RR 24. SpO2 92% on room air. Decreased breath sounds right lower lobe with crackles. Dull to percussion RLL.",
        "medications": [
            "Ceftriaxone 1g IV daily",
            "Azithromycin 500mg PO daily x 5 days",
            "Acetaminophen 650mg PO q6h PRN fever",
            "Albuterol nebulizer q4h PRN dyspnea"
        ],
        "labs_abnormal": {
            "wbc": "15,800/μL (H)",
            "neutrophils": "84% (H)",
            "crp": "125 mg/L (H)",
            "procalcitonin": "2.5 ng/mL (H)"
        },
        "imaging": "CXR: Right lower lobe consolidation consistent with pneumonia. No pleural effusion.",
        "treatment_plan": "Admitted for IV antibiotics. Oxygen therapy to maintain SpO2 >92%. Incentive spirometry. Pulmonary hygiene. Pneumococcal and influenza vaccines recommended post-recovery.",
        "follow_up": "2 weeks post-discharge"
    },
    {
        "condition": "Acute Myocardial Infarction - STEMI",
        "icd10": "I21.09",
        "chief_complaint": "Severe crushing chest pain radiating to left arm",
        "hpi": "62-year-old male with sudden onset severe substernal chest pain 2 hours ago, 8/10, associated with diaphoresis, nausea, and dyspnea. History of hypertension and hyperlipidemia. Current smoker.",
        "physical_exam": "Diaphoretic, anxious. BP 90/60. HR 110 irregular. JVD present. S3 gallop. Bilateral crackles lower lung fields.",
        "medications": [
            "Aspirin 325mg PO stat, then 81mg daily",
            "Clopidogrel 600mg PO loading dose",
            "Atorvastatin 80mg PO daily",
            "Metoprolol 25mg PO BID",
            "Lisinopril 5mg PO daily",
            "Heparin IV drip per protocol"
        ],
        "labs_abnormal": {
            "troponin_i": "45.2 ng/mL (H)",
            "ck_mb": "285 U/L (H)",
            "bnp": "1250 pg/mL (H)",
            "d_dimer": "890 ng/mL (H)"
        },
        "imaging": "ECG: ST elevation 3mm in leads II, III, aVF. Reciprocal ST depression in V1-V3. Acute inferior STEMI.",
        "procedures": "Emergency cardiac catheterization with PCI. Drug-eluting stent to RCA. TIMI 3 flow achieved.",
        "treatment_plan": "Admitted to CCU. Dual antiplatelet therapy. Beta blocker, ACE inhibitor, high-intensity statin. Cardiac rehab referral. Smoking cessation counseling. Echo shows EF 40%.",
        "follow_up": "1 week post-discharge, then monthly x3"
    },
    {
        "condition": "Chronic Kidney Disease Stage 3",
        "icd10": "N18.3",
        "chief_complaint": "Routine follow-up for CKD",
        "hpi": "68-year-old with longstanding hypertension and diabetes, now with declining renal function. eGFR has decreased from 55 to 42 over past year. Denies oliguria, hematuria, or edema.",
        "physical_exam": "No peripheral edema. BP 142/88. Trace pedal pulses. No bruits.",
        "medications": [
            "Losartan 100mg PO daily",
            "Furosemide 40mg PO daily",
            "Sodium bicarbonate 650mg PO TID",
            "Calcitriol 0.25mcg PO daily",
            "Sevelamer 800mg PO TID with meals"
        ],
        "labs_abnormal": {
            "creatinine": "2.1 mg/dL (H)",
            "egfr": "42 mL/min/1.73m² (L)",
            "bun": "45 mg/dL (H)",
            "potassium": "5.2 mEq/L (H)",
            "phosphorus": "5.8 mg/dL (H)",
            "pth": "155 pg/mL (H)",
            "albumin": "3.2 g/dL (L)"
        },
        "treatment_plan": "Continue nephrology follow-up. Low-potassium, low-phosphorus diet. Optimize BP control. Monitor for anemia. Discuss dialysis planning for future. Avoid nephrotoxic medications. Flu and pneumonia vaccines.",
        "follow_up": "3 months"
    },
    {
        "condition": "Rheumatoid Arthritis",
        "icd10": "M06.9",
        "chief_complaint": "Joint pain, swelling, and morning stiffness",
        "hpi": "52-year-old female with 6-month history of symmetric polyarthritis involving hands and wrists. Morning stiffness lasting >2 hours. Fatigue and low-grade fevers. Family history of autoimmune disease.",
        "physical_exam": "Bilateral MCP and PIP joint swelling and tenderness. Positive squeeze test. Limited ROM both wrists. No subcutaneous nodules yet.",
        "medications": [
            "Methotrexate 15mg PO weekly",
            "Folic acid 1mg PO daily",
            "Prednisone 10mg PO daily (tapering)",
            "Hydroxychloroquine 400mg PO daily",
            "Meloxicam 15mg PO daily"
        ],
        "labs_abnormal": {
            "rf": "185 IU/mL (H)",
            "anti_ccp": "340 U/mL (H)",
            "esr": "58 mm/hr (H)",
            "crp": "24 mg/L (H)",
            "ana": "Positive 1:160"
        },
        "imaging": "Hand X-rays: Periarticular osteopenia. Early erosive changes at 2nd and 3rd MCP joints bilaterally.",
        "treatment_plan": "Initiated DMARD therapy with methotrexate and hydroxychloroquine. Bridge therapy with low-dose prednisone. Monitor CBC, LFTs monthly while on MTX. Rheumatology follow-up. Physical therapy referral. Discuss biologic agents if inadequate response.",
        "follow_up": "6 weeks"
    },
    {
        "condition": "Asthma Exacerbation",
        "icd10": "J45.901",
        "chief_complaint": "Worsening shortness of breath and wheezing",
        "hpi": "34-year-old with history of asthma presents with 3-day worsening dyspnea, nocturnal cough, and increased albuterol use (>8 puffs/day). Recent viral URI. No fever currently.",
        "physical_exam": "Respiratory distress. Using accessory muscles. Diffuse bilateral wheezes throughout lung fields. Peak flow 55% of personal best.",
        "medications": [
            "Albuterol 2.5mg/3mL nebulizer q2h",
            "Ipratropium 0.5mg nebulizer q6h",
            "Methylprednisolone 125mg IV q6h x 48h",
            "Fluticasone/Salmeterol 250/50mcg 1 puff BID",
            "Montelukast 10mg PO nightly"
        ],
        "labs_abnormal": {
            "wbc": "12,500/μL (H)",
            "eosinophils": "8% (H)"
        },
        "imaging": "CXR: Hyperinflation. No infiltrates or pneumothorax.",
        "treatment_plan": "Aggressive bronchodilator therapy. Systemic corticosteroids x 5 days. Continue controller medications. Asthma action plan reviewed. Identify and avoid triggers. Consider allergy testing. Inhaler technique education.",
        "follow_up": "1 week"
    },
    {
        "condition": "Major Depressive Disorder",
        "icd10": "F33.1",
        "chief_complaint": "Persistent sadness, loss of interest, and insomnia",
        "hpi": "41-year-old presents with 4-month history of depressed mood, anhedonia, poor concentration, fatigue, and significant sleep disturbance. Recent job loss. Denies current SI/HI. Previous depressive episode 5 years ago responded well to SSRI.",
        "physical_exam": "Flat affect. Psychomotor retardation. Poor eye contact. Dressed appropriately. No signs of self-harm.",
        "medications": [
            "Sertraline 50mg PO daily (starting dose)",
            "Trazodone 50mg PO qHS PRN insomnia",
            "Omega-3 1000mg PO BID"
        ],
        "labs_abnormal": {
            "tsh": "Normal",
            "vitamin_d": "18 ng/mL (L)",
            "vitamin_b12": "Normal"
        },
        "assessment_scores": "PHQ-9: 18 (moderately severe depression). GAD-7: 12 (moderate anxiety).",
        "treatment_plan": "Initiated SSRI therapy. Refer to psychiatry and cognitive behavioral therapy. Sleep hygiene education. Safety planning. Vitamin D supplementation. Exercise and social support encouraged. Close monitoring for first 4 weeks.",
        "follow_up": "2 weeks"
    },
    {
        "condition": "Urinary Tract Infection",
        "icd10": "N39.0",
        "chief_complaint": "Dysuria, urinary frequency, and suprapubic pain",
        "hpi": "28-year-old female with 2-day history of burning on urination, increased frequency, urgency, and lower abdominal pain. No fever, back pain, or vaginal discharge. Sexually active.",
        "physical_exam": "Afebrile. Suprapubic tenderness. No CVA tenderness. Pelvic exam normal.",
        "medications": [
            "Nitrofurantoin 100mg PO BID x 5 days",
            "Phenazopyridine 200mg PO TID PRN x 2 days",
            "Ibuprofen 400mg PO q6h PRN pain"
        ],
        "labs_abnormal": {
            "urinalysis": "WBC >100, RBC 10-20, Bacteria many, Nitrites positive, Leukocyte esterase positive",
            "urine_culture": "Pending - >100,000 CFU/mL E. coli (susceptible to nitrofurantoin)"
        },
        "treatment_plan": "Empiric antibiotic started. Increased fluid intake. Cranberry supplements. Discussed prevention strategies. If recurrent UTIs, consider prophylaxis or post-coital antibiotics.",
        "follow_up": "PRN or if symptoms persist >3 days"
    },
    {
        "condition": "Hyperthyroidism (Graves Disease)",
        "icd10": "E05.00",
        "chief_complaint": "Weight loss, palpitations, and heat intolerance",
        "hpi": "36-year-old female with 3-month history of unintentional 20-lb weight loss despite increased appetite, tremors, anxiety, heat intolerance, and palpitations. Family history of thyroid disease.",
        "physical_exam": "Anxious. Fine tremor. Warm, moist skin. Thyroid diffusely enlarged 2x normal, no nodules. Mild exophthalmos. Tachycardia 110 bpm.",
        "medications": [
            "Methimazole 15mg PO BID",
            "Propranolol 20mg PO TID",
            "Calcium carbonate 1000mg PO daily",
            "Vitamin D3 2000 IU PO daily"
        ],
        "labs_abnormal": {
            "tsh": "<0.01 mIU/L (L)",
            "free_t4": "3.8 ng/dL (H)",
            "free_t3": "12.5 pg/mL (H)",
            "tsi": "385% (H)",
            "tpo_antibody": "450 IU/mL (H)"
        },
        "imaging": "Thyroid ultrasound: Diffusely enlarged, hyperechoic, increased vascularity consistent with Graves disease.",
        "treatment_plan": "Started anti-thyroid medication. Beta blocker for symptom control. Monitor thyroid function monthly. Discussed definitive treatment options: radioactive iodine vs surgery. Ophthalmology referral for eye disease. Low-iodine diet.",
        "follow_up": "4 weeks"
    }
]

# --- Comprehensive Lab Test Templates ---
NORMAL_LAB_PANELS = {
    "cbc": {
        "wbc": (4.5, 11.0, "K/μL"),
        "rbc_male": (4.5, 5.9, "M/μL"),
        "rbc_female": (4.0, 5.2, "M/μL"),
        "hemoglobin_male": (13.5, 17.5, "g/dL"),
        "hemoglobin_female": (12.0, 15.5, "g/dL"),
        "hematocrit_male": (39, 49, "%"),
        "hematocrit_female": (36, 44, "%"),
        "mcv": (80, 100, "fL"),
        "mch": (27, 33, "pg"),
        "mchc": (32, 36, "g/dL"),
        "platelets": (150, 400, "K/μL"),
        "neutrophils": (40, 70, "%"),
        "lymphocytes": (20, 40, "%"),
        "monocytes": (2, 8, "%"),
        "eosinophils": (1, 4, "%"),
        "basophils": (0, 1, "%")
    },
    "cmp": {
        "sodium": (136, 145, "mEq/L"),
        "potassium": (3.5, 5.0, "mEq/L"),
        "chloride": (98, 107, "mEq/L"),
        "co2": (23, 29, "mEq/L"),
        "bun": (7, 20, "mg/dL"),
        "creatinine": (0.7, 1.3, "mg/dL"),
        "glucose": (70, 100, "mg/dL"),
        "calcium": (8.5, 10.5, "mg/dL")
    },
    "lft": {
        "ast": (10, 40, "U/L"),
        "alt": (7, 56, "U/L"),
        "alkaline_phosphatase": (44, 147, "U/L"),
        "total_bilirubin": (0.3, 1.2, "mg/dL"),
        "direct_bilirubin": (0.0, 0.3, "mg/dL"),
        "albumin": (3.5, 5.5, "g/dL"),
        "total_protein": (6.0, 8.3, "g/dL")
    },
    "lipid": {
        "total_cholesterol": (125, 200, "mg/dL"),
        "ldl": (50, 130, "mg/dL"),
        "hdl_male": (40, 60, "mg/dL"),
        "hdl_female": (50, 70, "mg/dL"),
        "triglycerides": (50, 150, "mg/dL"),
        "vldl": (10, 30, "mg/dL")
    },
    "thyroid": {
        "tsh": (0.5, 5.0, "mIU/L"),
        "free_t4": (0.8, 1.8, "ng/dL"),
        "free_t3": (2.3, 4.2, "pg/mL")
    },
    "coagulation": {
        "pt": (11, 13.5, "sec"),
        "inr": (0.8, 1.2, "ratio"),
        "ptt": (25, 35, "sec")
    }
}

# --- Medications Database ---
COMMON_MEDICATIONS = {
    "cardiovascular": [
        "Lisinopril 10mg PO daily",
        "Amlodipine 5mg PO daily",
        "Metoprolol 50mg PO BID",
        "Atorvastatin 40mg PO nightly",
        "Aspirin 81mg PO daily",
        "Clopidogrel 75mg PO daily",
        "Warfarin 5mg PO daily",
        "Furosemide 40mg PO daily"
    ],
    "endocrine": [
        "Metformin 1000mg PO BID",
        "Glipizide 5mg PO daily",
        "Insulin glargine 20 units SQ qHS",
        "Levothyroxine 100mcg PO daily",
        "Prednisone 10mg PO daily"
    ],
    "respiratory": [
        "Albuterol 90mcg 2 puffs q4-6h PRN",
        "Fluticasone/Salmeterol 250/50mcg 1 puff BID",
        "Montelukast 10mg PO nightly",
        "Tiotropium 18mcg inhaled daily"
    ],
    "psychiatric": [
        "Sertraline 100mg PO daily",
        "Fluoxetine 40mg PO daily",
        "Escitalopram 20mg PO daily",
        "Bupropion XL 300mg PO daily",
        "Trazodone 50mg PO qHS PRN"
    ],
    "pain": [
        "Ibuprofen 600mg PO q6h PRN",
        "Acetaminophen 650mg PO q6h PRN",
        "Tramadol 50mg PO q6h PRN",
        "Gabapentin 300mg PO TID"
    ],
    "gi": [
        "Omeprazole 20mg PO daily",
        "Pantoprazole 40mg PO daily",
        "Ondansetron 4mg PO q8h PRN nausea"
    ]
}

# --- Helper Functions ---

def random_date_between(start_year=1940, end_year=2005):
    """Generate random date of birth."""
    start = datetime(start_year, 1, 1)
    end = datetime(end_year, 12, 31)
    delta = end - start
    random_days = random.randint(0, delta.days)
    return (start + timedelta(days=random_days)).strftime("%Y-%m-%d")


def random_datetime_past(days=365):
    """Generate random datetime in the past."""
    delta = timedelta(days=random.randint(0, days))
    return datetime.now() - delta


def calculate_age(dob_str):
    """Calculate age from date of birth."""
    dob = datetime.strptime(dob_str, "%Y-%m-%d")
    today = datetime.now()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def generate_vital_signs(gender):
    """Generate realistic vital signs."""
    height_cm = round(random.uniform(*VITAL_RANGES["height_cm"]), 1)
    weight_kg = round(random.uniform(*VITAL_RANGES["weight_kg"]), 1)
    bmi = round(weight_kg / ((height_cm / 100) ** 2), 1)

    systolic = random.randint(*VITAL_RANGES["systolic_bp"])
    diastolic = random.randint(*VITAL_RANGES["diastolic_bp"])

    return {
        "height_cm": height_cm,
        "height_ft": f"{int(height_cm / 30.48)}'{int((height_cm % 30.48) / 2.54)}\"",
        "weight_kg": weight_kg,
        "weight_lbs": round(weight_kg * 2.20462, 1),
        "bmi": bmi,
        "blood_pressure": f"{systolic}/{diastolic}",
        "heart_rate": random.randint(*VITAL_RANGES["heart_rate"]),
        "respiratory_rate": random.randint(*VITAL_RANGES["respiratory_rate"]),
        "temperature_c": round(random.uniform(*VITAL_RANGES["temperature_c"]), 1),
        "temperature_f": round(random.uniform(97.0, 100.0), 1),
        "oxygen_saturation": random.randint(*VITAL_RANGES["oxygen_saturation"])
    }


def generate_lab_values(panel_name, gender="male", add_variation=0.1):
    """Generate realistic lab values with slight variations."""
    panel = NORMAL_LAB_PANELS.get(panel_name, {})
    results = {}

    for test_name, (low, high, unit) in panel.items():
        # Adjust for gender-specific values
        if "female" in test_name and gender != "female":
            continue
        if "male" in test_name and gender != "male":
            continue

        # Generate value within normal range with some variation
        variation = random.uniform(-add_variation, add_variation)
        value = random.uniform(low, high) * (1 + variation)

        # Format based on typical precision
        if unit in ["K/μL", "M/μL"]:
            formatted_value = round(value, 1)
        elif unit in ["%", "ratio"]:
            formatted_value = round(value, 1)
        else:
            formatted_value = round(value, 1)

        clean_name = test_name.replace("_male", "").replace("_female", "")
        results[clean_name] = f"{formatted_value} {unit}"

    return results


def generate_medication_list(num_meds=3):
    """Generate random medication list."""
    all_meds = []
    for category in COMMON_MEDICATIONS.values():
        all_meds.extend(category)

    return random.sample(all_meds, min(num_meds, len(all_meds)))


# --- Main Seeding Functions ---

async def seed_detailed_patients(session, num_patients=30):
    """Seed patients with comprehensive clinical data."""
    print(f"Seeding {num_patients} patients with detailed clinical data...")
    patients = []

    for i in range(num_patients):
        gender = random.choice(GENDERS)
        dob = random_date_between()
        blood_group = random.choice(BLOOD_GROUPS)

        patient = Patient(
            name=f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}",
            dob=dob,
            gender=gender
        )
        session.add(patient)
        await session.flush()  # Get patient ID

        age = calculate_age(dob)
        vitals = generate_vital_signs(gender)

        # Create initial patient registration record
        registration_date = random_datetime_past(730)  # Within last 2 years
        registration_note = f"""
═══════════════════════════════════════════════════════════
PATIENT REGISTRATION & BASELINE ASSESSMENT
═══════════════════════════════════════════════════════════
Date: {registration_date.strftime('%Y-%m-%d %H:%M')}
Patient ID: {patient.id}
Name: {patient.name}
DOB: {dob} (Age: {age} years)
Gender: {gender.capitalize()}
Blood Group: {blood_group}

VITAL SIGNS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Height: {vitals['height_cm']} cm ({vitals['height_ft']})
• Weight: {vitals['weight_kg']} kg ({vitals['weight_lbs']} lbs)
• BMI: {vitals['bmi']} kg/m²
• Blood Pressure: {vitals['blood_pressure']} mmHg
• Heart Rate: {vitals['heart_rate']} bpm
• Respiratory Rate: {vitals['respiratory_rate']} breaths/min
• Temperature: {vitals['temperature_c']}°C ({vitals['temperature_f']}°F)
• SpO2: {vitals['oxygen_saturation']}% on room air

BASELINE LABORATORY STUDIES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Complete Blood Count (CBC):
{chr(10).join([f"  • {k.upper().replace('_', ' ')}: {v}" for k, v in generate_lab_values('cbc', gender).items()])}

Comprehensive Metabolic Panel (CMP):
{chr(10).join([f"  • {k.upper().replace('_', ' ')}: {v}" for k, v in generate_lab_values('cmp', gender).items()])}

Lipid Panel:
{chr(10).join([f"  • {k.upper().replace('_', ' ')}: {v}" for k, v in generate_lab_values('lipid', gender).items()])}

Liver Function Tests (LFT):
{chr(10).join([f"  • {k.upper().replace('_', ' ')}: {v}" for k, v in generate_lab_values('lft', gender).items()])}

Thyroid Function:
{chr(10).join([f"  • {k.upper().replace('_', ' ')}: {v}" for k, v in generate_lab_values('thyroid', gender).items()])}

SOCIAL HISTORY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Smoking: {random.choice(['Never smoker', 'Former smoker (quit 5 years ago)', 'Current smoker 1/2 PPD x 10 years', 'Never smoker'])}
• Alcohol: {random.choice(['None', 'Occasional social', '1-2 drinks per week', 'None'])}
• Exercise: {random.choice(['Sedentary', 'Walks 30 min 3x/week', 'Regular exercise 4-5x/week', 'Minimal activity'])}
• Occupation: {random.choice(['Office worker', 'Teacher', 'Retired', 'Healthcare worker', 'Engineer', 'Self-employed'])}

ALLERGIES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{random.choice(['• NKDA (No Known Drug Allergies)', '• Penicillin - rash', '• Sulfa drugs - hives', '• NKDA'])}

FAMILY HISTORY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Father: {random.choice(['Hypertension, CAD', 'Diabetes, stroke at age 65', 'Healthy', 'Prostate cancer'])}
• Mother: {random.choice(['Breast cancer', 'Diabetes, hypertension', 'Osteoporosis', 'Healthy'])}
• Siblings: {random.choice(['No significant history', 'Brother with diabetes', 'Sister with thyroid disease', 'N/A'])}
═══════════════════════════════════════════════════════════
        """.strip()

        registration_record = MedicalRecord(
            patient_id=patient.id,
            record_type="text",
            content=registration_note,
            summary=f"Patient Registration - {patient.name}, Age {age}, {gender.capitalize()}"
        )
        session.add(registration_record)

        # Add 2-4 detailed medical encounters
        num_encounters = random.randint(2, 4)
        selected_conditions = random.sample(DETAILED_CONDITIONS, min(num_encounters, len(DETAILED_CONDITIONS)))

        for condition_data in selected_conditions:
            encounter_date = random_datetime_past(365)

            # Build comprehensive clinical note
            clinical_note = f"""
═══════════════════════════════════════════════════════════
CLINICAL ENCOUNTER NOTE
═══════════════════════════════════════════════════════════
Date: {encounter_date.strftime('%Y-%m-%d %H:%M')}
Patient: {patient.name} (ID: {patient.id})
Age: {age} years | Gender: {gender.capitalize()} | Blood Type: {blood_group}
Diagnosis: {condition_data['condition']} (ICD-10: {condition_data['icd10']})

CHIEF COMPLAINT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{condition_data['chief_complaint']}

HISTORY OF PRESENT ILLNESS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{condition_data['hpi']}

VITAL SIGNS (Current Visit):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• BP: {vitals['blood_pressure']} mmHg
• HR: {vitals['heart_rate']} bpm
• RR: {vitals['respiratory_rate']} breaths/min
• Temp: {vitals['temperature_c']}°C ({vitals['temperature_f']}°F)
• SpO2: {vitals['oxygen_saturation']}%
• Weight: {vitals['weight_kg']} kg
• BMI: {vitals['bmi']} kg/m²

PHYSICAL EXAMINATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{condition_data['physical_exam']}

LABORATORY RESULTS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{chr(10).join([f"• {k.upper().replace('_', ' ')}: {v}" for k, v in condition_data.get('labs_abnormal', {}).items()])}
"""

            # Add imaging if present
            if 'imaging' in condition_data:
                clinical_note += f"""
IMAGING STUDIES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{condition_data['imaging']}
"""

            # Add procedures if present
            if 'procedures' in condition_data:
                clinical_note += f"""
PROCEDURES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{condition_data['procedures']}
"""

            # Add assessment scores if present
            if 'assessment_scores' in condition_data:
                clinical_note += f"""
ASSESSMENT SCORES:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{condition_data['assessment_scores']}
"""

            # Add medications
            clinical_note += f"""
MEDICATIONS PRESCRIBED:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{chr(10).join([f"• {med}" for med in condition_data.get('medications', [])])}

ASSESSMENT & PLAN:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{condition_data['treatment_plan']}

FOLLOW-UP:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Scheduled for {condition_data['follow_up']}

Provider: Dr. {random.choice(['Sarah Johnson', 'Michael Chen', 'Emily Rodriguez', 'David Kim', 'Jennifer Lee'])} MD
═══════════════════════════════════════════════════════════
            """.strip()

            encounter_record = MedicalRecord(
                patient_id=patient.id,
                record_type="text",
                content=clinical_note,
                summary=f"{condition_data['condition']} - {condition_data['chief_complaint']}"
            )
            session.add(encounter_record)

        # Add routine lab work
        lab_date = random_datetime_past(180)
        routine_labs = f"""
═══════════════════════════════════════════════════════════
ROUTINE LABORATORY PANEL
═══════════════════════════════════════════════════════════
Date: {lab_date.strftime('%Y-%m-%d %H:%M')}
Patient: {patient.name} (ID: {patient.id})
Ordering Provider: Dr. {random.choice(['Sarah Johnson', 'Michael Chen', 'Emily Rodriguez'])} MD

Complete Blood Count (CBC):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{chr(10).join([f"  {k.upper().replace('_', ' ')}: {v}" for k, v in generate_lab_values('cbc', gender, 0.05).items()])}

Comprehensive Metabolic Panel (CMP):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{chr(10).join([f"  {k.upper().replace('_', ' ')}: {v}" for k, v in generate_lab_values('cmp', gender, 0.05).items()])}

Coagulation Studies:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
{chr(10).join([f"  {k.upper().replace('_', ' ')}: {v}" for k, v in generate_lab_values('coagulation', gender, 0.05).items()])}

Interpretation: All values within normal limits.
═══════════════════════════════════════════════════════════
        """.strip()

        lab_record = MedicalRecord(
            patient_id=patient.id,
            record_type="text",
            content=routine_labs,
            summary="Routine laboratory panel - All values WNL"
        )
        session.add(lab_record)

        patients.append(patient)

        if (i + 1) % 10 == 0:
            print(f"  Progress: {i + 1}/{num_patients} patients")

    await session.commit()
    print(f"✓ Created {num_patients} patients with comprehensive clinical data")
    return patients


async def clear_existing_data(session):
    """Clear existing patient and medical record data."""
    print("Clearing existing patient data...")
    await session.execute(MedicalRecord.__table__.delete())
    await session.execute(Patient.__table__.delete())
    await session.commit()
    print("✓ Cleared existing data")


async def main(clear_first=False, num_patients=30):
    """Main seeding function."""
    print("=" * 70)
    print("AI AGENT - DETAILED CLINICAL DATA SEEDER")
    print("=" * 70)
    print("Generating realistic medical records with:")
    print("  • Comprehensive vital signs")
    print("  • Complete blood tests (CBC, CMP, LFT, Lipid, Thyroid)")
    print("  • Detailed disease histories")
    print("  • Medication lists")
    print("  • Blood groups")
    print("  • Clinical assessments")
    print("=" * 70)

    async with AsyncSessionLocal() as session:
        if clear_first:
            await clear_existing_data(session)

        patients = await seed_detailed_patients(session, num_patients)

    print("=" * 70)
    print("✓ DETAILED CLINICAL DATA SEEDING COMPLETED!")
    print("=" * 70)
    print(f"\nSummary:")
    print(f"  • {num_patients} patients with full demographics")
    print(f"  • ~{num_patients * 4} comprehensive clinical notes")
    print(f"  • Vital signs, blood groups, and baseline labs for all patients")
    print(f"  • Multiple disease encounters with detailed documentation")
    print(f"  • Complete medication lists and treatment plans")
    print("\nNext steps:")
    print("  • Start API: python -m src.api")
    print("  • View patients: curl http://localhost:8000/api/patients")
    print("  • Search records: curl http://localhost:8000/api/records/search?query=diabetes")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Seed detailed clinical mock data")
    parser.add_argument("--clear", action="store_true", help="Clear existing data first")
    parser.add_argument("--patients", type=int, default=30, help="Number of patients (default: 30)")

    args = parser.parse_args()

    asyncio.run(main(clear_first=args.clear, num_patients=args.patients))
