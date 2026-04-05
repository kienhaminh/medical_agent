# Medera — Clinical Intelligence Platform

A full-stack hospital management system with AI-powered patient intake, clinical decision support, and MRI brain tumour segmentation.

## Overview

Medera connects three roles in a live clinical workflow:

- **Patients** complete an AI-guided intake chat that collects symptoms and routes them to the appropriate department.
- **Admins** track visit progress on a real-time Kanban board across all departments.
- **Doctors** manage their patient queue, write clinical notes, run AI differential diagnosis, and request MRI segmentation — all from a single workspace.

```
Patient Intake → AI Triage → Department Queue → Doctor Workspace → Discharge
```

## Features

- **AI Triage Agent** — Conversational intake that collects symptoms, asks follow-up questions, and routes patients to the correct department (Emergency, Neurology, Cardiology, etc.)
- **Returning Patient Recognition** — Patients with an existing ID skip registration; the AI greets them by name and opens a new visit
- **Real-time Updates** — WebSocket broadcast keeps the admin Kanban and doctor queue in sync as visits change state
- **Doctor Workspace** — 3-zone layout: patient queue, clinical notes editor (SOAP), and AI assistant panel
- **One-patient-at-a-time rule** — Doctors are warned if they try to accept a second patient while one is active
- **Clinical AI Assistant** — Ask about diagnosis, treatment options, or patient history; runs differential diagnosis on demand
- **MRI Brain Tumour Segmentation** — Sends up to four MRI modalities (T1, T1ce, T2, FLAIR) to a BraTS segmentation MCP server; renders a colour-coded overlay inline in the chat panel
- **JWT Authentication** — Role-based access for patient, doctor, and admin personas
- **Semantic Search** — pgvector embeddings for patient record search

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), Tailwind CSS v4, Shadcn/ui, TypeScript |
| Backend | Python 3.12, FastAPI, SQLAlchemy (async), Alembic |
| Agent | LangGraph, Kimi K2 / OpenAI GPT-4o |
| Database | PostgreSQL 16 + pgvector (Docker) |
| Cache / Pub-Sub | Redis 7 (Docker) |
| Segmentation | BraTS MCP server (Docker, CPU), `segment_brats_from_link` tool |
| Auth | JWT (python-jose) |

## Project Structure

```
medical_agent/
├── src/
│   ├── agent/              # LangGraph agent definition and runner
│   ├── api/
│   │   ├── routers/        # FastAPI routers (visits, patients, chat, auth, …)
│   │   └── models.py       # Pydantic request/response models
│   ├── config/             # Settings, database session
│   ├── prompt/             # System prompts for intake and doctor agents
│   ├── tools/              # Agent tools (segmentation, DDx, …)
│   └── utils/              # Upload storage, helpers
├── web/                    # Next.js frontend
│   ├── app/
│   │   ├── intake/         # Patient intake chat
│   │   └── (dashboard)/
│   │       ├── admin/      # Admin Kanban board
│   │       └── doctor/     # Doctor workspace
│   ├── components/
│   │   ├── agent/          # Agent message rendering (tool calls, reasoning)
│   │   └── doctor/         # Doctor UI panels
│   └── lib/                # API client, auth context, WebSocket hook
├── alembic/                # Database migrations
├── scripts/db/seed/        # Seed data (patients, visits, imaging)
├── docs/                   # Architecture, design guidelines, test reports
├── config/default.yaml     # App configuration
└── docker-compose.yml      # PostgreSQL, Redis, segmentation MCP
```

## Prerequisites

- Python 3.12+
- Node.js 18+
- Docker & Docker Compose
- Kimi API key ([platform.moonshot.ai](https://platform.moonshot.ai/)) or OpenAI API key

## Setup

### 1. Clone and configure

```bash
git clone <repository-url>
cd medical_agent
cp .env.example .env
```

Edit `.env`:

```env
KIMI_API_KEY=your_kimi_api_key_here
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/medinexus
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=change_me_in_production
```

### 2. Start infrastructure

```bash
docker-compose up -d
```

This starts PostgreSQL (port 5432), Redis (port 6379), and the segmentation MCP server (port 8010).

### 3. Set up the Python backend

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e .

# Apply database migrations
alembic upgrade head

# Seed demo data (patients, visits, MRI imaging)
python scripts/db/seed/seed.py
```

### 4. Set up the frontend

```bash
cd web
npm install
```

## Running

Open three terminals:

```bash
# Terminal 1 — Backend (http://localhost:8000)
source .venv/bin/activate
python -m src.api.server

# Terminal 2 — Frontend (http://localhost:3000)
cd web
npm run dev
```

## Demo Accounts

| Role | Username | Password | URL |
|------|----------|----------|-----|
| Admin | admin | admin123 | `/admin` |
| Doctor (Neurology) | doctor | doctor123 | `/doctor` |
| Patient | — | — | `/intake` |

## Core Workflows

### Patient Intake (`/intake`)

1. Choose **First visit** or **I have my patient ID**
2. The AI agent collects symptoms through a conversational form
3. On completion the visit is created and routed to the appropriate department
4. A tracking link is displayed

### Admin Dashboard (`/admin`)

- Kanban board showing all active visits grouped by status
- Real-time WebSocket updates as visits are accepted, transferred, or discharged
- Filter by department

### Doctor Workspace (`/doctor`)

- **Waiting Room** — unassigned patients in your department; click **+ Accept Patient** to take one
- **My Patients** — your current patient; one at a time is enforced
- **Clinical Notes** — SOAP editor with autosave
- **Differential Diagnosis** — AI-generated DDx based on the visit brief
- **AI Assistant** — chat with the agent; ask questions, request summaries, or trigger MRI segmentation

#### Requesting MRI Segmentation

With a patient selected, type in the AI chat panel:

```
Please perform MRI segmentation on [patient name]'s brain scan.
```

The agent calls `segment_patient_image(patient_id, imaging_id?)` which sends available MRI modalities (T1, T1ce, T2, FLAIR) to the BraTS MCP server and renders a colour-coded overlay with findings directly in the chat.

To target a specific modality:

```
Run segmentation using only the T1ce scan for [patient name].
```

## Development

```bash
# Run tests
pytest

# Run with coverage
pytest --cov=src --cov-report=html

# Lint and format
ruff check src/
black src/
```

## Architecture

```
┌──────────────────────────────────────┐
│            Next.js Frontend          │
│  /intake   /admin   /doctor          │
└────────────────┬─────────────────────┘
                 │ HTTP + WebSocket
                 ▼
┌──────────────────────────────────────┐
│            FastAPI Backend           │
│  /api/visits  /api/patients          │
│  /api/chat    /api/auth              │
└──────┬──────────────┬────────────────┘
       │              │
       ▼              ▼
┌─────────────┐  ┌───────────────────┐
│  LangGraph  │  │   PostgreSQL 16   │
│    Agent    │  │   + pgvector      │
│  (Kimi/GPT) │  └───────────────────┘
└──────┬──────┘
       │
       ├─────────────────────┐
       ▼                     ▼
┌─────────────┐     ┌────────────────┐
│  Tool       │     │  Segmentation  │
│  Registry   │     │  MCP Server    │
│  (DDx, …)   │     │  (BraTS/Docker)│
└─────────────┘     └────────────────┘
```

## License

MIT
