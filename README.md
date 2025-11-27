# AI Agent

A personal AI agent with web interface and CLI, powered by OpenAI or Kimi (Moonshot AI) with advanced reasoning capabilities.

## Features

- 🤖 **Advanced LLM** - Powered by OpenAI GPT-4o or Kimi K2 Thinking model with chain-of-thought reasoning
- 💬 **Interactive Web Chat** - Modern Next.js interface with Shadcn/ui components
- 🏥 **Medical Records Management** - PostgreSQL database with patient records and semantic search
- 🔧 **Dynamic Tool System** - Create and manage custom tools at runtime
- 🎯 **LangGraph Agent** - Sophisticated multi-step reasoning and tool orchestration
- 📊 **Vector Search** - pgvector integration for semantic similarity search
- 💾 **Session Persistence** - Save and restore conversation history
- 🌐 **FastAPI Backend** - High-performance async REST API
- 🔒 **Secure Configuration** - Environment-based API key management

### Prerequisites

- Python 3.10 or higher
- Node.js 18 or higher
- Docker & Docker Compose (for PostgreSQL and Redis)
- Kimi API key ([Get one here](https://platform.moonshot.ai/))
- Optional: OpenAI API key (for memory embeddings, if using Kimi as main provider)

### Installation

1. **Clone the repository:**

```bash
git clone <repository-url>
cd ai-agent
```

2. **Create `.env` file** with your API keys:

```bash
KIMI_API_KEY=your_kimi_api_key_here
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/medinexus
REDIS_URL=redis://localhost:6379/0
```

3. **Set up Python backend:**

```bash
# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies with Poetry
poetry install

# Or with pip
pip install -e .
```

4. **Set up Next.js frontend:**

```bash
cd web
npm install
```

### Usage

#### Web Interface (Recommended):

**Quick Start (3 terminals):**

**Terminal 1 - Databases:**

```bash
docker-compose up -d
python scripts/db/init_db.py
python scripts/db/seed/seed_mock_data.py  # Optional: seed test data
```

> **Guide Script:** `scripts/db/init_db.py` bootstraps the PostgreSQL schema (runs pgvector extension + tables) so brand-new databases are ready for migrations and seeding. Re-run it anytime you spin up a fresh database container.

**Terminal 2 - Backend:**

```bash
source .venv/bin/activate  # Activate virtual environment
python -m src.api
# Backend: http://localhost:8000
```

**Terminal 3 - Frontend:**

```bash
cd web
npm run dev
# Frontend: http://localhost:3000
```

Open **http://localhost:3000** in your browser.

## Development

### Run tests:

```bash
pytest
```

### Run with coverage:

```bash
pytest --cov=src --cov-report=html
```

### Code formatting:

```bash
# Format with Black
black src/

# Lint with Ruff
ruff check src/
```

### Background tasks (Celery worker + Flower)

```bash
# Start Celery worker (foreground)
./start-celery-worker.sh

# Run worker in background (optional)
python3 -m celery -A src.tasks worker --loglevel=info --concurrency=2 --detach

# Start Flower monitoring UI (optional, new terminal)
python3 -m celery -A src.tasks flower --port=5555
```

Celery uses the same environment variables defined in `.env` (e.g., `DATABASE_URL`, `REDIS_URL`). The helper script assumes your virtual environment is active and runs from the project root.

## Project Structure

```
ai-agent/
├── src/
│   ├── agent/           # Agent orchestration
│   │   ├── core.py              # Basic agent implementation
│   │   └── langgraph_agent.py   # LangGraph-based agent with reasoning
│   ├── llm/             # LLM provider implementations
│   │   ├── provider.py          # Base provider interface
│   │   ├── kimi.py              # Kimi (Moonshot AI) provider
│   │   └── langchain_adapter.py # LangChain compatibility layer
│   ├── api/             # FastAPI backend
│   │   ├── server.py            # API routes and endpoints
│   │   └── __main__.py          # Server entry point
│   ├── tools/           # Tool system
│   │   ├── registry.py          # Tool registration and management
│   │   ├── executor.py          # Tool execution engine
│   │   ├── adapters.py          # LangChain tool adapters
│   │   └── builtin/             # Built-in tools
│   │       ├── datetime_tool.py
│   │       ├── location_tool.py
│   │       ├── weather_tool.py
│   │       └── meta_tool.py     # Dynamic tool generation
│   ├── config/          # Configuration
│   │   ├── settings.py          # Application settings
│   │   └── database.py          # Database models and setup
│   ├── memory/          # Memory management
│   │   └── mem0_manager.py      # Mem0 integration
│   ├── context/         # Context management
│   │   └── manager.py
│   ├── cli/             # CLI interface
│   │   ├── commands.py          # CLI commands
│   │   └── ui.py                # Rich terminal UI
│   └── utils/           # Utilities
│       ├── errors.py
│       └── logging.py
├── web/                 # Next.js frontend
│   ├── app/
│   │   ├── page.tsx             # Landing page
│   │   ├── chat/page.tsx        # Chat interface
│   │   └── api/chat/route.ts    # API route proxy
│   ├── components/ui/           # Shadcn components
│   └── lib/                     # Utilities
├── tests/               # Test suite
├── config/              # Configuration files
│   ├── default.yaml             # Default settings
│   └── memory.yaml              # Memory configuration
└── docker-compose.yml   # Database services
```

## Configuration

Configuration can be set via:

1. Environment variables (`.env` for Python backend)
2. YAML config files (`config/default.yaml`, `config/memory.yaml`)
3. CLI flags

### Backend Environment Variables (.env):

**LLM Configuration:**

- `KIMI_API_KEY` - Your Kimi (Moonshot AI) API key (required if OPENAI_API_KEY not set, or use `MOONSHOT_API_KEY` as alternative)

**Database Configuration:**

- `DATABASE_URL` - PostgreSQL connection string (default: `postgresql+asyncpg://postgres:postgres@localhost:5432/medinexus`)

**Redis Configuration:**

- `REDIS_URL` - Redis connection URL for Celery tasks (default: `redis://localhost:6379/0`)

## Key Features

### 1. Medical Records Management

Store and query patient medical records with semantic search:

```bash
# Add a patient record
curl -X POST http://localhost:8000/api/patients \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "dob": "1990-01-01", "gender": "male"}'

# Add a medical record
curl -X POST http://localhost:8000/api/records \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": 1,
    "record_type": "text",
    "content": "Patient presents with fever and cough",
    "summary": "Respiratory symptoms"
  }'

# Query records with semantic search
curl http://localhost:8000/api/records/search?query=respiratory+issues
```

### 2. LangGraph Agent

Advanced agent architecture with:

- Multi-step reasoning
- Tool orchestration
- State management
- Conditional execution

### 3. Expendable Custom Agents

- Create specialists via `POST /api/agents` or the dashboard (name, role, prompt, color/icon).
- Each agent becomes a `SubAgent` row in Postgres and is reloaded automatically by `AgentLoader`.
- LangGraph delegation lists only enabled agents, so you can disable/clone without code changes.
- Core system agents remain immutable, while user-defined ones are safe to experiment with.

### 4. Expendable Custom Tools

- Define capabilities through `POST /api/tools`.
- Tools register with the runtime `ToolRegistry`, making them callable immediately.
- You can hot-reload, delete, or reassign tools per agent to keep experiments isolated.

## API Endpoints

### Chat

- `POST /api/chat` - Send a message and get a streaming response
- `POST /api/consult` - Medical consultation with tool use

### Patients & Records

- `GET /api/patients` - List all patients
- `POST /api/patients` - Create a new patient
- `GET /api/patients/{id}` - Get patient details
- `POST /api/records` - Add a medical record
- `GET /api/records/search` - Semantic search for records

### Tools

- `GET /api/tools` - List all available tools
- `POST /api/tools` - Create a new custom tool
- `DELETE /api/tools/{name}` - Delete a tool

## Tech Stack

### Backend:

- **Python 3.12+** with FastAPI
- **OpenAI GPT-4o** or **Kimi (Moonshot AI)** - Advanced LLM with reasoning capabilities
- **LangGraph** - Multi-step agent workflows
- **PostgreSQL + pgvector** - Relational database with vector search
- **Mem0** - Long-term memory framework
- **SQLAlchemy** - Async ORM

### Frontend:

- **Next.js 16** with App Router
- **Tailwind CSS v4** for styling
- **Shadcn/ui** for components
- **TypeScript** for type safety
- **React** for UI

### DevOps:

- **Docker & Docker Compose** for database services
- **Poetry** for Python dependency management
- **pytest** for testing
- **Black & Ruff** for code formatting and linting

## Architecture

```
┌─────────────┐
│   Next.js   │
│   Frontend  │
└──────┬──────┘
       │ HTTP/SSE
       ▼
┌─────────────┐
│   FastAPI   │
│   Backend   │
└──────┬──────┘
       │
       ├──────────────┐
       │              │
       ▼              ▼
┌─────────────┐  ┌──────────┐
│  LangGraph  │  │ OpenAI/  │
│    Agent    │  │  Kimi    │
│             │  │   LLM    │
└──────┬──────┘  └──────────┘
       │
       ├──────────────┬──────────────┐
       │              │              │
       ▼              ▼              ▼
┌─────────────┐  ┌──────────┐  ┌──────────┐
│ PostgreSQL  │  │  Neo4j   │  │  Tools   │
│  +pgvector  │  │  +Mem0   │  │ Registry │
└─────────────┘  └──────────┘  └──────────┘
```

## License

MIT
