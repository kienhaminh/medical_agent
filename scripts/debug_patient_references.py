#!/usr/bin/env python3
"""Debug script to test patient reference detection end-to-end"""

import asyncio
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from src.agent.patient_detector import PatientDetector

def test_detector():
    """Test the patient detector directly"""
    print("=" * 60)
    print("Testing Patient Detector")
    print("=" * 60)

    detector = PatientDetector()

    # Test text with patient name and ID
    test_text = "I'll help you find the diagnosis for Patient Betty Rodriguez. Let me retrieve her medical records. Patient #28 should monitor glucose levels daily."

    print(f"\nTest Text:\n{test_text}\n")

    # Test detection with patient context
    refs = detector.detect_in_text_sync(
        text=test_text,
        patient_id=28,
        patient_name="Betty Rodriguez"
    )

    print(f"\n✅ Found {len(refs)} patient references:")
    for ref in refs:
        print(f"  - Patient {ref.patient_id} ({ref.patient_name})")
        print(f"    Text: '{test_text[ref.start_index:ref.end_index]}'")
        print(f"    Position: {ref.start_index}-{ref.end_index}")
        print()

    if len(refs) > 0:
        print("✅ Patient detector is working correctly!")
    else:
        print("❌ Patient detector did not find any references!")

    return len(refs) > 0

async def test_agent_flow():
    """Test the full agent flow"""
    print("\n" + "=" * 60)
    print("Testing Agent Flow (requires running server)")
    print("=" * 60)

    import aiohttp

    try:
        url = "http://localhost:8000/api/chat"
        data = {
            "message": "What is the patient diagnosis?",
            "user_id": "test_debug",
            "patient_id": 28,
            "stream": True
        }

        print(f"\nSending request to: {url}")
        print(f"With data: {data}\n")

        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=data) as response:
                print(f"Response status: {response.status}\n")

                if response.status != 200:
                    text = await response.text()
                    print(f"Error response: {text}")
                    return False

                patient_refs_found = False
                chunks_count = 0

                async for line in response.content:
                    line = line.decode('utf-8').strip()
                    if line.startswith('data: '):
                        data_str = line[6:]  # Remove 'data: ' prefix
                        try:
                            import json
                            event = json.loads(data_str)

                            if event.get('type') == 'content':
                                chunks_count += 1

                            if event.get('type') == 'patient_references':
                                patient_refs_found = True
                                refs = event.get('patient_references', [])
                                print(f"\n✅ Found patient_references event with {len(refs)} references:")
                                for ref in refs:
                                    print(f"  - Patient {ref['patient_id']} ({ref['patient_name']})")
                                    print(f"    Position: {ref['start_index']}-{ref['end_index']}")
                        except json.JSONDecodeError:
                            pass

                print(f"\nReceived {chunks_count} content chunks")

                if patient_refs_found:
                    print("✅ Patient references are being emitted by the server!")
                    return True
                else:
                    print("❌ No patient_references events received!")
                    print("\nPossible issues:")
                    print("  1. Server not restarted after code changes")
                    print("  2. Patient profile not being passed to agent")
                    print("  3. Detection code not running")
                    return False

    except Exception as e:
        print(f"❌ Error testing agent flow: {e}")
        print("\nMake sure the server is running:")
        print("  cd /Users/kien.ha/Code/ai-agent")
        print("  uvicorn src.api.main:app --reload")
        return False

if __name__ == "__main__":
    # Test 1: Direct detector test
    detector_works = test_detector()

    # Test 2: Agent flow test
    agent_works = asyncio.run(test_agent_flow())

    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    print(f"Patient Detector: {'✅ PASS' if detector_works else '❌ FAIL'}")
    print(f"Agent Flow: {'✅ PASS' if agent_works else '❌ FAIL'}")
    print()

    if detector_works and not agent_works:
        print("⚠️  Detector works but agent flow doesn't!")
        print("    → Server likely needs to be restarted")
        print("    → Run: pkill -f uvicorn && uvicorn src.api.main:app --reload")

    sys.exit(0 if (detector_works and agent_works) else 1)
