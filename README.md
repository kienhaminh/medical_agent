# AI Agent

A personal AI agent with web interface and CLI, powered by Kimi (Moonshot AI) with advanced reasoning capabilities.

## Features

- 🤖 **Advanced LLM** - Powered by Kimi K2 Thinking model with chain-of-thought reasoning
- 💬 **Interactive Web Chat** - Modern Next.js interface with Shadcn/ui components
- 🏥 **Medical Records Management** - PostgreSQL database with patient records and semantic search
- 🧠 **Long-term Memory** - Mem0 + Neo4j for personalized, context-aware conversations
- 🔧 **Dynamic Tool System** - Create and manage custom tools at runtime
- 🎯 **LangGraph Agent** - Sophisticated multi-step reasoning and tool orchestration
- 📊 **Vector Search** - pgvector integration for semantic similarity search
- 💾 **Session Persistence** - Save and restore conversation history
- 🎨 **Rich CLI Interface** - Beautiful terminal UI with colors and formatting
- 🌐 **FastAPI Backend** - High-performance async REST API
- 🔒 **Secure Configuration** - Environment-based API key management

## Quick Start

### Prerequisites

- Python 3.10 or higher
- Node.js 18 or higher
- Docker & Docker Compose (for PostgreSQL and Neo4j)
- Kimi API key ([Get one here](https://platform.moonshot.cn/))
- Optional: OpenAI API key (for memory embeddings)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ai-agent
```

2. Set up Python backend:
```bash
# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies with Poetry
poetry install

# Or with pip
pip install -e .

# Set up environment variables
cp .env.example .env
# Edit .env and add your KIMI_API_KEY
```

3. Set up Next.js frontend:
```bash
cd web
npm install
```

### Usage

#### Web Interface (Recommended):

1. Start the databases (PostgreSQL + Neo4j):
```bash
# From project root
docker-compose up -d
# PostgreSQL runs on localhost:5432
# Neo4j runs on http://localhost:7474 (browser) and bolt://localhost:7687 (driver)
```

2. Initialize the database:
```bash
python scripts/db/init_db.py
```

3. Seed mock data (optional but recommended for testing):
```bash
python scripts/db/seed/seed_mock_data.py
# Or with custom options:
python scripts/db/seed/seed_mock_data.py --patients 50 --clear
```

4. Start the Python backend:
```bash
python -m src.api
# Backend runs on http://localhost:8000
```

5. Start the Next.js frontend (in another terminal):
```bash
cd web
npm run dev
# Frontend runs on http://localhost:3000
```

6. Open http://localhost:3000 in your browser

#### CLI Mode:

```bash
# Single message mode
ai-agent chat "Hello, who are you?"

# Interactive REPL mode
ai-agent interactive

# List sessions
ai-agent sessions

# Load previous session
ai-agent load <session_id>
```

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
- `KIMI_API_KEY` - Your Kimi (Moonshot AI) API key (required)
- `KIMI_MODEL` - Model name (default: kimi-k2-thinking)
- `TEMPERATURE` - Sampling temperature (default: 0.3)
- `SYSTEM_PROMPT` - Custom system prompt (optional)

**Database Configuration:**
- `DATABASE_URL` - PostgreSQL connection string (default: postgresql+asyncpg://postgres:postgres@localhost:5432/medinexus)
- `NEO4J_URL` - Neo4j connection URL (default: neo4j://localhost:7687)
- `NEO4J_USERNAME` - Neo4j username (default: neo4j)
- `NEO4J_PASSWORD` - Neo4j password (default: password123)

**Memory Configuration:**
- `MEMORY_ENABLED` - Enable long-term memory (default: true)
- `OPENAI_API_KEY` - OpenAI API key for embeddings (optional)
- `EMBEDDING_MODEL` - Embedding model (default: text-embedding-3-small)

**Feature Flags:**
- `USE_LANGGRAPH` - Use LangGraph agent (default: false)
- `LOG_LEVEL` - Logging level (default: INFO)

See `.env.example` for all available options.

## Key Features

### 1. Dynamic Tool Generation

The agent can create new tools at runtime using the `create_new_tool` meta-tool:

```python
# Example: Ask the agent to create a tool
"Create a tool that calculates the Fibonacci sequence"
```

The agent will:
1. Generate Python code for the tool
2. Store it in the database
3. Register it for immediate use
4. Use it to answer your questions

### 2. Medical Records Management

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

### 3. Long-term Memory System

The agent remembers user preferences and context across sessions:

- **Powered by Mem0 + Neo4j**: Production-ready memory framework with graph database
- **Semantic retrieval**: Find relevant memories by meaning, not keywords
- **User isolation**: Per-user memory with complete privacy
- **GDPR compliant**: Right to erasure and data portability

```bash
# Chat with memory
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "My favorite color is blue", "user_id": "alice"}'

# Get memory stats
curl http://localhost:8000/api/memory/stats/alice

# Export user data (GDPR)
curl http://localhost:8000/api/memory/export/alice

# Delete user data (GDPR)
curl -X DELETE http://localhost:8000/api/memory/alice
```

### 4. LangGraph Agent

Advanced agent architecture with:
- Multi-step reasoning
- Tool orchestration
- State management
- Conditional execution

Enable with `USE_LANGGRAPH=true` in your `.env` file.

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

### Memory
- `GET /api/memory/stats/{user_id}` - Get memory statistics
- `GET /api/memory/export/{user_id}` - Export user data
- `DELETE /api/memory/{user_id}` - Delete user data

## Tech Stack

### Backend:
- **Python 3.10+** with FastAPI
- **Kimi (Moonshot AI)** - Advanced LLM with reasoning capabilities
- **LangChain** - Tool integration and agent orchestration
- **LangGraph** - Multi-step agent workflows
- **PostgreSQL + pgvector** - Relational database with vector search
- **Neo4j** - Graph database for memory
- **Mem0** - Long-term memory framework
- **SQLAlchemy** - Async ORM
- **Pydantic** - Data validation

### Frontend:
- **Next.js 15** with App Router
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
│  LangGraph  │  │   Kimi   │
│    Agent    │  │   LLM    │
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

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Troubleshooting

### Database Connection Issues
```bash
# Check if PostgreSQL is running
docker ps

# Restart the database
docker-compose restart db

# View logs
docker-compose logs db
```

### Memory Issues
```bash
# Check Neo4j status
docker-compose logs neo4j

# Reset Neo4j data
docker-compose down -v
docker-compose up -d
```

### Tool Creation Failures
- Ensure the generated code is valid Python
- Check database connectivity
- Review logs with `LOG_LEVEL=DEBUG`

## Roadmap

- [ ] Multi-modal support (images, PDFs)
- [ ] Voice interface
- [ ] Mobile app
- [ ] Advanced medical AI features
- [ ] Team collaboration
- [ ] Plugin marketplace
