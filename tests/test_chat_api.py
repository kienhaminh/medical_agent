import requests
import json
import sys

def test_chat_api():
    url = "http://localhost:8000/api/chat"
    headers = {"Content-Type": "application/json"}
    payload = {
        "message": "Who is patient 1?",
        "user_id": "test_user",
        "stream": False
    }

    print(f"Sending POST request to {url}...")
    print(f"Payload: {json.dumps(payload, indent=2)}")

    try:
        response = requests.post(url, headers=headers, json=payload)
        print(f"\nStatus Code: {response.status_code}")
        
        try:
            data = response.json()
            print("\nResponse JSON:")
            print(json.dumps(data, indent=2))
        except json.JSONDecodeError:
            print("\nResponse Text:")
            print(response.text)
            
    except requests.exceptions.ConnectionError:
        print("\nError: Could not connect to the server. Is it running on localhost:8000?")
        sys.exit(1)
    except Exception as e:
        print(f"\nError: {e}")
        sys.exit(1)

if __name__ == "__main__":
    test_chat_api()
