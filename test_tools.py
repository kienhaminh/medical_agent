import requests
import json

BASE_URL = "http://localhost:8000/api"

def test_tools():
    print("1. Listing Tools...")
    try:
        response = requests.get(f"{BASE_URL}/tools")
        print(f"Status: {response.status_code}")
        if response.status_code != 200:
            print(f"Response: {response.text}")
        tools = response.json()
        print(f"Available Tools: {[t['name'] for t in tools]}")
        
        weather_tool = next((t for t in tools if t['name'] == 'get_current_weather'), None)
        if weather_tool and weather_tool['enabled']:
            print("✅ Weather tool is enabled.")
        else:
            print("❌ Weather tool is NOT enabled.")
            return
            
        print("\n2. Testing Weather Tool via Chat...")
        chat_payload = {
            "message": "What is the weather in Tokyo?",
            "user_id": "test_user",
            "stream": False
        }
        response = requests.post(f"{BASE_URL}/chat", json=chat_payload)
        result = response.json()
        print(f"Agent Response:\n{result['content']}")
        
        if "Tokyo" in result['content'] and ("Temperature" in result['content'] or "Conditions" in result['content']):
             print("✅ Agent successfully used the weather tool.")
        else:
             print("⚠️ Agent response might not have used the tool. Check logs.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_tools()
