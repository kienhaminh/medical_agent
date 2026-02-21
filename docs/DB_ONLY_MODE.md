# Database-Only Skills Mode

This guide explains how to migrate from filesystem-based skills to database-only skills for full UI management.

## Overview

By default, the system loads skills from:
- Filesystem (core/custom/external directories)
- Database (dynamic skills)

**DB-Only Mode** disables filesystem discovery and loads skills **exclusively from the database**, allowing complete management through the UI/API.

## Migration Steps

### Step 1: Run Migration Script

Migrate all existing filesystem skills to the database:

```bash
# Preview what will be migrated (dry run)
python -m scripts.migrate_skills_to_db --dry-run

# Actually migrate
python -m scripts.migrate_skills_to_db
```

This will:
- Discover all skills from `src/skills/`, `custom_skills/`, `external_skills/`
- Save them to database with `source_type='database'`
- Preserve all metadata and tool definitions

### Step 2: Enable DB-Only Mode

Edit `config/default.yaml`:

```yaml
skills:
  db_only: true  # Disable filesystem discovery
```

Or set environment variable:

```bash
export SKILLS_DB_ONLY=true
```

### Step 3: Restart Server

```bash
# The server will now only load skills from database
python -m src.api.server
```

You should see:
```
[SKILLS] Running in DB-ONLY mode (filesystem discovery disabled)
[SKILLS] Loaded X skills from database
```

## Managing Skills via UI/API

### List All Skills

```bash
GET /api/skills
```

### Create New Skill

```bash
POST /api/skills
{
    "name": "pharmacy",
    "description": "Quản lý thuốc",
    "when_to_use": ["Tìm thuốc", "Kiểm tra tương tác thuốc"],
    "keywords": ["thuốc", "drug", "pharmacy"],
    "source_type": "database"
}
```

### Add Tool to Skill

```bash
POST /api/skills/pharmacy/tools
{
    "name": "query_drug",
    "description": "Tìm thuốc theo tên",
    "implementation_type": "code",
    "code": "def query_drug(name: str): ..."
}
```

### Update Skill

```bash
PATCH /api/skills/pharmacy
{
    "description": "Updated description",
    "keywords": ["thuốc", "medication"]
}
```

### Delete Skill

```bash
DELETE /api/skills/pharmacy
```

## Tool Implementation Types

### 1. Code-Based Tools

Store Python code directly in database:

```python
def query_patient(patient_id: str) -> dict:
    """Tìm bệnh nhân theo ID."""
    # Implementation here
    return {"id": patient_id, "name": "..."}
```

Store via API:
```bash
POST /api/skills/patient-management/tools
{
    "name": "query_patient",
    "implementation_type": "code",
    "code": "def query_patient(patient_id: str): ..."
}
```

### 2. Config-Based API Tools

Define API calls without writing code:

```bash
POST /api/skills/pharmacy/tools
{
    "name": "search_drugs",
    "implementation_type": "config",
    "config": {
        "type": "api",
        "endpoint": "https://api.drugs.com/v1/search",
        "method": "GET",
        "headers": {
            "Authorization": "Bearer ${DRUG_API_KEY}"
        }
    }
}
```

### 3. Composite Tools

Chain multiple tools together:

```bash
POST /api/skills/patient-management/tools
{
    "name": "full_patient_lookup",
    "implementation_type": "config",
    "config": {
        "type": "composite",
        "steps": [
            {"tool": "query_patient", "params": {"id": "$patient_id"}, "output_as": "patient"},
            {"tool": "get_records", "params": {"patient_id": "$patient.id"}, "output_as": "records"}
        ]
    }
}
```

## Reverting to Hybrid Mode

If you need to go back to filesystem discovery:

1. Edit `config/default.yaml`:
```yaml
skills:
  db_only: false
```

2. Restart server

The system will now load from both filesystem and database.

## Best Practices

### Production (DB-Only Mode)
- ✓ Use `db_only: true` 
- ✓ All skills managed via UI/API
- ✓ Version control your skills as SQL migrations
- ✓ Easy backup/restore via database dumps

### Development (Hybrid Mode)
- ✓ Use `db_only: false`
- ✓ Edit skills in IDE with syntax highlighting
- ✓ Hot-reload from filesystem
- ✓ Test new skills before migrating to DB

### Migration Checklist

Before enabling DB-only mode:

- [ ] Run migration script successfully
- [ ] Verify all skills appear in database
- [ ] Test skill functionality via API
- [ ] Backup database
- [ ] Update config to `db_only: true`
- [ ] Restart and verify startup logs
- [ ] Test UI skill management

## Troubleshooting

### No Skills Loaded

If you see:
```
[WARN] No skills loaded! Run: python -m scripts.migrate_skills_to_db
```

Solutions:
1. Run migration script first
2. Check database connection
3. Verify `skills` table has data

### Skills Not Updating

If skill changes don't reflect:
1. Check if `source_type='database'` in DB
2. Call reload API: `POST /api/skills/reload`
3. Or restart server

### Code Execution Security

**Warning**: Code-based tools execute Python code. In production:
- Use config-based tools when possible
- Sandbox code execution
- Validate all inputs
- Restrict imports

## Database Schema

See `src/models/skill.py` for full schema.

Key tables:
- `skills` - Skill definitions
- `skill_tools` - Tool definitions per skill
- `agent_skills` - Many-to-many: which agents use which skills
