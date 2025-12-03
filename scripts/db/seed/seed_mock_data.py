"""
Seed a minimal but realistic dataset that matches the current SQLAlchemy models.

The script populates:
- Patients with structured health summaries
- Linked medical records
- Core patient data tools with proper symbols/scope
"""

import asyncio
from datetime import datetime, timedelta
from typing import List, Tuple

from sqlalchemy import select

from src.config.database import AsyncSessionLocal, MedicalRecord, Patient, Tool

MOCK_PATIENTS: List[Tuple[str, str, str, str, List[Tuple[str, str, int]]]] = [
    (
        "Ava Thompson",
        "1988-03-21",
        "female",
        "Type 2 diabetes with weight loss after GLP-1 therapy. No acute issues reported.",
        [
            (
                "Endocrinology follow-up",
                "Follow-up for {patient_name}. HbA1c improved to 6.9% after semaglutide. Plan: continue metformin 1000mg BID, "
                "semaglutide 1mg weekly, repeat labs in 3 months.",
                14,
            ),
            ("Nutrition tele-visit", "Dietitian call with {patient_name}. Reinforced carb counting and scheduled CGM data review.", 45),
        ],
    ),
    (
        "Mateo Alvarez",
        "1975-09-12",
        "male",
        "Hypertension and hyperlipidemia. Training for half marathon, good medication adherence.",
        [
            (
                "Cardiology consult",
                "{patient_name} evaluated for exertional chest pressure. EKG normal, treadmill stress planned. Losartan increased to 100mg daily.",
                7,
            ),
            ("Lipid clinic visit", "LDL remains 145 mg/dL for {patient_name}. Added ezetimibe to atorvastatin with goal LDL <70 mg/dL.", 32),
        ],
    ),
    (
        "Eleanor Price",
        "1954-02-02",
        "female",
        "History of left breast cancer (lumpectomy 2018). Under surveillance; mild neuropathy persists.",
        [
            ("Oncology survivorship visit", "{patient_name} reports no new masses. Mammogram negative (BI-RADS 1). Continue annual imaging.", 60),
            ("Primary care visit", "{patient_name} seen for neuropathy management. Gabapentin titrated to 300mg nightly, PT referral placed.", 10),
        ],
    ),
]

CUSTOM_TOOLS: List[Tuple[str, str, str]] = [
    ("Query Patient Basic Info", "query_patient_basic_info", "Return patient demographics filtered by patient ID, name, or DOB."),
    ("Query Patient Medical Records", "query_patient_medical_records", "Retrieve structured medical records for a specific patient ID."),
    ("Query Patient Imaging", "query_patient_imaging", "List available imaging studies, modalities, and thumbnails for a patient."),
]


async def seed_patients(session) -> List[Tuple[Patient, List[Tuple[str, str, int]]]]:
    """Insert or update patients based on name + DOB."""
    print("Seeding patients...")
    seeded: List[Tuple[Patient, List[Tuple[str, str, int]]]] = []
    now = datetime.utcnow()

    for name, dob, gender, summary, records in MOCK_PATIENTS:
        stmt = select(Patient).where(Patient.name == name, Patient.dob == dob)
        existing = (await session.execute(stmt)).scalar_one_or_none()

        if existing:
            existing.gender = gender
            existing.health_summary = summary
            existing.health_summary_status = "completed"
            existing.health_summary_updated_at = now
            patient = existing
            print(f"  • Updated patient {patient.name}")
        else:
            patient = Patient(
                name=name,
                dob=dob,
                gender=gender,
                health_summary=summary,
                health_summary_status="completed",
                health_summary_updated_at=now,
            )
            session.add(patient)
            await session.flush()
            print(f"  • Created patient {patient.name}")

        seeded.append((patient, records))

    await session.commit()
    print(f"✓ Patients seeded ({len(seeded)})")
    return seeded


async def seed_medical_records(session, patients: List[Tuple[Patient, List[Tuple[str, str, int]]]]):
    """Attach canned medical records per patient."""
    print("Seeding medical records...")
    created = 0

    for patient, records in patients:
        for summary, content, days_ago in records:
            stmt = select(MedicalRecord).where(
                MedicalRecord.patient_id == patient.id,
                MedicalRecord.summary == summary,
            )
            if (await session.execute(stmt)).scalar_one_or_none():
                continue

            created_at = datetime.utcnow() - timedelta(days=days_ago)
            session.add(
                MedicalRecord(
                    patient_id=patient.id,
                    record_type="text",
                    content=content.format(patient_name=patient.name),
                    summary=summary,
                    created_at=created_at,
                )
            )
            created += 1

    await session.commit()
    print(f"✓ Medical records seeded ({created})")


async def seed_custom_tools(session):
    """Ensure core patient data tools exist with correct metadata."""
    print("Seeding patient data tools...")

    for name, symbol, description in CUSTOM_TOOLS:
        tool_data = {
            "name": name,
            "symbol": symbol,
            "description": description,
            "scope": "global",
            "tool_type": "function",
            "enabled": True,
            "test_passed": True,
        }
        stmt = select(Tool).where(Tool.symbol == symbol)
        tool = (await session.execute(stmt)).scalar_one_or_none()

        if tool:
            for key, value in tool_data.items():
                setattr(tool, key, value)
            print(f"  • Updated tool {symbol}")
        else:
            session.add(Tool(**tool_data))
            print(f"  • Created tool {symbol}")

    await session.commit()
    print(f"✓ Tool sync complete ({len(CUSTOM_TOOLS)})")


async def clear_existing_data(session):
    """Remove seeded patients and records (tools are upserted separately)."""
    print("Clearing patient and record data...")
    await session.execute(MedicalRecord.__table__.delete())
    await session.execute(Patient.__table__.delete())
    await session.commit()
    print("✓ Cleared patients and records")


async def main(clear_first=False):
    """Entrypoint used by @seed."""
    print("=" * 60)
    print("AI Agent Mock Data Seeder (schema-aligned)")
    print("=" * 60)

    async with AsyncSessionLocal() as session:
        if clear_first:
            await clear_existing_data(session)

        patients = await seed_patients(session)
        await seed_medical_records(session, patients)
        await seed_custom_tools(session)

    print("=" * 60)
    print(f"✓ Mock data ready ({len(MOCK_PATIENTS)} patients, {len(CUSTOM_TOOLS)} tools)")
    print("=" * 60)
    print("Next: python -m src.api  |  curl http://localhost:8000/api/patients")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Seed mock data for AI Agent")
    parser.add_argument("--clear", action="store_true", help="Delete patients/records before seeding")

    args = parser.parse_args()
    asyncio.run(main(clear_first=args.clear))
