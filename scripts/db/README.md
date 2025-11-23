# Database Scripts

This directory contains database management scripts for the AI Agent project.

## Directory Structure

```
db/
├── init_db.py              # Initialize database and create tables
├── migrations/             # Database migration scripts
│   ├── migrate_add_agent_columns.py
│   └── migrate_chat_sessions.py
└── seed/                   # Database seeding scripts
    ├── seed_agents.py
    ├── seed_chat_sessions.py
    ├── seed_detailed_clinical_data.py
    └── seed_mock_data.py
```

## Usage

### Initialize Database

Create all database tables from scratch:

```bash
python scripts/db/init_db.py
```

### Run Migrations

Apply specific schema changes to existing database:

```bash
# Add multi-agent support columns
python scripts/db/migrations/migrate_add_agent_columns.py

# Add chat sessions tables
python scripts/db/migrations/migrate_chat_sessions.py
```

### Seed Data

Populate database with initial or test data:

```bash
# Seed agent configurations
python scripts/db/seed/seed_agents.py

# Seed chat sessions (requires existing agents)
python scripts/db/seed/seed_chat_sessions.py

# Seed mock patient data
python scripts/db/seed/seed_mock_data.py

# Seed detailed clinical data
python scripts/db/seed/seed_detailed_clinical_data.py
```

## Workflow

For a fresh database setup:

1. **Initialize**: `python scripts/db/init_db.py`
2. **Migrate** (if needed): Run migration scripts in `migrations/`
3. **Seed**: Run seed scripts in `seed/` to populate with data

For existing database:

1. **Migrate**: Apply new migrations as schema evolves
2. **Seed**: Add new data as needed

## Notes

- All scripts use async/await and should be run from the project root
- Scripts are idempotent where possible (check before creating/updating)
- Always backup production data before running migrations
