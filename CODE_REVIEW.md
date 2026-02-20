# Code Review: medical_agent Repo

## Tổng quan: Repo đang bị "lộn xộn" ở mức độ khá nghiêm trọng 🚨

---

## 1. Files QUÁ DÀI (Vi phạm AGENTS.md: "Keep files under 200 lines")

| File | Lines | Vấn đề |
|------|-------|--------|
| `src/api/routers/chat.py` | 714 | Router xử lý chat với cả streaming, background tasks, database - quá nhiều responsibility |
| `src/api/routers/patients.py` | 638 | Xử lý patients, records, imaging, uploads - cần tách thành nhiều routers |
| `src/api/routers/agents.py` | 500 | Quản lý agents, sub-agents, CRUD operations |
| `src/api/routers/tools.py` | 303 | Có thể chấp nhận nhưng vẫn nên tách |
| `src/tasks/agent_tasks.py` | 622 | Background task xử lý message quá phức tạp |
| `src/agent/specialist_handler.py` | 478 | Handler xử lý specialist consultation |
| `src/agent/response_generator.py` | 315 | Generate response |
| `src/llm/kimi.py` | 298 | LLM provider |
| `src/agent/patient_detector.py` | 276 | Patient context detection |
| `src/config/database.py` | 230 | Database models (Patient, MedicalRecord, Imaging, etc.) |

**Tổng số files >200 lines: 10 files** (Trong khi AGENTS.md yêu cầu <200 lines)

---

## 2. THIẾU TESTS HOÀN TOÀN ❌

```
tests/ - KHÔNG TỒN TẠI
```

- `pytest.ini` có cấu hình nhưng không có folder `tests/`
- Không có unit tests, integration tests
- Không thể đảm bảo code hoạt động đúng khi refactor

---

## 3. Code Duplication & Import Pattern Lộn Xộn

### 3.1. `load_dotenv()` được gọi NHIỀU NƠI:
- `src/config/settings.py` (line 85)
- `src/config/database.py` (line 12)
- `src/api/server.py` (line 4-5) 
- `src/api/dependencies.py` (line 12)
- `src/tasks/agent_tasks.py` (indirectly via settings)

**Nên:** Gọi 1 lần duy nhất ở entry point (`__main__.py` hoặc `server.py`)

### 3.2. `load_config()` được gọi khắp nơi:
- `src/api/dependencies.py` - global level
- `src/api/routers/chat.py` - module level  
- `src/api/routers/patients.py` - module level
- `src/tasks/agent_tasks.py` - module level

**Nên:** Dependency injection hoặc singleton pattern đúng cách

### 3.3. Config trùng lặp:
- `config/default.yaml` - model là `gemini-2.5-pro`
- `src/config/settings.py` - hardcode model `kimi-k2-thinking`
- `src/api/dependencies.py` - hardcode model `kimi-k2-thinking`

**Không nhất quán!** Config file nói model là Gemini nhưng code lại hardcode Kimi.

---

## 4. Architecture Issues

### 4.1. Routers quá "FAT"

**`chat.py` (714 lines) xử lý:**
- Chat session management
- Message persistence
- Streaming response
- Patient context injection
- Background task triggering
- Redis integration
- Token usage tracking

**Nên tách thành:**
- `chat/sessions.py` - Session management
- `chat/messages.py` - Message CRUD
- `chat/streaming.py` - Streaming logic
- `chat/background.py` - Background task triggers

### 4.2. Database models trong 1 file duy nhất

`src/config/database.py` chứa:
- `Patient`
- `MedicalRecord`
- `Imaging`
- `ImageGroup`
- `ChatSession`
- `ChatMessage`
- `SubAgent`
- `CustomTool`
- `TokenUsage`

**Nên:** Tách thành `src/models/` folder với mỗi model 1 file.

### 4.3. Agent folder (12 files) thiếu organization:

```
src/agent/
├── __init__.py (5 lines - empty)
├── agent_config.py (72 lines)
├── agent_loader.py (81 lines)
├── core_agents.py (63 lines)
├── enums.py (9 lines)
├── graph_builder.py (185 lines)
├── langgraph_agent.py (239 lines)
├── output_schemas.py (235 lines)
├── patient_detector.py (276 lines)
├── response_generator.py (315 lines)
├── specialist_handler.py (478 lines) ⬅️ QUÁ DÀI
└── state.py (21 lines)
```

---

## 5. Naming Convention Không Nhất Quán

### 5.1. Import paths:
```python
# Trong src/api/routers/chat.py
from src.config.database import ...  # absolute
from ..models import ...             # relative
from ...tasks.agent_tasks import ... # relative parent
```

### 5.2. File naming:
- Kebab-case: Không có (đáng lẽ phải có theo AGENTS.md)
- Snake_case: `langgraph_agent.py`, `specialist_handler.py`

---

## 6. Missing Documentation

- `docs/` folder không tồn tại (dù AGENTS.md yêu cầu đọc `docs/system-architecture.md`)
- Không có API documentation
- Không có architecture diagrams

---

## 7. Potential Issues

### 7.1. Global State trong `dependencies.py`:
```python
user_agents: Dict = {}  # Global mutable state
def get_or_create_agent(user_id: str):  # Không thread-safe hoàn toàn
```

### 7.2. Circular Import Risk:
- `src/agent/langgraph_agent.py` import `AgentLoader`, `SpecialistHandler`
- `src/agent/specialist_handler.py` import `ToolRegistry` từ tools
- Các module tools lại có thể cần agent

### 7.3. Error Handling không nhất quán:
- Có nơi dùng `try/except`, có nơi để `raise` tuỳ tiện
- Logging format không đồng nhất

---

## 8. Frontend Code Review (Web)

### 8.1. Cấu trúc ổn nhưng có thể cải thiện:
```
web/
├── app/
│   ├── (dashboard)/
│   │   ├── patient/[id]/page.tsx
│   │   ├── patient/page.tsx          ⬅️ Nên dùng layout cho patient
│   │   └── ...
```

### 8.2. Types được tách ra nhưng chưa nhất quán:
- `web/types/agent.ts`
- `web/types/agent-ui.ts`
- `web/types/enums.ts`

**Nên merge** `agent.ts` + `agent-ui.ts` hoặc đặt tên rõ ràng hơn.

---

## 9. Dependencies Issues

### 9.1. `pyproject.toml`:
- Có `psycopg2` và `asyncpg` cùng lúc (2 PostgreSQL driver)
- `psycopg2` là sync, `asyncpg` là async - có thể gây nhầm lẫn

### 9.2. Celery config:
- `start-celery-worker.sh` helper script
- Nhưng celery config lại nằm trong `src/tasks/__init__.py` (không rõ ràng)

---

## 10. Recommendations (Ưu tiên từ cao đến thấp)

### 🔴 P0 - Critical (Làm ngay):
1. **Tạo tests/** - Viết tests cho core functionality
2. **Tách database models** - Mỗi model 1 file trong `src/models/`
3. **Refactor routers** - Tách chat.py và patients.py thành nhiều files

### 🟡 P1 - High (Nên làm):
4. **Chuẩn hóa config** - Một nguồn config duy nhất
5. **Fix load_dotenv()** - Gọi 1 lần ở entry point
6. **Tách specialist_handler.py** - File 478 lines quá dài

### 🟢 P2 - Medium (Khi có thời gian):
7. **Tạo docs/** - Architecture docs, API docs
8. **Chuẩn hóa naming** - Kebeb-case cho files mới
9. **Review global state** - Thread-safety cho `user_agents`

---

## Summary

| Metric | Status |
|--------|--------|
| Files >200 lines | ❌ 10 files (vi phạm) |
| Tests | ❌ Không có |
| Documentation | ❌ Không có |
| Config consistency | ❌ Không nhất quán |
| Import patterns | ⚠️ Lộn xộn |
| Frontend | ✅ Tương đối ổn |

**Verdict:** Repo cần được refactor đáng kể để đạt maintainability tốt.
