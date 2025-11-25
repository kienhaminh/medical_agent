import asyncio
import sys
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add project root to python path
sys.path.append(os.getcwd())

from src.tools.builtin.patient_tool import query_patient_info

def test_query_patient_info():
    print("Testing query_patient_info tool...")
    
    # Test case 1: Query by ID
    print("\n1. Querying by ID '22'...")
    try:
        result = query_patient_info("22")
        print("Result:")
        print("-" * 40)
        print(result)
        print("-" * 40)
        
        if "Emily Hernandez" in result:
             print("✓ Successfully found patient by ID")
        else:
             print("✗ Failed to find expected patient name")
             
    except Exception as e:
        print(f"✗ Error: {e}")

    # Test case 2: Query by Name
    print("\n2. Querying by Name 'Emily'...")
    try:
        result = query_patient_info("Emily")
        print("Result:")
        print("-" * 40)
        print(result)
        print("-" * 40)
        
        if "Emily Hernandez" in result:
             print("✓ Successfully found patient by Name")
        else:
             print("✗ Failed to find expected patient name")
             
    except Exception as e:
        print(f"✗ Error: {e}")

    # Test case 3: Non-existent patient
    print("\n3. Querying non-existent patient '99999'...")
    try:
        result = query_patient_info("99999")
        print("Result:")
        print(result)
        
        if "No patient found" in result:
             print("✓ Correctly handled non-existent patient")
        else:
             print("✗ Unexpected response for non-existent patient")
             
    except Exception as e:
        print(f"✗ Error: {e}")

if __name__ == "__main__":
    test_query_patient_info()
