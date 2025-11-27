#!/usr/bin/env python3
"""Test the detection flow step by step"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.agent.patient_detector import PatientDetector

# Step 1: Test detector with actual agent response
print("="*60)
print("Step 1: Testing PatientDetector with actual response")
print("="*60)

detector = PatientDetector()

# This is the actual text the agent generates
agent_response = """I'll help you find the diagnosis for Patient Betty Rodriguez. Let me retrieve her medical records.Based on the medical records review for Patient Betty Rodriguez (ID: 28, DOB: 1978-03-19, Female), the patient's diagnosis is:

**Type 2 Diabetes Mellitus**

This diagnosis is documented in her clinical encounter notes and medical history. The patient has been under ongoing management for this condition with multiple clinical encounters recorded throughout 2024-2025, including routine laboratory monitoring and baseline assessments."""

print(f"\nText length: {len(agent_response)} characters")
print(f"\nSearching for patient_id=28, patient_name='Betty Rodriguez'")
print()

refs = detector.detect_in_text_sync(
    text=agent_response,
    patient_id=28,
    patient_name="Betty Rodriguez"
)

print(f"✅ Found {len(refs)} patient references:")
for i, ref in enumerate(refs, 1):
    print(f"\n  Reference {i}:")
    print(f"    - Patient ID: {ref.patient_id}")
    print(f"    - Patient Name: {ref.patient_name}")
    print(f"    - Position: {ref.start_index}:{ref.end_index}")
    print(f"    - Matched Text: \"{agent_response[ref.start_index:ref.end_index]}\"")

print()
print("="*60)
print("Step 2: Convert to dict format (as sent to frontend)")
print("="*60)
print()

if refs:
    refs_dict = [ref.to_dict() for ref in refs]
    import json
    print(json.dumps({"patient_references": refs_dict}, indent=2))
else:
    print("❌ No references to convert")

print()
print("="*60)
print("Conclusion")
print("="*60)

if refs:
    print(f"✅ PatientDetector is working correctly!")
    print(f"✅ Found {len(refs)} references that should be sent to frontend")
    print()
    print("If frontend is showing null, the issue is:")
    print("  1. Detection code not being called in response_generator.py")
    print("  2. Patient profile not being passed to response_generator")
    print("  3. Events not being emitted by response_generator")
else:
    print("❌ PatientDetector failed to find references")
    print("This is unexpected - the text clearly contains 'Betty Rodriguez'")
