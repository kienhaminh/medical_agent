#!/usr/bin/env python3
"""Test script to verify SSE streaming is working."""
import requests
import sys

message_id = 476  # Use the message ID from the logs
url = f"http://localhost:8000/api/chat/messages/{message_id}/stream"

print(f"Connecting to: {url}")
print("Waiting for events...\n")

try:
    response = requests.get(url, stream=True, timeout=30)
    
    if response.status_code != 200:
        print(f"Error: HTTP {response.status_code}")
        print(response.text)
        sys.exit(1)
    
    event_count = 0
    for line in response.iter_lines():
        if line:
            decoded = line.decode('utf-8')
            print(f"[{event_count}] {decoded}")
            event_count += 1
            
            if event_count > 50:  # Limit output
                print("\n... (stopping after 50 events)")
                break
    
    print(f"\nTotal events received: {event_count}")
    
except KeyboardInterrupt:
    print("\nStopped by user")
except Exception as e:
    print(f"Error: {e}")
