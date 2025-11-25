"""
Test script to query the Patient Tool directly via database and function.
"""
import sys
import os
import asyncio
from dotenv import load_dotenv
from sqlalchemy import select

# Load environment variables
load_dotenv()

# Add project root to python path
sys.path.append(os.getcwd())

from src.config.database import AsyncSessionLocal, Patient, MedicalRecord
from src.tools.builtin.patient_tool import query_patient_info

async def test_patient_query():
    print("--- Testing Patient Tool ---")
    
    # 1. Check Database directly
    print("\n1. Checking Database for Patient 22...")
    async with AsyncSessionLocal() as session:
        # List all patients first to see what we have
        result = await session.execute(select(Patient))
        patients = result.scalars().all()
        print(f"  Found {len(patients)} patients in DB:")
        for p in patients[:5]:
            print(f"    - ID: {p.id}, Name: {p.name}")
            
        # Check specific patient
        result = await session.execute(
            select(Patient).where(Patient.id == 22)
        )
        p22 = result.scalar_one_or_none()
        if p22:
            print(f"  ✓ Found Patient 22: {p22.name}")
        else:
            print("  ✗ Patient 22 NOT found in DB")

    # 2. Check Tool Function
    print("\n2. Testing query_patient_info function...")
    try:
        # The tool uses synchronous SessionLocal, which is fine
        response = query_patient_info("22")
        print("  Tool Response:")
        print("-" * 40)
        print(response)
        print("-" * 40)
    except Exception as e:
        print(f"  ✗ Tool execution failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_patient_query())
