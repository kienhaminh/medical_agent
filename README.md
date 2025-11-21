# AI Agent

A personal AI agent with web interface and CLI, powered by Google Gemini via Google Gen AI SDK.

## Features

- 🤖 Natural language processing via Google Gemini API
- 💬 Interactive web chat interface (Next.js + Shadcn/ui)
- 🧠 **Long-term memory system** with Mem0 + Neo4j
- 🎯 **Personalization** - remembers user preferences across sessions
- 📊 **90% token reduction** with semantic memory retrieval
- 🔍 Graph-based entity relationships and multi-hop reasoning
- 🔧 Extensible tool system
- 💾 Session persistence
- 🎨 Rich CLI interface with colors and formatting
- 🌐 FastAPI backend with REST API
- 🔒 Secure API key management
- 🛡️ GDPR-compliant memory management

## Quick Start

### Prerequisites

- Python 3.10 or higher
- Node.js 18 or higher
- Docker & Docker Compose (for Neo4j memory database)
- Google API key ([Get one here](https://makersuite.google.com/app/apikey))
  - Used for: LLM (Gemini), memory embeddings, and fact extraction

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ai-agent
```

2. Set up Python backend:
```bash
# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -e .

# Set up environment variables
cp .env.example .env
# Edit .env and add your GOOGLE_API_KEY
```

3. Set up Next.js frontend:
```bash
cd web
npm install
# Frontend environment is already configured in .env.local
```

### Usage

#### Web Interface (Recommended):

1. Start Neo4j database (for memory features):
```bash
# From project root
docker-compose up -d
# Neo4j runs on http://localhost:7474 (browser) and bolt://localhost:7687 (driver)
```

2. Start the Python backend:
```bash
# From project root
python -m src.api.server
# Backend runs on http://localhost:8000
```

3. Start the Next.js frontend (in another terminal):
```bash
cd web
npm run dev
# Frontend runs on http://localhost:3000
```

4. Open http://localhost:3000 in your browser

**Note:** Memory features use Google Gemini for embeddings and fact extraction (single `GOOGLE_API_KEY` required).

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

### Run without installation:
```bash
python -m src.main chat "test message"
```

## Project Structure

```
ai-agent/
├── src/
│   ├── cli/          # CLI commands and UI
│   ├── agent/        # Agent orchestration
│   ├── llm/          # LLM provider implementations
│   │   ├── provider.py          # Base provider interface
│   │   ├── claude.py            # Claude provider (legacy)
│   │   ├── gemini.py            # Gemini provider via Google Gen AI SDK
│   ├── api/          # FastAPI backend
│   │   ├── server.py            # API routes and server
│   │   ├── __init__.py
│   │   └── __main__.py
│   ├── tools/        # Tool system
│   ├── context/      # Context management
│   ├── config/       # Configuration
│   └── utils/        # Utilities
├── web/              # Next.js frontend
│   ├── app/
│   │   ├── page.tsx              # Landing page
│   │   ├── chat/page.tsx         # Chat interface
│   │   ├── api/chat/route.ts     # API route
│   │   └── globals.css           # Styles
│   └── components/ui/            # Shadcn components
├── tests/            # Test suite
├── config/           # Configuration files
├── docs/             # Documentation
└── sessions/         # Session storage (gitignored)
```

## Configuration

Configuration can be set via:
1. Environment variables (`.env` for Python backend, `.env.local` for Next.js)
2. YAML config file (`config/default.yaml`)
3. CLI flags

### Backend Environment Variables (.env):
- `GOOGLE_API_KEY` - Your Google API key (required)
- `GEMINI_MODEL` - Model name (default: gemini-pro)
- `TEMPERATURE` - Sampling temperature (default: 1.0)
- `SYSTEM_PROMPT` - Custom system prompt (optional)
- `LOG_LEVEL` - Logging level (default: INFO)

### Frontend Environment Variables (.env.local):
- `PYTHON_BACKEND_URL` - Backend URL (default: http://localhost:8000)

See `.env.example` for all available options.

## Memory System

The agent includes a comprehensive long-term memory system:

- **Powered by Mem0 + Neo4j**: Production-ready memory framework with graph database
- **90% token reduction**: Semantic retrieval vs full-context approaches
- **User isolation**: Per-user memory with complete privacy
- **GDPR compliant**: Right to erasure and data portability
- **Semantic search**: Find relevant memories by meaning, not keywords
- **Graph relationships**: Model complex entity connections

**Quick Start:**

```bash
# Start Neo4j
docker-compose up -d

# Set environment variable (Gemini handles everything)
export GOOGLE_API_KEY=your_google_api_key

# Run backend
python -m src.api.server
```

**API Examples:**

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

See **[docs/MEMORY.md](docs/MEMORY.md)** for comprehensive documentation.

## Tech Stack

### Backend:
- **Python 3.10+** with FastAPI
- **Google Gen AI SDK** for LLM orchestration
- **Google Gemini API** for language model
- **Pydantic** for data validation

### Frontend:
- **Next.js 16** with App Router
- **Tailwind CSS v4** for styling
- **Shadcn/ui** for components
- **TypeScript** for type safety

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
