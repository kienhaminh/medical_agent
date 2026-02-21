# Extensible Skill Pool Architecture

## Overview

This document describes the enhanced Skill Pool + Tool Pool architecture that supports:
- **Dynamic skill registration** (runtime creation)
- **Database-driven skills** (no restart required)
- **Hot-reload** capability
- **Plugin architecture** (core/custom/external skills)
- **Config-based tools** (YAML/JSON definitions)

## Architecture

```
src/
├── skills/
│   ├── base.py              # Skill, SkillMetadata classes
│   ├── registry.py          # Enhanced SkillRegistry (DB + filesystem)
│   ├── patient-management/  # Core skill
│   ├── diagnosis/           # Core skill
│   ├── imaging/             # Core skill
│   └── records/             # Core skill
├── models/
│   └── skill.py             # Skill, SkillTool, AgentSkill models
├── tools/
│   └── pool.py              # Enhanced ToolPool (supports config-based tools)
└── api/routers/
    └── skills.py            # Full CRUD API for skills
```

## Plugin Architecture

Skills can be loaded from multiple sources:

```
skills/
├── core/                    # Built-in skills (shipped with app)
│   ├── patient-management/
│   ├── diagnosis/
│   ├── imaging/
│   └── records/
├── custom/                  # User-defined skills (CUSTOM_SKILLS_DIR)
│   └── pharmacy/
└── external/                # Third-party plugins (EXTERNAL_SKILLS_DIR)
    └── some-external-skill/
```

### Environment Variables

```bash
# Optional: Custom skill directories
export CUSTOM_SKILLS_DIR=/path/to/custom/skills
export EXTERNAL_SKILLS_DIR=/path/to/external/skills
```

## Database Schema

### Skill Model
```python
{
    "id": 1,
    "name": "pharmacy",
    "description": "Quản lý thuốc",
    "when_to_use": ["Tìm thuốc", "Xem thông tin thuốc"],
    "keywords": ["thuốc", "drug", "pharmacy"],
    "source_type": "database",  # filesystem, database, plugin, external
    "enabled": True,
    "version": "1.0.0",
    "is_system": False
}
```

### SkillTool Model
```python
{
    "id": 1,
    "skill_id": 1,
    "name": "query_drug",
    "description": "Tìm thuốc",
    "implementation_type": "config",  # code, config, api, composite
    "config": {
        "type": "api",
        "endpoint": "https://api.drugs.com/search",
        "method": "GET",
        "headers": {"Authorization": "Bearer ${API_KEY}"}
    },
    "enabled": True
}
```

## Usage Examples

### 1. Create a Skill via API

```bash
# Create a new skill
POST /api/skills
{
    "name": "pharmacy",
    "description": "Quản lý thuốc",
    "when_to_use": ["Tìm thuốc", "Xem thông tin thuốc"],
    "keywords": ["thuốc", "drug", "pharmacy"],
    "source_type": "database"
}

# Add a config-based tool to the skill
POST /api/skills/pharmacy/tools
{
    "name": "query_drug",
    "description": "Tìm thuốc theo tên",
    "implementation_type": "config",
    "config": {
        "type": "api",
        "endpoint": "https://api.drugs.com/v1/search",
        "method": "GET",
        "headers": {
            "Authorization": "Bearer token"
        }
    }
}

# Add a code-based tool
POST /api/skills/pharmacy/tools
{
    "name": "check_interactions",
    "description": "Kiểm tra tương tác thuốc",
    "implementation_type": "code",
    "code": "def check_interactions(drug1: str, drug2: str) -> dict:\n    return {'safe': True, 'notes': 'No known interactions'}"
}
```

### 2. Dynamic Registration in Code

```python
from src.skills.registry import SkillRegistry

registry = SkillRegistry()

# Register a skill dynamically
skill = await registry.register_skill(
    name="pharmacy",
    description="Quản lý thuốc",
    metadata={
        "when_to_use": ["Tìm thuốc"],
        "keywords": ["thuốc", "drug"]
    }
)

# Load from database
await registry.load_from_database()
```

### 3. Config-Based Tools

#### API Tool (YAML)
```yaml
# skills/pharmacy/tools/query_drug.yaml
name: query_drug
description: "Tìm thuốc theo tên"
implementation_type: config
config:
  type: api
  endpoint: "https://api.drugs.com/v1/search"
  method: GET
  parameters:
    - name: drug_name
      type: string
      required: true
  headers:
    Authorization: "Bearer ${DRUG_API_KEY}"
```

#### Composite Tool (Chains multiple tools)
```yaml
# skills/patient-management/tools/full_patient_lookup.yaml
name: full_patient_lookup
description: "Tìm bệnh nhân và lấy hồ sơ"
implementation_type: config
config:
  type: composite
  steps:
    - tool: query_patient_basic_info
      params:
        query: "$patient_query"
      output_as: patient_info
    - tool: query_patient_medical_records
      params:
        patient_id: "$patient_info.id"
      output_as: records
```

### 4. Hot Reload

```bash
# Check for changes
GET /api/skills/check-changes
# Response: {"changed_skills": ["patient-management"], "count": 1}

# Reload a specific skill
POST /api/skills/reload
{
    "skill_name": "patient-management"
}

# Auto-reload all changed skills
POST /api/skills/reload
# No body - reloads all changed skills
```

### 5. Plugin Discovery

```bash
# Discover skills from custom directories
POST /api/skills/discover
{
    "paths": ["./plugins", "./custom_skills"],
    "recursive": true
}
```

## Tool Types

### 1. Code-Based Tools (Traditional)
Python functions defined in `tools.py`:

```python
def query_patient_basic_info(query: str = None) -> str:
    """Tìm bệnh nhân."""
    # Implementation
    return result
```

### 2. Config-Based API Tools
HTTP API wrappers defined in YAML/JSON:

```yaml
config:
  type: api
  endpoint: "https://api.example.com/search"
  method: GET
  timeout: 30
```

### 3. Composite Tools
Chain multiple tools together:

```yaml
config:
  type: composite
  steps:
    - tool: tool1
      params: {input: "$user_input"}
      output_as: result1
    - tool: tool2
      params: {data: "$result1"}
```

## API Reference

### Skills
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/skills` | List all skills |
| POST | `/api/skills` | Create new skill |
| GET | `/api/skills/{name}` | Get skill details |
| PATCH | `/api/skills/{name}` | Update skill |
| DELETE | `/api/skills/{name}` | Delete skill (non-system) |
| POST | `/api/skills/select` | Select skills for query |
| POST | `/api/skills/execute` | Execute skills |
| POST | `/api/skills/reload` | Hot reload skills |
| GET | `/api/skills/check-changes` | Check for file changes |
| POST | `/api/skills/discover` | Discover from filesystem |

### Tools
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/skills/{name}/tools` | List tools in skill |
| POST | `/api/skills/{name}/tools` | Add tool to skill |
| PATCH | `/api/skills/{name}/tools/{tool}` | Update tool |
| DELETE | `/api/skills/{name}/tools/{tool}` | Delete tool |

## Backward Compatibility

- Existing filesystem skills continue to work
- Existing `ToolRegistry` remains functional
- `LangGraphAgent` can disable skill orchestration with `use_skill_orchestrator=False`
- All existing tests pass

## Migration Guide

### From Old Architecture

1. **Update imports**:
   ```python
   # Old
   from src.tools import ToolRegistry
   
   # New (optional - both work)
   from src.skills import SkillRegistry
   from src.tools import ToolPool
   ```

2. **Enable skill orchestration** (already default):
   ```python
   agent = LangGraphAgent(
       llm_with_tools=llm,
       use_skill_orchestrator=True  # Default
   )
   ```

3. **Create custom skill**:
   ```bash
   mkdir -p custom_skills/my-skill
   cat > custom_skills/my-skill/SKILL.md << 'EOF'
   ---
   name: my-skill
   description: "My custom skill"
   when_to_use:
     - "When I need it"
   keywords:
     - custom
   ---
   EOF
   ```

## Security Considerations

1. **Code Execution**: Code-based tools from DB execute Python code. In production:
   - Sandbox execution environment
   - Code signing/validation
   - Restricted imports

2. **API Keys**: Config-based tools can reference environment variables:
   ```yaml
   headers:
     Authorization: "Bearer ${API_KEY}"
   ```

3. **System Skills**: Skills marked `is_system=true` cannot be deleted via API

## Testing

```python
# Test skill selection
from src.agent.skill_selector import SkillSelector

selector = SkillSelector()
skills = selector.select("tìm thuốc paracetamol")
assert any(s.name == "pharmacy" for s in skills)

# Test hot reload
from src.skills.registry import SkillRegistry

registry = SkillRegistry()
changed = await registry.check_for_changes()
await registry.auto_reload()
```
