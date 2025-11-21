import requests
import json
import os

BASE_URL = "http://localhost:8000/api"

def verify_records():
    print("--- Verifying Record Management ---")
    
    # 1. Create Patient
    print("\n1. Creating Patient...")
    patient_data = {"name": "Test Patient", "dob": "1990-01-01", "gender": "Male"}
    res = requests.post(f"{BASE_URL}/patients", json=patient_data)
    if res.status_code != 200:
        print(f"Failed to create patient: {res.text}")
        return
    patient = res.json()
    patient_id = patient['id']
    print(f"✅ Patient created: ID {patient_id}")
    
    # 2. Create Text Record
    print("\n2. Creating Text Record...")
    text_record_data = {
        "title": "Initial Consultation",
        "content": "Patient complains of headache and fatigue. BP 120/80.",
        "description": "Routine checkup"
    }
    res = requests.post(f"{BASE_URL}/patients/{patient_id}/records", json=text_record_data)
    if res.status_code != 200:
        print(f"Failed to create text record: {res.text}")
        return
    text_record = res.json()
    print(f"✅ Text record created: ID {text_record['id']}")
    
    # 3. Upload File Record (Dummy PDF)
    print("\n3. Uploading File Record...")
    dummy_pdf_content = b"%PDF-1.4\n..."
    files = {
        'file': ('test_report.pdf', dummy_pdf_content, 'application/pdf')
    }
    data = {
        'title': 'Lab Report',
        'description': 'Blood test results',
        'file_type': 'lab_report'
    }
    res = requests.post(f"{BASE_URL}/patients/{patient_id}/records/upload", files=files, data=data)
    if res.status_code != 200:
        print(f"Failed to upload record: {res.text}")
        return
    file_record = res.json()
    print(f"✅ File record uploaded: ID {file_record['id']}")
    
    # 4. List Records
    print("\n4. Listing Records...")
    res = requests.get(f"{BASE_URL}/patients/{patient_id}/records")
    records = res.json()
    print(f"Found {len(records)} records.")
    for r in records:
        print(f" - [{r['id']}] {r['title']} ({r['record_type']})")
        
    if len(records) >= 2:
        print("✅ Records listed successfully.")
    else:
        print("❌ Missing records.")
        
    # 5. Chat with Context
    print("\n5. Chatting with Record Context...")
    chat_payload = {
        "message": "What are the patient's symptoms?",
        "user_id": "test_verifier",
        "patient_id": patient_id,
        "record_id": text_record['id']
    }
    res = requests.post(f"{BASE_URL}/chat", json=chat_payload)
    if res.status_code == 200:
        print(f"Agent Response: {res.json()['content']}")
        if "headache" in res.json()['content'].lower():
            print("✅ Agent correctly identified symptoms from record.")
        else:
            print("⚠️ Agent might have missed the context.")
    else:
        print(f"Chat failed: {res.text}")

if __name__ == "__main__":
    verify_records()
