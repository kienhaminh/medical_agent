#!/usr/bin/env python3
"""Direct test of patient reference detection in agent"""

import asyncio
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

async def test_agent():
    from src.agent.langgraph_agent import LangGraphAgent
    from src.llm.google_llm import get_google_llm

    print("="*60)
    print("Testing Agent Patient Reference Detection")
    print("="*60)

    # Initialize LLM and agent
    llm = get_google_llm()
    agent = LangGraphAgent(
        llm_with_tools=llm,
        user_id="test_user",
        max_iterations=3
    )

    # Test message
    message = "What is the patient's diagnosis?"
    patient_id = 28
    patient_name = "Betty Rodriguez"

    print(f"\nMessage: {message}")
    print(f"Patient: {patient_name} (ID: {patient_id})")
    print("\nStreaming response...\n")

    # Stream response
    stream = await agent.process_message(
        user_message=message,
        stream=True,
        patient_id=patient_id,
        patient_name=patient_name
    )

    found_patient_refs = False
    chunk_count = 0
    full_text = ""

    async for event in stream:
        if isinstance(event, dict):
            event_type = event.get('type')

            if event_type == 'content':
                chunk_count += 1
                full_text += event.get('content', '')
                print(event.get('content', ''), end='', flush=True)

            elif event_type == 'patient_references':
                found_patient_refs = True
                refs = event.get('patient_references', [])
                print(f"\n\n✅ FOUND {len(refs)} PATIENT REFERENCE(S)!")
                for ref in refs:
                    print(f"   - Patient {ref['patient_id']} ({ref['patient_name']})")
                    print(f"     Position: {ref['start_index']}-{ref['end_index']}")
                    if ref['start_index'] < len(full_text):
                        text_match = full_text[ref['start_index']:ref['end_index']]
                        print(f"     Text: '{text_match}'")
                print()

    print(f"\n\n{'='*60}")
    print(f"Total chunks: {chunk_count}")
    print(f"Full text length: {len(full_text)}")
    print(f"Patient references found: {'✅ YES' if found_patient_refs else '❌ NO'}")
    print(f"{'='*60}\n")

    if not found_patient_refs:
        print("❌ FAILURE: No patient_references events emitted!")
        print("\nDebugging info:")
        print(f"  - Patient ID passed: {patient_id}")
        print(f"  - Patient name passed: {patient_name}")
        print(f"  - Full response text:")
        print(f"    {full_text[:500]}...")
        return False

    return True

if __name__ == "__main__":
    success = asyncio.run(test_agent())
    sys.exit(0 if success else 1)
