#!/bin/bash
# Test backend streaming directly

echo "Testing backend streaming..."
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Tell me a short story about a robot", "stream": true}' \
  --no-buffer

echo -e "\n\nDone!"
