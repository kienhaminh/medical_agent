"""Unit Test for Output Schema (no database required).

Tests the output schema and formatting logic in isolation.
"""

import sys
import os

# Add src to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import only the schema module to avoid database initialization
import importlib.util
spec = importlib.util.spec_from_file_location(
    "output_schemas",
    os.path.join(os.path.dirname(__file__), '../src/agent/output_schemas.py')
)
output_schemas = importlib.util.module_from_spec(spec)
spec.loader.exec_module(output_schemas)

InternistOutputSchema = output_schemas.InternistOutputSchema
format_internist_output = output_schemas.format_internist_output
get_output_instructions_for_agent = output_schemas.get_output_instructions_for_agent


def test_output_schema_validation():
    """Test that the schema validates correct and rejects incorrect data."""
    print("\n=== Testing Output Schema Validation ===\n")

    # Valid data
    valid_data = {
        "patient_summary": "65-year-old male with acute chest pain radiating to left arm.",
        "key_findings": [
            "Chest pain: Sudden onset, crushing quality, 8/10 severity",
            "Radiation to left arm with numbness",
            "Diaphoresis and shortness of breath",
            "History of hypertension and hyperlipidemia"
        ],
        "differential_diagnosis": [
            {
                "diagnosis": "Acute Myocardial Infarction (AMI)",
                "reasoning": "Classic presentation with chest pain radiating to arm, cardiovascular risk factors"
            },
            {
                "diagnosis": "Unstable Angina",
                "reasoning": "Similar presentation but may have less severe ischemia"
            },
            {
                "diagnosis": "Aortic Dissection",
                "reasoning": "Sudden onset severe chest pain, though radiation pattern more typical of AMI"
            }
        ],
        "clinical_assessment": "High suspicion for acute coronary syndrome given classic presentation of crushing chest pain with radiation to left arm in patient with multiple cardiovascular risk factors. Immediate cardiac workup is warranted.",
        "recommendations": [
            "Immediate ECG to assess for ST elevation or other ischemic changes",
            "Cardiac biomarkers (troponin, CK-MB) stat and serial measurements",
            "Continuous cardiac monitoring",
            "Aspirin 325mg chewed if not contraindicated",
            "Transfer to emergency department/cardiac catheterization lab",
            "Consider nitroglycerin for symptom relief if BP adequate",
            "Risk stratify using TIMI or GRACE score"
        ],
        "priority": "emergent",
        "red_flags": [
            "Acute chest pain with arm radiation suggests ACS",
            "Diaphoresis indicates sympathetic activation",
            "Known cardiovascular risk factors increase probability"
        ],
        "additional_notes": "Patient requires immediate evaluation in emergency setting. Door-to-balloon time critical if STEMI confirmed."
    }

    try:
        schema = InternistOutputSchema(**valid_data)
        print("✅ Valid data passed schema validation")
        print(f"   Priority: {schema.priority}")
        print(f"   # Key Findings: {len(schema.key_findings)}")
        print(f"   # Differential Diagnoses: {len(schema.differential_diagnosis)}")
        print(f"   # Recommendations: {len(schema.recommendations)}")
    except Exception as e:
        print(f"❌ Valid data failed validation: {e}")
        return False

    # Test invalid data - missing required field
    print("\n--- Testing Invalid Data (missing field) ---")
    invalid_data = valid_data.copy()
    del invalid_data["patient_summary"]

    try:
        schema = InternistOutputSchema(**invalid_data)
        print("❌ Invalid data (missing field) passed validation - should have failed!")
        return False
    except Exception as e:
        print(f"✅ Invalid data correctly rejected: {type(e).__name__}")

    # Test invalid data - empty findings list
    print("\n--- Testing Invalid Data (empty findings) ---")
    invalid_data = valid_data.copy()
    invalid_data["key_findings"] = []

    try:
        schema = InternistOutputSchema(**invalid_data)
        print("❌ Invalid data (empty findings) passed validation - should have failed!")
        return False
    except Exception as e:
        print(f"✅ Invalid data correctly rejected: {type(e).__name__}")

    # Test invalid data - invalid priority
    print("\n--- Testing Invalid Data (invalid priority) ---")
    invalid_data = valid_data.copy()
    invalid_data["priority"] = "medium"  # Not a valid enum value

    try:
        schema = InternistOutputSchema(**invalid_data)
        print("❌ Invalid data (invalid priority) passed validation - should have failed!")
        return False
    except Exception as e:
        print(f"✅ Invalid data correctly rejected: {type(e).__name__}")

    # Test invalid data - differential without reasoning
    print("\n--- Testing Invalid Data (malformed differential) ---")
    invalid_data = valid_data.copy()
    invalid_data["differential_diagnosis"] = [
        {"diagnosis": "AMI"}  # Missing 'reasoning'
    ]

    try:
        schema = InternistOutputSchema(**invalid_data)
        print("❌ Invalid data (malformed differential) passed validation - should have failed!")
        return False
    except Exception as e:
        print(f"✅ Invalid data correctly rejected: {type(e).__name__}")

    print("\n✅ All schema validation tests passed!\n")
    return True


def test_output_formatting():
    """Test that the formatter produces readable markdown."""
    print("\n=== Testing Output Formatting ===\n")

    test_data = {
        "patient_summary": "42-year-old female presenting with severe headache and photophobia.",
        "key_findings": [
            "Sudden onset severe headache described as 'worst of life'",
            "Photophobia and neck stiffness",
            "No fever or focal neurological deficits",
            "Blood pressure elevated at 160/95 mmHg"
        ],
        "differential_diagnosis": [
            {
                "diagnosis": "Subarachnoid Hemorrhage",
                "reasoning": "Classic 'thunderclap' headache with meningismus, must be ruled out immediately"
            },
            {
                "diagnosis": "Migraine with Aura",
                "reasoning": "Photophobia present but severity and suddenness atypical"
            },
            {
                "diagnosis": "Meningitis",
                "reasoning": "Neck stiffness present but absence of fever less typical"
            }
        ],
        "clinical_assessment": "Concerning presentation requiring urgent neurological evaluation. The sudden onset severe headache with meningismus raises significant concern for subarachnoid hemorrhage which requires immediate imaging and possible neurosurgical consultation.",
        "recommendations": [
            "Urgent non-contrast CT head to rule out hemorrhage",
            "If CT negative, proceed with lumbar puncture to assess for xanthochromia",
            "Neurological consult",
            "Control blood pressure with IV antihypertensives",
            "Minimize stimulation (dark, quiet room)",
            "NPO status in case neurosurgical intervention needed"
        ],
        "priority": "emergent",
        "red_flags": [
            "Sudden onset 'worst headache of life' classic for SAH",
            "Meningismus without fever suggests non-infectious etiology"
        ]
    }

    try:
        formatted = format_internist_output(test_data)
        print("✅ Formatting successful\n")
        print("--- Formatted Output Preview ---")
        print(formatted)
        print("--- End Preview ---\n")

        # Verify key sections are present
        required_sections = [
            "Priority:",
            "Patient Summary:",
            "Key Clinical Findings:",
            "Red Flags:",
            "Differential Diagnosis:",
            "Clinical Assessment:",
            "Recommendations:"
        ]

        for section in required_sections:
            if section in formatted:
                print(f"✅ Section present: {section}")
            else:
                print(f"❌ Section missing: {section}")
                return False

        # Check emoji indicators
        if "🔴" in formatted:  # Emergent priority
            print("✅ Priority emoji present")
        else:
            print("❌ Priority emoji missing")

        print("\n✅ All formatting tests passed!\n")
        return True

    except Exception as e:
        print(f"❌ Formatting failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_output_instructions():
    """Test that output instructions are generated correctly."""
    print("\n=== Testing Output Instructions ===\n")

    instructions = get_output_instructions_for_agent("clinical_text")

    if not instructions:
        print("❌ No instructions returned for clinical_text agent")
        return False

    print("✅ Instructions generated\n")

    # Check for key components
    required_components = [
        "OUTPUT FORMAT REQUIREMENTS",
        "patient_summary",
        "key_findings",
        "differential_diagnosis",
        "clinical_assessment",
        "recommendations",
        "priority",
        "routine|urgent|emergent",
        "JSON"
    ]

    for component in required_components:
        if component in instructions:
            print(f"✅ Component present: {component}")
        else:
            print(f"❌ Component missing: {component}")
            return False

    print("\n--- Instructions Preview (first 500 chars) ---")
    print(instructions[:500] + "...")
    print("--- End Preview ---\n")

    print("✅ All instruction tests passed!\n")
    return True


def test_edge_cases():
    """Test edge cases and boundary conditions."""
    print("\n=== Testing Edge Cases ===\n")

    # Minimum valid data
    print("--- Testing Minimum Valid Data ---")
    min_data = {
        "patient_summary": "Test patient",  # Exactly 12 chars (min 10)
        "key_findings": ["Finding 1"],
        "differential_diagnosis": [
            {"diagnosis": "Dx1", "reasoning": "R1"}
        ],
        "clinical_assessment": "A" * 50,  # Exactly 50 chars (min)
        "recommendations": ["Rec1"],
        "priority": "routine"
    }

    try:
        schema = InternistOutputSchema(**min_data)
        print("✅ Minimum valid data accepted")
    except Exception as e:
        print(f"❌ Minimum valid data rejected: {e}")
        return False

    # Maximum list items
    print("\n--- Testing Maximum List Items ---")
    max_data = {
        "patient_summary": "Patient with complex presentation",
        "key_findings": [f"Finding {i}" for i in range(10)],  # Max 10
        "differential_diagnosis": [
            {"diagnosis": f"Dx{i}", "reasoning": f"Reasoning {i}"}
            for i in range(5)  # Max 5
        ],
        "clinical_assessment": "Complex case requiring comprehensive evaluation and multi-disciplinary input.",
        "recommendations": [f"Rec {i}" for i in range(10)],  # Max 10
        "priority": "urgent",
        "red_flags": [f"Flag {i}" for i in range(5)]  # Max 5
    }

    try:
        schema = InternistOutputSchema(**max_data)
        print("✅ Maximum list items accepted")
    except Exception as e:
        print(f"❌ Maximum list items rejected: {e}")
        return False

    # Test all priority levels
    print("\n--- Testing All Priority Levels ---")
    for priority in ["routine", "urgent", "emergent"]:
        test_data = min_data.copy()
        test_data["priority"] = priority
        try:
            schema = InternistOutputSchema(**test_data)
            print(f"✅ Priority '{priority}' accepted")
        except Exception as e:
            print(f"❌ Priority '{priority}' rejected: {e}")
            return False

    print("\n✅ All edge case tests passed!\n")
    return True


def main():
    """Run all tests."""
    print("\n" + "="*70)
    print("INTERNIST AGENT STRUCTURED OUTPUT TESTS")
    print("="*70)

    results = {
        "Schema Validation": test_output_schema_validation(),
        "Output Formatting": test_output_formatting(),
        "Output Instructions": test_output_instructions(),
        "Edge Cases": test_edge_cases()
    }

    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)

    all_passed = True
    for test_name, result in results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name}: {status}")
        if not result:
            all_passed = False

    print("="*70)

    if all_passed:
        print("\n🎉 All tests passed! Internist Agent output is stable and well-structured.\n")
        return 0
    else:
        print("\n❌ Some tests failed. Please review the output above.\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
