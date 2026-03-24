"""
Full-flow mock data seeder — populates every stage of the hospital visit lifecycle.

Creates patients, medical records, imaging, visits (at each status), and
linked intake chat sessions with realistic reception conversations.

Usage:
    python scripts/db/seed/seed_full_flow.py          # append to existing data
    python scripts/db/seed/seed_full_flow.py --clear   # wipe visits/chats first
"""

import asyncio
import random
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select

from src.config.database import (
    AsyncSessionLocal,
    ChatMessage,
    ChatSession,
    Imaging,
    ImageGroup,
    MedicalRecord,
    Patient,
    SubAgent,
)
from src.models.visit import Visit, VisitStatus

# ---------------------------------------------------------------------------
# Patient definitions
# ---------------------------------------------------------------------------

PATIENTS = [
    {
        "name": "Clara Nguyen",
        "dob": "1990-06-15",
        "gender": "female",
        "health_summary": (
            "29-year-old female with well-controlled asthma and seasonal allergies. "
            "Uses albuterol PRN and fluticasone daily. No recent ER visits."
        ),
        "records": [
            {
                "type": "text",
                "summary": "Pulmonology annual review",
                "content": (
                    "Clara Nguyen seen for asthma maintenance. PFTs show FEV1 92% predicted. "
                    "Well-controlled on current regimen. Continue fluticasone 110mcg 2 puffs BID, "
                    "albuterol PRN. Return in 12 months or sooner if symptoms worsen."
                ),
                "days_ago": 30,
            },
            {
                "type": "text",
                "summary": "Allergy panel results",
                "content": (
                    "Skin prick testing for Clara Nguyen: positive for dust mites, grass pollen, "
                    "and cat dander. Negative for mold, tree pollen, and food allergens. "
                    "Recommend allergen avoidance and nasal corticosteroid spray during peak season."
                ),
                "days_ago": 90,
            },
        ],
        "imaging": [
            {
                "title": "Chest X-ray PA and lateral",
                "image_type": "x-ray",
                "original_url": "https://example.com/imaging/clara-nguyen/chest-xray-pa.dcm",
                "preview_url": "https://example.com/imaging/clara-nguyen/chest-xray-pa-thumb.jpg",
            },
        ],
    },
    {
        "name": "Harold Washington",
        "dob": "1958-11-03",
        "gender": "male",
        "health_summary": (
            "67-year-old male with COPD (GOLD stage II), atrial fibrillation on apixaban, "
            "and benign prostatic hyperplasia. Former smoker (40 pack-years, quit 2015)."
        ),
        "records": [
            {
                "type": "text",
                "summary": "Cardiology follow-up — atrial fibrillation",
                "content": (
                    "Harold Washington seen for AF management. Rate controlled on metoprolol 50mg BID. "
                    "CHA2DS2-VASc score 3 — continue apixaban 5mg BID. Echocardiogram shows EF 55%, "
                    "mild left atrial enlargement. No signs of decompensation."
                ),
                "days_ago": 14,
            },
            {
                "type": "text",
                "summary": "Pulmonology — COPD exacerbation note",
                "content": (
                    "Harold Washington presented with worsening dyspnea and productive cough x 5 days. "
                    "SpO2 91% on room air. Started on prednisone taper and azithromycin. "
                    "Increased tiotropium to 2 puffs daily. Follow-up in 1 week."
                ),
                "days_ago": 60,
            },
            {
                "type": "text",
                "summary": "CBC and BMP results",
                "content": (
                    "WBC 11.2 (H), Hgb 13.8, Plt 245. BMP: Na 138, K 4.1, Cr 1.1, BUN 18, "
                    "Glucose 102. Mild leukocytosis consistent with acute exacerbation."
                ),
                "days_ago": 60,
            },
        ],
        "imaging": [
            {
                "title": "Chest CT — COPD evaluation",
                "image_type": "ct",
                "original_url": "https://example.com/imaging/harold-washington/chest-ct.dcm",
                "preview_url": "https://example.com/imaging/harold-washington/chest-ct-thumb.jpg",
            },
        ],
    },
    {
        "name": "Sofia Ramirez",
        "dob": "1985-01-22",
        "gender": "female",
        "health_summary": (
            "41-year-old female with gestational diabetes (resolved), mild iron-deficiency anemia, "
            "and recurrent migraines managed with sumatriptan. BMI 26."
        ),
        "records": [
            {
                "type": "text",
                "summary": "Neurology consult — migraine management",
                "content": (
                    "Sofia Ramirez reports 3-4 migraines per month with aura. Current abortive: "
                    "sumatriptan 50mg effective within 90 min. Discussed prophylaxis — starting "
                    "topiramate 25mg nightly, titrate to 50mg. MRI brain normal."
                ),
                "days_ago": 21,
            },
            {
                "type": "text",
                "summary": "Iron studies",
                "content": (
                    "Ferritin 12 ng/mL (L), TIBC 420 (H), serum iron 35 (L). "
                    "Consistent with iron-deficiency anemia. Start ferrous sulfate 325mg daily "
                    "with vitamin C. Recheck in 3 months."
                ),
                "days_ago": 45,
            },
        ],
        "imaging": [
            {
                "title": "Brain MRI without contrast",
                "image_type": "mri",
                "original_url": "https://example.com/imaging/sofia-ramirez/brain-mri.dcm",
                "preview_url": "https://example.com/imaging/sofia-ramirez/brain-mri-thumb.jpg",
            },
        ],
    },
    {
        "name": "James Okafor",
        "dob": "1970-04-18",
        "gender": "male",
        "health_summary": (
            "55-year-old male with type 2 diabetes (HbA1c 7.8%), stage 2 CKD (eGFR 68), "
            "and peripheral neuropathy. On metformin and lisinopril."
        ),
        "records": [
            {
                "type": "text",
                "summary": "Nephrology consult — CKD monitoring",
                "content": (
                    "James Okafor evaluated for CKD progression. eGFR stable at 68 mL/min. "
                    "UACR 85 mg/g (microalbuminuria). Continue lisinopril 20mg daily. "
                    "Avoid NSAIDs. Low-sodium diet reinforced. Repeat labs in 6 months."
                ),
                "days_ago": 10,
            },
            {
                "type": "text",
                "summary": "Diabetic foot exam",
                "content": (
                    "Annual diabetic foot exam for James Okafor. Decreased monofilament sensation "
                    "bilateral feet (3/10 sites). No ulcers or calluses. Pedal pulses 2+ bilaterally. "
                    "Referred to podiatry for custom orthotics."
                ),
                "days_ago": 35,
            },
        ],
        "imaging": [],
    },
    {
        "name": "Rebecca Chen",
        "dob": "1995-08-30",
        "gender": "female",
        "health_summary": (
            "30-year-old female with anxiety disorder (GAD) on sertraline 100mg, "
            "and mild intermittent low back pain. Otherwise healthy, no chronic conditions."
        ),
        "records": [
            {
                "type": "text",
                "summary": "Psychiatry follow-up — GAD",
                "content": (
                    "Rebecca Chen reports improved anxiety on sertraline 100mg. GAD-7 score 8 "
                    "(mild). Sleep improved with sleep hygiene measures. Continue current dose. "
                    "CBT referral placed. Follow-up in 8 weeks."
                ),
                "days_ago": 15,
            },
        ],
        "imaging": [],
    },
    {
        "name": "Walter Kim",
        "dob": "1948-12-09",
        "gender": "male",
        "health_summary": (
            "77-year-old male with heart failure (HFrEF, EF 35%), pacemaker in situ, "
            "type 2 diabetes, and osteoarthritis of bilateral knees. On guideline-directed "
            "medical therapy including sacubitril/valsartan and carvedilol."
        ),
        "records": [
            {
                "type": "text",
                "summary": "Heart failure clinic visit",
                "content": (
                    "Walter Kim presents for routine HF follow-up. Weight stable, no orthopnea. "
                    "BNP 320 (baseline ~280). JVP not elevated. Lungs clear. "
                    "Continue sacubitril/valsartan 97/103mg BID, carvedilol 25mg BID, "
                    "spironolactone 25mg daily, furosemide 40mg daily."
                ),
                "days_ago": 7,
            },
            {
                "type": "text",
                "summary": "Pacemaker interrogation",
                "content": (
                    "Pacemaker check for Walter Kim. Device: Medtronic Azure XT DR. "
                    "Battery 4.2V (BOL). A-pacing 12%, V-pacing 65%. No arrhythmia episodes. "
                    "Leads impedance and thresholds within normal limits. Next check in 6 months."
                ),
                "days_ago": 50,
            },
            {
                "type": "text",
                "summary": "Echocardiogram report",
                "content": (
                    "TTE for Walter Kim: LV severely dilated, EF 35% by biplane Simpson. "
                    "Moderate mitral regurgitation (functional). RV normal size and function. "
                    "RVSP 38 mmHg. No pericardial effusion."
                ),
                "days_ago": 50,
            },
        ],
        "imaging": [
            {
                "title": "Chest X-ray — cardiac silhouette",
                "image_type": "x-ray",
                "original_url": "https://example.com/imaging/walter-kim/chest-xray.dcm",
                "preview_url": "https://example.com/imaging/walter-kim/chest-xray-thumb.jpg",
            },
            {
                "title": "Echocardiogram — apical 4-chamber",
                "image_type": "ultrasound",
                "original_url": "https://example.com/imaging/walter-kim/echo-a4c.dcm",
                "preview_url": "https://example.com/imaging/walter-kim/echo-a4c-thumb.jpg",
            },
        ],
    },
    {
        "name": "Maria Santos",
        "dob": "1979-03-27",
        "gender": "female",
        "health_summary": (
            "47-year-old female presenting with 2-week history of right upper quadrant pain "
            "and nausea. Ultrasound reveals gallstones. Elevated ALT/AST. "
            "Surgical consult recommended."
        ),
        "records": [
            {
                "type": "text",
                "summary": "ED visit — RUQ pain evaluation",
                "content": (
                    "Maria Santos presents to ED with colicky RUQ pain radiating to right scapula, "
                    "worse after fatty meals. Positive Murphy sign. No fever. "
                    "Labs: WBC 9.8, ALT 68 (H), AST 55 (H), Alk Phos 145 (H), T. Bili 1.8. "
                    "RUQ ultrasound: multiple gallstones, GB wall thickening 4mm, no CBD dilation."
                ),
                "days_ago": 3,
            },
        ],
        "imaging": [
            {
                "title": "RUQ Ultrasound — gallbladder",
                "image_type": "ultrasound",
                "original_url": "https://example.com/imaging/maria-santos/ruq-us.dcm",
                "preview_url": "https://example.com/imaging/maria-santos/ruq-us-thumb.jpg",
            },
        ],
    },
    {
        "name": "David Petrov",
        "dob": "1962-07-14",
        "gender": "male",
        "health_summary": (
            "63-year-old male with newly diagnosed lung nodule on screening CT (12mm, RUL). "
            "30 pack-year smoking history (current smoker). COPD mild. "
            "PET-CT and pulmonology referral pending."
        ),
        "records": [
            {
                "type": "text",
                "summary": "Low-dose CT lung cancer screening",
                "content": (
                    "LDCT for David Petrov (high-risk screening). Findings: 12mm solid nodule "
                    "in right upper lobe, spiculated margins. No mediastinal lymphadenopathy. "
                    "Lung-RADS 4B — suspicious. Recommend PET-CT and pulmonology referral."
                ),
                "days_ago": 5,
            },
            {
                "type": "text",
                "summary": "Smoking cessation counseling note",
                "content": (
                    "David Petrov counseled on smoking cessation. Smokes 1 pack/day x 30 years. "
                    "Motivated to quit given CT findings. Started varenicline 0.5mg daily x 3 days, "
                    "then 0.5mg BID x 4 days, then 1mg BID. NRT patch offered as adjunct."
                ),
                "days_ago": 4,
            },
        ],
        "imaging": [
            {
                "title": "Low-dose CT chest — lung screening",
                "image_type": "ct",
                "original_url": "https://example.com/imaging/david-petrov/ldct-chest.dcm",
                "preview_url": "https://example.com/imaging/david-petrov/ldct-chest-thumb.jpg",
            },
        ],
    },
]

# ---------------------------------------------------------------------------
# Visit scenarios — one per patient, spanning all lifecycle stages
# ---------------------------------------------------------------------------

VISIT_SCENARIOS = [
    # 1. Clara Nguyen — COMPLETED visit (full flow done)
    {
        "patient_name": "Clara Nguyen",
        "status": VisitStatus.COMPLETED,
        "chief_complaint": "Worsening shortness of breath and wheezing for 3 days",
        "confidence": 0.92,
        "routing_suggestion": ["Pulmonology"],
        "routing_decision": ["Pulmonology"],
        "reviewed_by": "Dr. Amanda Foster",
        "intake_notes": (
            "Patient reports increased SOB and wheezing unresponsive to rescue inhaler. "
            "No fever or chest pain. Asthma history — possible exacerbation. "
            "Vitals stable, SpO2 96%."
        ),
        "days_ago": 5,
        "intake_conversation": [
            ("system", "Intake session started for visit {visit_id}."),
            ("assistant", "Good morning! I'm the reception triage assistant. Could you tell me what brings you in today?"),
            ("user", "I've been having trouble breathing for the past 3 days. My inhaler isn't helping like it usually does."),
            ("assistant", "I'm sorry to hear that. Can you describe the breathing difficulty? Is it constant or does it come and go? Any wheezing?"),
            ("user", "It comes and goes but it's worse at night. Yes, there's wheezing, especially when I lie down."),
            ("assistant", "Have you had any fever, chest pain, or cough with colored sputum?"),
            ("user", "No fever, no chest pain. Just a dry cough along with the wheezing."),
            ("assistant", "Thank you. Given your asthma history and these worsening symptoms unresponsive to your rescue inhaler, I'm flagging this as a likely asthma exacerbation. I'll route you to Pulmonology for evaluation. Your oxygen level looks good at 96%."),
        ],
    },
    # 2. Harold Washington — IN_DEPARTMENT (routed, being seen)
    {
        "patient_name": "Harold Washington",
        "status": VisitStatus.IN_DEPARTMENT,
        "chief_complaint": "Increasing leg swelling and weight gain over 1 week",
        "confidence": 0.85,
        "routing_suggestion": ["Cardiology", "Nephrology"],
        "routing_decision": ["Cardiology"],
        "reviewed_by": "Dr. Michael Torres",
        "intake_notes": (
            "Patient notes 5lb weight gain in past week with bilateral lower extremity edema. "
            "History of AF and COPD. Denies chest pain or acute dyspnea at rest. "
            "Possible heart failure exacerbation vs medication non-compliance."
        ),
        "days_ago": 1,
        "intake_conversation": [
            ("system", "Intake session started for visit {visit_id}."),
            ("assistant", "Hello Mr. Washington. What brings you to the hospital today?"),
            ("user", "My legs have been swelling up a lot this past week and I've gained about 5 pounds."),
            ("assistant", "I see. Have you been taking all your medications as prescribed? Specifically the furosemide and other heart medications?"),
            ("user", "I ran out of the water pill a few days ago and haven't been able to refill it."),
            ("assistant", "That could explain the fluid retention. Are you having any difficulty breathing, especially when lying flat?"),
            ("user", "A little more than usual, but not terrible. I've been sleeping with an extra pillow."),
            ("assistant", "Thank you for sharing that. Given your heart failure history and these symptoms from missing your diuretic, I'm routing you to Cardiology for urgent assessment. They may need to restart your furosemide and check your fluid status."),
        ],
    },
    # 3. Sofia Ramirez — ROUTED (doctor approved, not yet in dept)
    {
        "patient_name": "Sofia Ramirez",
        "status": VisitStatus.ROUTED,
        "chief_complaint": "Severe migraine with visual aura lasting 6 hours, unresponsive to sumatriptan",
        "confidence": 0.78,
        "routing_suggestion": ["Neurology", "Emergency Medicine"],
        "routing_decision": ["Neurology"],
        "reviewed_by": "Dr. Sarah Lin",
        "intake_notes": (
            "Patient presents with worst migraine of her life — 8/10 pain with zigzag visual aura. "
            "Sumatriptan taken 2 hours ago with no relief. No neck stiffness or fever. "
            "Neuro exam grossly intact. Consider IV rescue therapy."
        ),
        "days_ago": 0,
        "intake_conversation": [
            ("system", "Intake session started for visit {visit_id}."),
            ("assistant", "Hi Sofia, I can see you're in some discomfort. Can you tell me what's going on?"),
            ("user", "I have the worst migraine I've ever had. The light is killing me and I'm seeing zigzag lines. It's been going on for 6 hours."),
            ("assistant", "I'm sorry you're going through this. Did you take your sumatriptan?"),
            ("user", "Yes, about 2 hours ago. It hasn't helped at all this time."),
            ("assistant", "That's concerning since it usually works for you. Any nausea, vomiting, or neck stiffness?"),
            ("user", "Nauseous yes, but no vomiting. No neck stiffness."),
            ("assistant", "Any weakness, numbness, or trouble speaking?"),
            ("user", "No, just the visual stuff and terrible pain."),
            ("assistant", "Thank you. Since this is your worst headache and isn't responding to your usual medication, I'm routing you to Neurology for urgent evaluation and possible IV rescue therapy."),
        ],
    },
    # 4. James Okafor — PENDING_REVIEW (low confidence, needs doctor)
    {
        "patient_name": "James Okafor",
        "status": VisitStatus.PENDING_REVIEW,
        "chief_complaint": "Burning sensation in both feet worsening over 2 weeks, new ulcer on left big toe",
        "confidence": 0.55,
        "routing_suggestion": ["Endocrinology", "Podiatry", "Vascular Surgery"],
        "routing_decision": None,
        "reviewed_by": None,
        "intake_notes": (
            "Diabetic patient with worsening neuropathic pain bilateral feet and new ulcer "
            "on left great toe (1cm, superficial, no signs of infection). "
            "Multiple departments may be needed — routing confidence low."
        ),
        "days_ago": 0,
        "intake_conversation": [
            ("system", "Intake session started for visit {visit_id}."),
            ("assistant", "Good afternoon Mr. Okafor. How can I help you today?"),
            ("user", "The burning in my feet has gotten much worse these past two weeks. And I noticed a sore on my big toe that won't heal."),
            ("assistant", "I'm sorry to hear that. Can you describe the sore? How big is it, and is there any redness, warmth, or drainage?"),
            ("user", "It's about the size of a dime. The skin broke open. No pus but it's been there for about a week now."),
            ("assistant", "Given your diabetes, we need to take foot wounds seriously. Are you checking your blood sugars regularly? What have they been running?"),
            ("user", "They've been a bit high lately, around 180-200 in the mornings."),
            ("assistant", "Thank you for that information. You may need to see multiple specialists — Endocrinology for your diabetes control, Podiatry for the wound, and possibly Vascular Surgery to check circulation. I'm going to flag this for a doctor to review the best routing."),
        ],
    },
    # 5. Rebecca Chen — AUTO_ROUTED (high confidence, awaiting doctor review)
    {
        "patient_name": "Rebecca Chen",
        "status": VisitStatus.AUTO_ROUTED,
        "chief_complaint": "Acute panic attack with chest tightness and hyperventilation",
        "confidence": 0.88,
        "routing_suggestion": ["Psychiatry"],
        "routing_decision": None,
        "reviewed_by": None,
        "intake_notes": (
            "Patient presenting with acute anxiety episode — chest tightness, tingling in hands, "
            "rapid breathing. EKG normal, troponin negative. Known GAD on sertraline. "
            "Likely panic attack. Vitals normalizing."
        ),
        "days_ago": 0,
        "intake_conversation": [
            ("system", "Intake session started for visit {visit_id}."),
            ("assistant", "Hello Rebecca. I can see you're feeling distressed. Take a slow breath if you can. What's happening?"),
            ("user", "I feel like I can't breathe. My chest is so tight and my hands are tingling. I think something is really wrong."),
            ("assistant", "I understand how frightening that feels. We've checked your heart with an EKG and blood tests — those are both normal, which is very reassuring. Have you experienced episodes like this before?"),
            ("user", "Yes... I have anxiety disorder. But this one feels worse than usual. I thought I was having a heart attack."),
            ("assistant", "That's a very common feeling during a panic attack, and it's good that your cardiac workup is clear. Are you still taking your sertraline?"),
            ("user", "Yes, 100mg. But I've been under a lot of stress at work lately."),
            ("assistant", "That makes sense. Increased stress can trigger breakthrough anxiety despite medication. I'm routing you to Psychiatry for acute management and to discuss whether your medication needs adjustment."),
        ],
    },
    # 6. Walter Kim — TRIAGED (intake done, awaiting auto-routing)
    {
        "patient_name": "Walter Kim",
        "status": VisitStatus.TRIAGED,
        "chief_complaint": "Dizziness and near-syncope when standing up",
        "confidence": None,
        "routing_suggestion": None,
        "routing_decision": None,
        "reviewed_by": None,
        "intake_notes": (
            "77-year-old HF patient with orthostatic dizziness x 3 days. "
            "BP sitting 110/70, standing 85/55 (orthostatic positive). "
            "Pacemaker in situ. May need cardiology and medication review."
        ),
        "days_ago": 0,
        "intake_conversation": [
            ("system", "Intake session started for visit {visit_id}."),
            ("assistant", "Good morning Mr. Kim. What brings you in today?"),
            ("user", "I've been getting very dizzy whenever I stand up. Almost passed out twice yesterday."),
            ("assistant", "That's concerning. When did this start?"),
            ("user", "About 3 days ago. It's been getting worse."),
            ("assistant", "Have there been any changes to your medications recently?"),
            ("user", "My doctor increased the water pill last week because my legs were swelling."),
            ("assistant", "That could be relevant — your blood pressure drops significantly when you stand up, which can happen if the diuretic dose is too high. Any chest pain, palpitations, or shortness of breath?"),
            ("user", "No chest pain. Maybe a little short of breath but that's normal for me."),
            ("assistant", "Thank you. I've documented the orthostatic blood pressure changes and your recent medication change. This information will help the routing system determine the right department for you."),
        ],
    },
    # 7. Maria Santos — INTAKE (just arrived, conversation in progress)
    {
        "patient_name": "Maria Santos",
        "status": VisitStatus.INTAKE,
        "chief_complaint": "Recurrent right upper quadrant pain after eating",
        "confidence": None,
        "routing_suggestion": None,
        "routing_decision": None,
        "reviewed_by": None,
        "intake_notes": None,
        "days_ago": 0,
        "intake_conversation": [
            ("system", "Intake session started for visit {visit_id}."),
            ("assistant", "Hello! Welcome to the hospital. I'll be helping with your intake. What brings you in today?"),
            ("user", "The pain in my right side is back. It happens every time I eat something greasy. My doctor said I have gallstones and need to see a surgeon."),
            ("assistant", "I see you were in the ED recently for this. Is the pain happening right now?"),
            ("user", "It started about an hour ago after lunch. It's crampy and goes to my back."),
        ],
    },
    # 8. David Petrov — PENDING_REVIEW (urgent, needs oncology routing decision)
    {
        "patient_name": "David Petrov",
        "status": VisitStatus.PENDING_REVIEW,
        "chief_complaint": "Follow-up for suspicious lung nodule found on screening CT",
        "confidence": 0.62,
        "routing_suggestion": ["Pulmonology", "Oncology", "Thoracic Surgery"],
        "routing_decision": None,
        "reviewed_by": None,
        "intake_notes": (
            "63-year-old current smoker with 12mm spiculated RUL nodule (Lung-RADS 4B). "
            "PET-CT not yet done. Needs multi-disciplinary discussion. "
            "Patient anxious but motivated — started smoking cessation this week."
        ),
        "days_ago": 0,
        "intake_conversation": [
            ("system", "Intake session started for visit {visit_id}."),
            ("assistant", "Good afternoon Mr. Petrov. I see you're here for a follow-up. Can you tell me what's going on?"),
            ("user", "They found something on my lung scan last week. A spot. They want me to get more tests."),
            ("assistant", "I understand. That must be stressful. Do you have any new symptoms since the scan — any coughing, coughing up blood, weight loss, or night sweats?"),
            ("user", "No blood. I do cough but I've smoked for 30 years so that's nothing new. I've lost maybe 5 pounds but I've been too anxious to eat much."),
            ("assistant", "Thank you for sharing that. Have you started the smoking cessation medication that was prescribed?"),
            ("user", "Yes, I started the Chantix a few days ago. I really want to quit now."),
            ("assistant", "That's a great step. Given the nodule findings and the need for PET-CT and specialist evaluation, your case will need to be reviewed by a doctor to determine the best combination of specialists. I'm flagging this for priority review."),
        ],
    },
]


# ---------------------------------------------------------------------------
# Helper — generate visit IDs
# ---------------------------------------------------------------------------

def generate_visit_id(index: int, days_ago: int) -> str:
    """Generate a visit ID in VIS-YYYYMMDD-### format."""
    visit_date = datetime.utcnow() - timedelta(days=days_ago)
    return f"VIS-{visit_date.strftime('%Y%m%d')}-{index:03d}"


# ---------------------------------------------------------------------------
# Seeding functions
# ---------------------------------------------------------------------------

async def seed_patients_and_records(session) -> dict[str, Patient]:
    """Create patients with medical records and imaging. Returns name→Patient map."""
    print("Seeding patients, records, and imaging...")
    patient_map: dict[str, Patient] = {}

    for pdata in PATIENTS:
        # Upsert patient
        stmt = select(Patient).where(
            Patient.name == pdata["name"], Patient.dob == pdata["dob"]
        )
        patient = (await session.execute(stmt)).scalar_one_or_none()

        if patient:
            patient.gender = pdata["gender"]
            patient.health_summary = pdata["health_summary"]
            patient.health_summary_status = "completed"
            patient.health_summary_updated_at = datetime.utcnow()
            print(f"  - Updated {patient.name}")
        else:
            patient = Patient(
                name=pdata["name"],
                dob=pdata["dob"],
                gender=pdata["gender"],
                health_summary=pdata["health_summary"],
                health_summary_status="completed",
                health_summary_updated_at=datetime.utcnow(),
            )
            session.add(patient)
            await session.flush()
            print(f"  + Created {patient.name}")

        # Medical records
        for rec in pdata["records"]:
            exists = (
                await session.execute(
                    select(MedicalRecord).where(
                        MedicalRecord.patient_id == patient.id,
                        MedicalRecord.summary == rec["summary"],
                    )
                )
            ).scalar_one_or_none()
            if not exists:
                session.add(
                    MedicalRecord(
                        patient_id=patient.id,
                        record_type=rec["type"],
                        content=rec["content"],
                        summary=rec["summary"],
                        created_at=datetime.utcnow() - timedelta(days=rec["days_ago"]),
                    )
                )

        # Imaging
        for img in pdata.get("imaging", []):
            exists = (
                await session.execute(
                    select(Imaging).where(
                        Imaging.patient_id == patient.id,
                        Imaging.title == img["title"],
                    )
                )
            ).scalar_one_or_none()
            if not exists:
                session.add(
                    Imaging(
                        patient_id=patient.id,
                        title=img["title"],
                        image_type=img["image_type"],
                        original_url=img["original_url"],
                        preview_url=img["preview_url"],
                    )
                )

        patient_map[pdata["name"]] = patient

    await session.commit()
    print(f"  Patients seeded: {len(patient_map)}")
    return patient_map


async def seed_visits_with_intake(session, patient_map: dict[str, Patient]):
    """Create visits at every lifecycle stage with linked intake chat sessions."""
    print("Seeding visits and intake conversations...")
    created = 0

    for idx, scenario in enumerate(VISIT_SCENARIOS, start=1):
        patient = patient_map.get(scenario["patient_name"])
        if not patient:
            print(f"  ! Patient '{scenario['patient_name']}' not found, skipping")
            continue

        visit_id = generate_visit_id(idx, scenario["days_ago"])

        # Skip if visit already exists
        exists = (
            await session.execute(
                select(Visit).where(Visit.visit_id == visit_id)
            )
        ).scalar_one_or_none()
        if exists:
            print(f"  - Visit {visit_id} already exists, skipping")
            continue

        # Create intake chat session
        chat_session = ChatSession(
            title=f"Intake - {visit_id}",
            created_at=datetime.utcnow() - timedelta(days=scenario["days_ago"]),
            updated_at=datetime.utcnow() - timedelta(days=scenario["days_ago"]),
        )
        session.add(chat_session)
        await session.flush()

        # Add conversation messages
        base_time = datetime.utcnow() - timedelta(days=scenario["days_ago"])
        for msg_idx, (role, content) in enumerate(scenario["intake_conversation"]):
            formatted_content = content.format(visit_id=visit_id)
            session.add(
                ChatMessage(
                    session_id=chat_session.id,
                    role=role,
                    content=formatted_content,
                    status="completed",
                    created_at=base_time + timedelta(minutes=msg_idx),
                )
            )

        # Create visit
        visit = Visit(
            visit_id=visit_id,
            patient_id=patient.id,
            status=scenario["status"].value,
            confidence=scenario["confidence"],
            routing_suggestion=scenario["routing_suggestion"],
            routing_decision=scenario["routing_decision"],
            chief_complaint=scenario["chief_complaint"],
            intake_notes=scenario["intake_notes"],
            intake_session_id=chat_session.id,
            reviewed_by=scenario["reviewed_by"],
            created_at=base_time,
            updated_at=datetime.utcnow() - timedelta(days=max(0, scenario["days_ago"] - 1)),
        )
        session.add(visit)
        created += 1
        status_label = scenario["status"].value.upper()
        print(f"  + {visit_id} | {scenario['patient_name']:<20} | {status_label}")

    await session.commit()
    print(f"  Visits seeded: {created}")


async def seed_reception_agent(session):
    """Ensure a reception triage agent exists (required by the visit creation endpoint)."""
    print("Seeding reception triage agent...")
    existing = (
        await session.execute(select(SubAgent).where(SubAgent.role == "reception_triage"))
    ).scalar_one_or_none()

    reception_system_prompt = (
        "You are a hospital reception triage assistant. You conduct patient intake autonomously.\n\n"
        "**Your Role:** Interview patients, collect their information, register them in the system, "
        "create a visit record, and determine which department they should be routed to.\n\n"
        "**Intake Workflow:**\n"
        "1. Greet the patient warmly and explain you'll be helping them get checked in\n"
        "2. Collect their **full name**, **date of birth**, and **gender**\n"
        "3. Search for their existing record using `find_patient(name, dob)`\n"
        "4. If no record found, create one using `create_patient(name, dob, gender)`\n"
        "5. Create a visit using `create_visit(patient_id)` — note the visit ID returned\n"
        "6. Ask about their **chief complaint** — why are they visiting today?\n"
        "7. Ask about **symptom details** — onset, duration, severity (1-10), location, what makes it better/worse\n"
        "8. Ask about **medical history** — chronic conditions, past surgeries\n"
        "9. Ask about **current medications** and **allergies**\n"
        "10. Based on all information gathered, determine the appropriate department(s) and your confidence level\n"
        "11. Call `complete_triage(id, chief_complaint, intake_notes, routing_suggestion, confidence)` "
        "where id is the visit DB ID from step 5\n"
        "12. Inform the patient that they have been checked in and will be seen by the appropriate department\n\n"
        "**Available Tools:**\n"
        "- `find_patient(name, dob)` — Search for existing patient records\n"
        "- `create_patient(name, dob, gender)` — Create a new patient record\n"
        "- `create_visit(patient_id)` — Create a new visit (returns visit ID)\n"
        "- `complete_triage(id, chief_complaint, intake_notes, routing_suggestion, confidence)` — "
        "Finalize triage with routing suggestion\n\n"
        "**Guidelines:**\n"
        "- Ask **one question at a time** — do not overwhelm the patient\n"
        "- Be **empathetic and professional** — use simple, clear language\n"
        "- **Follow up** on concerning symptoms with clarifying questions\n"
        "- If the patient describes an emergency (chest pain, difficulty breathing, severe bleeding), "
        "flag it immediately as **URGENT** and route to Emergency with high confidence\n"
        "- Use markdown formatting for clear, readable responses\n"
        "- Keep responses concise — patients should not feel interrogated\n"
        "- Do NOT provide diagnoses or medical advice — your job is to collect information and route\n"
        "- If asked non-medical questions, politely redirect to the intake process\n\n"
        "**Routing Confidence Guide:**\n"
        "- 0.9-1.0: Clear, textbook presentation matching one department\n"
        "- 0.7-0.89: Strong indication but some ambiguity\n"
        "- 0.5-0.69: Multiple departments possible, needs doctor review\n"
        "- Below 0.5: Unclear presentation, definitely needs doctor review\n\n"
        "**Response Format:**\n"
        "- Address the patient directly using second person\n"
        "- Acknowledge what the patient shared before asking the next question\n"
        "- Use a warm, conversational tone\n"
        "- Call tools silently — do not describe tool calls to the patient"
    )

    if existing:
        print(f"  - Reception agent already exists (id={existing.id}), updating system prompt...")
        existing.system_prompt = reception_system_prompt
        await session.commit()
        print("  + Updated Reception Triage agent system prompt")
        return

    agent = SubAgent(
        name="Reception Triage",
        role="reception_triage",
        description=(
            "Conducts patient intake interviews, collects chief complaints and symptoms, "
            "and generates triage assessments with department routing suggestions."
        ),
        system_prompt=reception_system_prompt,
        color="#14b8a6",
        icon="ClipboardList",
        is_template=True,
    )
    session.add(agent)
    await session.commit()
    print("  + Created Reception Triage agent")


async def clear_visits_and_chats(session):
    """Remove visits and intake chat sessions."""
    print("Clearing visits and intake chat sessions...")
    await session.execute(Visit.__table__.delete())
    await session.execute(ChatMessage.__table__.delete())
    await session.execute(ChatSession.__table__.delete())
    await session.commit()
    print("  Cleared visits, messages, and sessions")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def main(clear_first: bool = False):
    print("=" * 65)
    print("  Full-Flow Mock Data Seeder")
    print("  Patients + Records + Imaging + Visits + Intake Conversations")
    print("=" * 65)

    async with AsyncSessionLocal() as session:
        if clear_first:
            await clear_visits_and_chats(session)

        await seed_reception_agent(session)
        patient_map = await seed_patients_and_records(session)
        await seed_visits_with_intake(session, patient_map)

    print("=" * 65)
    print("  Done! Visit statuses seeded:")
    print()
    for scenario in VISIT_SCENARIOS:
        print(f"    {scenario['status'].value:<16} — {scenario['patient_name']}")
    print()
    print("  Next: python -m src.api")
    print("        Open /reception for intake view")
    print("        Open /doctor/queue for review queue")
    print("=" * 65)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Seed full-flow mock data")
    parser.add_argument(
        "--clear", action="store_true",
        help="Clear visits and chat sessions before seeding",
    )
    args = parser.parse_args()
    asyncio.run(main(clear_first=args.clear))
