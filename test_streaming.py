#!/usr/bin/env python3
"""Test script to verify streaming endpoint works correctly."""

import requests
import json

def test_streaming():
    """Test the streaming endpoint."""
    url = "http://localhost:8000/api/chat"
    
    data = {
        "message": "Tell me a short story about a robot in 2 sentences",
        "user_id": "test_user",
        "stream": True,
        "session_id": None
    }
    
    print("Testing POST to", url)
    print("Data:", json.dumps(data, indent=2))
    print("\n" + "="*60 + "\n")
    
    try:
        response = requests.post(url, json=data, stream=True, timeout=30)
        
        print(f"Status Code: {response.status_code}")
        print(f"Content-Type: {response.headers.get('content-type', 'N/A')}")
        print("\n" + "="*60 + "\n")
        
        if response.status_code == 200:
            content_type = response.headers.get('content-type', '')
            if 'text/event-stream' in content_type:
                print("✅ Correct Content-Type for SSE!")
                print("\nStreaming response:\n")
                
                chunk_count = 0
                for line in response.iter_lines():
                    if line:
                        line_str = line.decode('utf-8')
                        print(f"[{chunk_count:03d}] {line_str}")
                        chunk_count += 1
                        
                        if chunk_count > 50:  # Limit output
                            print("\n... (truncated)")
                            break
            else:
                print(f"⚠️  Unexpected Content-Type: {content_type}")
                print("Response:", response.text[:500])
        else:
            print(f"❌ Error: {response.status_code}")
            print(response.text)
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
        print("\nMake sure the backend is running:")
        print("  python -m src.api")

if __name__ == "__main__":
    test_streaming()
