#!/usr/bin/env python3
"""Capture the full agent response to see if it mentions the patient"""

import requests
import json

response = requests.post(
    'http://localhost:8000/api/chat',
    json={
        'message': 'What is the patient diagnosis?',
        'user_id': 'test',
        'patient_id': 28,
        'stream': True
    },
    stream=True
)

print("="*60)
print("AGENT RESPONSE TEXT")
print("="*60)
print()

full_text = ""
for line in response.iter_lines():
    if line:
        line_str = line.decode('utf-8')
        if line_str.startswith('data: '):
            try:
                data = json.loads(line_str[6:])
                if 'chunk' in data:
                    chunk = data['chunk']
                    full_text += chunk
                    print(chunk, end='', flush=True)
            except:
                pass

print("\n")
print("="*60)
print(f"Full response length: {len(full_text)} characters")
print("="*60)
print()

# Check if response mentions patient
if "Betty Rodriguez" in full_text:
    print("✅ Response mentions 'Betty Rodriguez'")
else:
    print("❌ Response does NOT mention 'Betty Rodriguez'")

if "Patient" in full_text and "28" in full_text:
    print("✅ Response mentions patient ID reference")
else:
    print("❌ Response does NOT mention patient ID")

print()
print("This is the text that should be scanned for patient references!")
