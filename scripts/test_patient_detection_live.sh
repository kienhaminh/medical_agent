#!/bin/bash
# Test patient detection in live API

echo "Testing Patient Detection with Live API"
echo "========================================"
echo ""

# Test with patient ID 28 (Betty Rodriguez)
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is the patient diagnosis?",
    "user_id": "test",
    "patient_id": 28,
    "stream": true
  }' 2>&1 | head -50 | grep -E "(patient_references|chunk)" || echo "No patient references detected"

echo ""
echo ""
echo "If you see 'patient_references' events above, the feature is working!"
echo "The agent should detect 'Betty Rodriguez' and 'Patient #28' in the response."
