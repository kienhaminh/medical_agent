# PROJECT REQUIREMENTS: Medi-Nexus (Medical AI Agent MVP)

## 1. Project Overview
Build a Medical AI Assistant system integrated into a Patient Record Management application. The system operates on a **Modular Multi-Agent** architecture, assisting doctors in analyzing multi-modal patient records (Text, Images) and providing advice based on historical data.

## 2. Core Objectives
1.  **Decision Support:** Automatically scan records and suggest analytical directions when a doctor views a file.
2.  **Extensibility:** A modular architecture that allows adding/removing specialized "AI Tools" easily via a UI, without modifying the core codebase.
3.  **Semantic Search (RAG):** Capability to "remember" and retrieve semantic context from the patient's past medical history for accurate conclusions.

## 3. Functional Requirements

### 3.1. Patient Management (Next.js Side)
* **Dashboard:** Display a list of patients.
* **Patient Detail View:** View comprehensive patient records, including:
    * Administrative Information.
    * Medical History (Plain Text).
    * Clinical Results (MRI/X-Ray Images, Lab PDFs).
* **Data Ingestion:** Allow doctors to upload new records (Text/Image). Incoming data must be automatically processed and vectorized for storage.

### 3.2. AI Consultation (Python Agent Side)
* **Agent Trigger:** A "Consult AI" button on the patient record interface.
* **Context Awareness:** The Agent must automatically identify the current context (Which patient? Which specific document is being viewed?) to provide relevant analysis.
* **Multi-modal Analysis:**
    * If input is **Text**: Use LLM to summarize or extract symptoms.
    * If input is **Image** (MRI/X-Ray): Automatically trigger Computer Vision tools to detect anomalies.

### 3.3. Dynamic Tool Registry (Core Feature)
* **Tool Store UI:** A "Menu UI" allowing Admins/Doctors to view available AI Tools.
* **Configuration:** Capability to Toggle (Enable/Disable) specific tools.
    * *Example:* Enable "Cardiology Predictor", Disable "General Chat".
* **Plug-and-Play:** The AI Agent must dynamically update its capabilities based on the currently "Active" tools without requiring a backend redeployment.

## 4. Non-Functional Requirements

* **Data Privacy:** All data (Database, Image Files, Vectors) must be stored and processed **Localhost** (On-premise). No PII (Personally Identifiable Information) should be sent to public clouds (except for anonymized LLM API calls).
* **Architecture:** Microservices (Frontend completely decoupled from AI Backend).
* **Performance:** Acceptable Agent response time for an MVP (loading states must be handled).

## 5. Technology Constraints (Mandatory Stack)

* **Frontend / Host App:** Next.js 16 (App Router).
* **AI Backend:** Python 3.12 (FastAPI + LangGraph).
* **Database:** PostgreSQL 16 + `pgvector` Extension (Running via Docker).
* **AI Models:**
    * LLM: OpenAI (via API) or Local LLM (Ollama).
    * Vision: Specialized Models or GPT-4o Vision.

## 6. Deliverables (MVP Scope)
1.  Fullstack Source Code (Next.js + Python).
2.  `docker-compose.yml` for the Database infrastructure.
3.  **Demo Flow:** Upload 1 MRI image -> Agent detects image type -> Orchestrates Vision Tool -> Returns medical analysis text.