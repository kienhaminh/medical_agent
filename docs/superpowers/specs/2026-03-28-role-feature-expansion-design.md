# Role Feature Expansion Design

**Date:** 2026-03-28
**Scope:** All roles — Doctor, Officer, Patient/Intake, Admin/Agent
**Goal:** Expand each role from thin prototype to a full, believable workday simulation. Both depth (richer existing features) and breadth (new feature categories) for all audiences: hospital executives, investors, and developers.

---

## 1. Doctor Role

### 1.1 Depth Improvements

**Patient Queue Cards**
Each card in the active queue shows: triage urgency level (color-coded badge: Routine / Urgent / Critical), chief complaint, wait time, and a 1-line AI-generated pre-brief (e.g., "67yo M, chest pain, hypertensive, no prior cardiac history"). Doctor knows the context before clicking.

**Proactive AI Panel**
When a patient is selected, the AI panel automatically generates a pre-visit brief without the doctor asking: summary of last 3 visits, active medications, allergies, and flagged abnormal findings. Chat remains available as a supplement.

**One-Click SOAP Draft**
The clinical notes editor gains a "Draft with AI" button. AI reads the current conversation context and patient history, then generates a full SOAP note. Doctor reviews and edits rather than writing from scratch.

### 1.2 New Features

**Differential Diagnosis Panel**
A structured UI panel (separate from chat) displaying:
- Ranked list of possible diagnoses with likelihood
- Supporting evidence pulled from patient records
- Red flags highlighted
- Suggested ICD-10 codes per diagnosis

**Multi-Agent Second Opinion**
"Consult Specialist" buttons within the visit (Cardiologist, Neurologist, Gastroenterologist, etc.). Each button invokes a specialist AI agent that returns a domain-expert perspective in a collapsible panel. Multiple specialists can be consulted simultaneously.

**Lab & Imaging Orders**
Doctor can order labs or imaging directly from the visit workspace. Orders appear as tasks in the patient's record and are visible to operations staff for fulfillment tracking.

**Shift Handoff Generator**
End-of-shift feature: AI generates a structured handoff document covering all active patients — outstanding tasks, pending results, unresolved concerns — formatted for the incoming doctor.

---

## 2. Officer Role

### 2.1 Depth Improvements

**KPI Bar**
Each metric gains a sparkline showing the 24h trend and a delta vs. yesterday. Threshold alerts appear as warning badges (e.g., avg wait > 45 min triggers a yellow indicator). Officers see at a glance whether the hospital is improving or deteriorating.

**Department Grid**
Each department card shows: capacity bar (e.g., 8/12 beds = 67%), staff present count, color-coded heat map (green → yellow → red by load), and estimated wait time. Cards are sorted by load severity by default.

**Interactive Patient Flow Kanban**
Columns remain: Intake → Triaged → Auto-Routed → Pending Review → Routed → In Department → Completed. Cards become draggable for manual status reassignment. Click any card for visit detail inline. Filter by department.

### 2.2 New Features

**AI Bottleneck Detection**
AI continuously monitors patient flow and surfaces proactive alerts: "Cardiology has 6 patients waiting >45 min — possible bottleneck. Suggested action: divert incoming chest pain cases to General Medicine." Alerts appear in a dedicated panel with one-click acknowledgment.

**Predictive Capacity Panel**
AI forecasts patient volume for the next 4 hours based on historical patterns and current queue depth. Displays: "Expected surge at 14:00 — recommend activating 2 additional beds in Emergency." Updates every 15 minutes.

**Real-Time Alert Center**
A notification feed for critical operational events: department overload, long wait time breaches, unrouted patients sitting in intake too long, staff shortage warnings. Each alert is dismissible and logged.

**Shift Handoff Report**
AI generates an end-of-shift briefing: active patients by department, incidents that occurred, unresolved routing decisions, and items requiring attention next shift. Exportable as PDF.

**Resource Allocation Panel**
View which doctors are assigned to which departments, room availability, and current staff-to-patient ratios. Supports drag-and-drop staff reassignment between departments.

---

## 3. Patient / Intake Role

### 3.1 Depth Improvements

**Intake Chat — Live Urgency Score**
A visual urgency indicator updates in real time as the patient describes symptoms: Routine / Urgent / Critical. Displayed as a colored badge alongside the conversation so the patient understands their priority level.

**Branching Follow-Up Questions**
The intake AI asks contextual follow-ups based on initial answers. Example: "chest pain" triggers cardiac-specific questions (radiation, duration, associated shortness of breath). Intake is more thorough, doctor context is richer.

**Wait Time Estimate at End of Intake**
After triage completes, the patient sees: "Estimated wait time: ~25 minutes. You have been assigned to Cardiology."

**Routing Explanation**
Plain-language explanation of the routing decision: "Based on your symptoms, we're sending you to Cardiology. A doctor will see you shortly." Reduces patient anxiety.

### 3.2 New Features

**Daily Visit Code**
At the end of intake, the patient is assigned a sequential number for the day (e.g., `42`). The counter resets to `1` at midnight. The code is displayed prominently: "Your number today is **42**." Easy to remember, easy to say aloud to family or staff. The code is valid until midnight of the same day. Internally it is scoped by `visit_date` so the same number on different days never collides.

**Device Session**
The intake page stores the visit token in the browser (localStorage) automatically after intake completes. If the patient closes the tab and reopens the page within 24 hours, they land directly on their status tracker instead of starting a new intake.

**Patient Status Tracker**
A lightweight public page where patients (or family members) enter their daily code to see real-time visit progress:
- Visit stage: Waiting → Triaged → In Queue → With Doctor → Completed
- Assigned department
- Estimated wait time
- Staff messages (e.g., "Please proceed to Room 3")

No account required. The code is the only credential.

**Pre-Visit Health Questionnaire**
Before arriving at the hospital, patients complete a structured form online: current symptoms, active medications, allergies, relevant medical history. AI pre-triages the responses. Intake chat is shorter; doctor brief is richer.

**Post-Visit AI Follow-Up**
24–48 hours after discharge, the system initiates an AI chat conversation: "How are you feeling since your visit?" The AI checks for medication adherence, monitors for red-flag symptoms, and escalates to a doctor if responses indicate a problem. Follow-up session is linked to the original visit record. Triggered by a Celery background task scheduled at the time of visit completion.

**Appointment Scheduling**
From the Patient Portal or status tracker, patients can book follow-up appointments: select department, view available slots, confirm. Confirmation creates a scheduled visit record (status: `SCHEDULED`) in the system, which activates to `INTAKE` on the appointment day.

---

## 4. Admin / Agent Dashboard

### 4.1 Depth Improvements

**Usage Analytics**
Enriched with: cost per conversation broken down by agent, response time percentiles (p50/p95), error rate trends over time, and a "most expensive queries" list for spotting inefficient prompts.

**Agent Management**
Adds: prompt version history (see every change to a system prompt with timestamps), an inline test playground (send a test message to the agent without leaving settings), and a clone-and-compare workflow for prompt iteration.

### 4.2 New Features

**Live Agent Activity Feed**
Real-time stream of all active agent conversations across all roles. Each entry shows: which agent, which role triggered it, current execution state (thinking / using tool / responding), and a live token counter. Primary showcase feature for developers evaluating the architecture.

**AI Decision Audit Log**
Every clinical AI recommendation is logged with: the recommendation text, which doctor received it, whether it was accepted or dismissed, and the timestamp. Gives hospital executives a compliance and oversight story — AI recommendations are transparent and traceable.

**Agent Performance Dashboard**
Quality metrics per agent:
- Task completion rate
- Average conversation turns
- User satisfaction (thumbs up/down)
- Escalation rate (queries the AI could not resolve)
- Cost per successful task

**Prompt Studio**
A dedicated playground tab: write a system prompt, send test messages, inspect the raw LangGraph execution trace step by step. Aimed at developers evaluating the agent architecture.

**System Health Dashboard**
Single-page operational health view: API latency (p50/p95/p99), database query times, Redis queue depth, active WebSocket connections, recent error logs, and LLM provider status. Tells an operator immediately if the system is healthy.

---

## 5. Cross-Cutting Notes

- All new AI-driven features (bottleneck detection, predictive capacity, post-visit follow-up, proactive doctor brief) should use the existing LangGraph agent infrastructure and tool system.
- Daily visit codes are ephemeral and do not require a new user account model — they map directly to the existing `Visit` record with a `daily_code` integer field and a `visit_date` for scoping.
- The Patient Status Tracker and Pre-Visit Questionnaire are unauthenticated public routes, consistent with the existing `/intake` page pattern.
- New agent-facing features (Prompt Studio, Live Activity Feed, Audit Log) should be added as new tabs within the existing `/dashboard/agent` layout.
