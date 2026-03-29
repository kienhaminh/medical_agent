# Doctor UX Redesign — Smart Panels with Real-Time Communication

**Date:** 2026-03-29
**Status:** Approved
**Scope:** Layer 1 — Information Speed + Team Communication

## Problem Statement

The current doctor workspace uses a 4-tab layout (Queue, Patient Detail, Clinical Notes, Orders) that forces constant context-switching. The AI assistant is a separate chatbot panel disconnected from clinical workflow. There is zero real-time communication between doctor and nurse — no visibility into order status, no push notifications, no live updates.

Doctors spend 30-60% of their shift waiting for information and context-switching between views. This system should **reduce time-consuming processes** by surfacing the right information at the right time and enabling real-time team coordination.

## Design Philosophy

**Approach: Smart Panels** — Keep the multi-panel concept but make it dynamic. Instead of fixed tabs, panels appear/collapse based on what the doctor is doing. AI suggestions embed inline within clinical context. Real-time notifications keep the team synchronized.

**Priority Layers:**
- **Layer 1 (this design):** Information Speed + Team Communication
- **Layer 2 (future):** Order Workflow Acceleration (protocol-based order sets, AI-suggested orders)
- **Layer 3 (future):** Documentation Automation (AI auto-draft SOAP, voice-to-note)

## Overall Layout Architecture

Replace the current tab-based layout with a 3-zone architecture:

```
+-----------------------------------------------------------+
| HEADER: Doctor identity + Patient search + Notification bell|
+------------+------------------------+---------------------+
|            |                        |                     |
|  ZONE A    |      ZONE B            |    ZONE C           |
|  Patient   |      Clinical          |    AI Assistant     |
|  List      |      Workspace         |    (contextual)     |
|  (240px)   |      (flexible)        |    (360px default)  |
|            |                        |                     |
|  Always    |  Collapsible panels:   |  3 modes:           |
|  visible   |  - Patient card        |  - Insights         |
|            |  - Pre-visit brief     |  - Chat             |
|  + Live    |  - Orders              |  - Consult          |
|    board   |  - Clinical notes      |                     |
|            |  - DDx panel           |                     |
|            |  - Quick actions       |                     |
+------------+------------------------+---------------------+
| NOTIFICATION BAR: Real-time team updates                    |
+-----------------------------------------------------------+
```

**Key changes from current:**
- Zone A replaces the "Active Queue" tab — always visible, not a tab
- Zone B replaces tabs 2/3/4 — patient detail, notes, and orders are collapsible sections in one scrollable area
- Zone C becomes contextual — proactively shows insights instead of waiting for chat input
- Notification bar at bottom shows real-time team events

---

## Zone A: Patient List & Live Board

### Layout

Two sections plus an activity feed:

1. **My Patients** — patients assigned to this doctor, with live status
2. **Waiting Room** — unassigned patients in the department
3. **Live Board** — scrolling activity feed (order claimed, lab completed, note added)

### Patient Card Content

Each card shows:
- Patient name
- Urgency dot: Red (critical), Yellow (urgent), Green (routine)
- Chief complaint
- Wait time in minutes
- Live status line: "2 orders pending", "Labs complete", "Ready for discharge"

### Behaviors

| Feature | Behavior |
|---|---|
| Live status | Updates via WebSocket — no manual refresh needed |
| Click to focus | Loads patient data into Zone B. Zone A stays visible |
| Badge counts | Section headers show patient count |
| Activity feed | Bottom section shows team events — replaces "did the nurse see my order?" |

---

## Zone B: Clinical Workspace (Smart Panels)

### Panel Sections (top to bottom, all in one scrollable area)

#### 1. Patient Card
- Name, age, gender, DOB
- Chief complaint
- Allergies, current medications
- "View Full Record" button

#### 2. AI Pre-Visit Brief
- Auto-fetched when patient is selected
- Summarizes: history, recent records, active issues, risk flags
- Collapsible (starts expanded)

#### 3. Orders Panel
- Header shows counts: "2 pending, 1 complete"
- Quick-order pills always visible: CBC, BMP, Troponin, D-Dimer, ECG, CXR, etc.
- Each order row shows: name, status, claimed-by, result (if complete)
- AI annotations inline: "WBC mildly elevated — consider infection" appears next to CBC result
- Custom order input for non-standard orders

#### 4. Clinical Notes
- SOAP format textarea with auto-save (2s debounce)
- Save status indicator
- "Draft with AI" button

#### 5. DDx Panel
- AI-generated differential diagnoses from chief complaint + available data
- Each diagnosis: name, ICD-10 code, likelihood bar (High/Med/Low), evidence, red flags
- "Refresh DDx" button to regenerate with new data

#### 6. Quick Actions Bar
- Discharge, Transfer (dropdown), Consult Specialist (dropdown), End Shift Handoff

### Smart Panel Behaviors

| Behavior | How it works |
|---|---|
| All panels visible at once | No tabs. Scroll to see everything. Each panel has collapse toggle |
| Auto-expand on relevance | Orders panel highlights when a lab completes. DDx panel opens when generated |
| AI annotations inline | AI comments appear inside the relevant panel, not only in Zone C |
| Collapse memory | System remembers which panels the doctor prefers open/closed (localStorage) |
| Panel reordering | Doctor can drag panels to reorder based on personal preference |

---

## Zone C: Contextual AI Assistant

### 3 Modes (tab selector at top)

#### Mode 1: Insights (default, passive)

AI watches the workflow and proactively surfaces:
- **Drug interaction alerts** — detected from patient meds + new orders
- **Suggested orders** — based on chief complaint + DDx ("Chest pain + cardiac history: recommend Troponin q3h, 12-lead ECG, CXR")
- **Lab trend alerts** — trending values over time ("WBC trending up: 9.1 -> 11.2 over 24h")
- **Clinical reminders** — protocol-based nudges

Each insight card has: [Dismiss] and [Ask AI more] or [Place order] action buttons.

#### Mode 2: Chat (active, on demand)

Same conversational AI but enhanced:
- Patient data auto-included in context
- Current orders/labs/notes visible to AI
- **Actionable buttons in responses** — "Order D-Dimer", "Calculate Wells Score"
- AI responses lead to one-click actions, not just text

#### Mode 3: Consult (specialist routing)

- Specialist pill buttons (Cardiology, Neurology, Orthopedics, Pulmonology, Oncology)
- Click specialist -> get structured consult with actionable recommendations
- Recommendations include action buttons to place suggested orders

---

## Notification System

### 3 Layers

#### Layer 1: Header Notification Bell
- Badge with unread count
- Click opens dropdown with recent events
- Events: order claimed, lab completed, new patient, nurse message

#### Layer 2: Inline Updates
- Zone A patient cards update live (status line, urgency dots)
- Zone B order rows flash when status changes, results appear inline

#### Layer 3: Toast Notifications (urgent only)
- Slides in top-right, auto-dismisses after 10 seconds
- Only for: critical lab values, patient deteriorating, urgent team messages

### Event Routing Rules

| Event | Bell | Inline | Toast |
|---|---|---|---|
| Order claimed by nurse | Yes | Yes | No |
| Lab completed (normal) | Yes | Yes | No |
| Lab completed (critical) | Yes | Yes | Yes |
| New patient in waiting room | Yes | Yes (count) | No |
| Patient deteriorating | Yes | Yes (dot) | Yes |
| Nurse sends message | Yes | No | No |
| AI insight generated | No | No | No (appears in Zone C) |

---

## Nurse Workspace Upgrade

### New Layout (2-zone, no AI panel)

#### Zone A: Patient Overview (left sidebar)
- Patient list with order counts per patient
- Activity feed (same as doctor's live board)
- Shows which orders are mine vs pending

#### Zone B: Order Fulfillment (main area)

Grouped into 3 sections (not flat list with filters):

1. **Claimed by Me** — orders I'm working on, with result input fields
2. **Pending (unclaimed)** — orders waiting to be claimed, with [Claim] button
3. **Completed Today** — collapsible history of finished orders

Each order card shows:
- Order type icon (lab/imaging)
- Order name + patient name
- Doctor's clinical notes ("Rule out ACS") for context
- Time since ordered
- Ordered by (doctor name)

### Improvements Over Current

| Current | New |
|---|---|
| Flat list with status filters | Grouped by priority: mine -> pending -> completed |
| No patient context | Sidebar shows patient list with order counts |
| No clinical context on orders | Each order shows doctor's notes for urgency context |
| No real-time updates | WebSocket pushes new orders instantly |
| Manual refresh button | Auto-updates, new orders slide in |
| No feedback to doctor | Completing an order instantly notifies the doctor |

---

## WebSocket Architecture

### Connection Design

```
Doctor UI  <--WebSocket-->  FastAPI Server + WS Hub
Nurse UI   <--WebSocket-->  FastAPI Server + WS Hub
                                    |
                             Event Bus (in-memory)
                                    |
                    +---------------+---------------+
                    |               |               |
              Order Events    Visit Events    AI Insight Events
```

### Event Types

| Event | Triggered by | Receivers | Payload |
|---|---|---|---|
| `order.created` | Doctor places order | Dept nurses | order details, patient, urgency |
| `order.claimed` | Nurse claims | Ordering doctor | nurse name, order id |
| `order.completed` | Nurse submits result | Ordering doctor + AI | result data |
| `visit.status_changed` | Status update | Dept staff | visit id, old/new status |
| `patient.assigned` | Routing | Doctor + nurses | patient info |
| `patient.deteriorating` | AI/vitals | Doctor (toast) | alert, severity |
| `ai.insight` | AI engine | Assigned doctor | type, content, actions |
| `lab.critical` | Critical result | Doctor (toast) + nurses | lab, value, range |

### Technical Approach

| Aspect | Decision |
|---|---|
| Transport | WebSocket via FastAPI (`/ws/` endpoint) |
| Auth | JWT token on handshake |
| Rooms | Department-based. Users join their department room on connect |
| Targeting | Room (all dept), role (all nurses), or specific user |
| Reconnection | Client auto-reconnects with exponential backoff. REST fallback for missed events |
| Event bus | In-memory for single-server deployment. Upgrade to Redis pub/sub if needed later |

---

## Files to Create / Modify

### New Files (Frontend)

| File | Purpose |
|---|---|
| `web/components/doctor/patient-list-panel.tsx` | Zone A: patient list with live status |
| `web/components/doctor/live-board-feed.tsx` | Zone A: activity feed |
| `web/components/doctor/clinical-workspace.tsx` | Zone B: smart panels container |
| `web/components/doctor/patient-card-panel.tsx` | Zone B: patient info section |
| `web/components/doctor/ai-insights-mode.tsx` | Zone C: passive insights mode |
| `web/components/doctor/ai-chat-mode.tsx` | Zone C: chat mode with action buttons |
| `web/components/doctor/ai-consult-mode.tsx` | Zone C: specialist consult mode |
| `web/components/notifications/notification-bell.tsx` | Header bell dropdown |
| `web/components/notifications/toast-notification.tsx` | Urgent toast alerts |
| `web/components/notifications/notification-bar.tsx` | Bottom notification bar |
| `web/hooks/use-websocket.ts` | WebSocket connection hook |
| `web/hooks/use-notifications.ts` | Notification state management |
| `web/lib/ws-events.ts` | Event type definitions |

### Modified Files (Frontend)

| File | Changes |
|---|---|
| `web/app/(dashboard)/doctor/page.tsx` | Replace tab layout with 3-zone layout |
| `web/app/(dashboard)/doctor/use-doctor-workspace.ts` | Add WebSocket state, notification state |
| `web/components/doctor/doctor-header.tsx` | Add notification bell, update layout |
| `web/components/doctor/doctor-ai-panel.tsx` | Refactor into 3-mode component |
| `web/components/doctor/orders-panel.tsx` | Add inline AI annotations, live status |
| `web/app/(dashboard)/nurse/page.tsx` | Redesign with 2-zone grouped layout |
| `web/app/(dashboard)/nurse/use-nurse-workspace.ts` | Add WebSocket, grouped order state |
| `web/components/sidebar.tsx` | No major changes, already role-based |

### New Files (Backend)

| File | Purpose |
|---|---|
| `src/api/routers/ws.py` | WebSocket endpoint + connection manager |
| `src/api/ws/event_bus.py` | In-memory event bus |
| `src/api/ws/events.py` | Event type definitions |
| `src/api/ws/connection_manager.py` | Room management, targeting, auth |

### Modified Files (Backend)

| File | Changes |
|---|---|
| `src/api/server.py` | Register WebSocket router |
| `src/api/routers/orders.py` | Emit order events on create/claim/complete |
| `src/api/routers/visits.py` | Emit visit events on status change/routing |

---

## Future Layers (Roadmap Only)

### Layer 2: Order Workflow Acceleration
- Protocol-based order sets (one-click standard workups)
- AI-suggested orders from Insights panel
- One-click approve from AI suggestions
- Visual order tracking timeline

### Layer 3: Documentation Automation
- AI auto-drafts full SOAP note from encounter data
- Smart note templates per presentation type
- Voice-to-note (stretch goal)
- One-click review and sign

---

## Verification Plan

1. **Layout:** Doctor page renders 3 zones. No tabs. All panels visible and collapsible
2. **Patient selection:** Click patient in Zone A -> Zone B populates with their data
3. **Orders:** Place order -> nurse sees it in real-time (no refresh). Nurse completes -> doctor sees result inline + notification
4. **AI Insights:** When lab completes, AI insight card appears in Zone C Insights mode
5. **Notifications:** Critical lab triggers toast. Normal events appear in bell. Inline updates reflect in Zone A/B
6. **Nurse workflow:** Orders grouped correctly. Claim -> fill result -> complete flow works. Doctor notified
7. **WebSocket:** Connect/disconnect/reconnect works. Events target correct users/rooms
8. **Responsive:** Panels collapse gracefully. Zone C can be resized
