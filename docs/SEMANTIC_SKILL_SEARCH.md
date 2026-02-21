# Semantic Skill Search 🎯

Tìm **Skills** bằng **vector embeddings** - hiểu ý định, chọn đúng skill!

## Tại sao cần Semantic Skill Search?

| Query | Keyword Matching | Semantic Search |
|-------|------------------|-----------------|
| "quản lý bệnh nhân" | ✅ Match patient-management | ✅ Same |
| "tôi cần xem thông tin ngưới bệnh" | ❌ No match | ✅ Match patient-management |
| "chẩn đoán triệu chứng" | ⚠️ Partial | ✅ Match diagnosis |
| "how to analyze medical images" | ❌ English only | ✅ Match imaging |

## 4 Functions Mới

### 1. `search_skills_semantic(query, top_k=3)`
Tìm skills phù hợp với ý định của user.

```python
# Vietnamese query
search_skills_semantic("tôi muốn tìm thông tin về bệnh nhân")

# Result:
"""
Found 1 relevant skill(s):

1. patient-management
   Relevance: 0.91
   Matched concepts: patient, thông tin, tìm
   Description: Quản lý thông tin bệnh nhân...
   Use when:
     - Tìm kiếm bệnh nhân
     - Xem thông tin cơ bản
   Available tools: query_patient_basic_info, list_all_patients
"""
```

### 2. `get_skill_info(skill_name)`
Xem chi tiết 1 skill.

```python
get_skill_info("diagnosis")
# → Full documentation: when_to_use, when_not_to_use, examples, tools
```

### 3. `index_all_skills()`
Build semantic index (gọi 1 lần khi startup).

```python
# At application startup
index_all_skills()  # ~2-5 giây
```

### 4. `get_semantic_search_stats()`
Xem thông tin search system.

```python
get_semantic_search_stats()
# {
#   "indexed": True,
#   "num_skills": 4,
#   "embedding_provider": "sentence_transformers",
#   "model_name": "all-MiniLM-L6-v2"
# }
```

## Usage Pattern: Smart Agent Routing

```python
class SmartAgent:
    def process(self, user_query: str):
        # Step 1: Tìm skill phù hợp (semantic)
        skills_result = search_skills_semantic(user_query, top_k=2)
        
        # Step 2: Đưa vào context cho LLM
        context = f"""
User: {user_query}

Relevant Skills:
{skills_result}

Which skill should I use?
"""
        
        # Step 3: LLM chọn skill
        selected_skill = self.llm.select_skill(context)
        
        # Step 4: Tìm tools trong skill đó
        tools_result = search_tools_semantic(user_query, top_k=3)
        
        # Step 5: Execute
        ...
```

## Ví dụ: Multi-Language Routing

```python
queries = [
    "find patient information",           # English
    "tìm thông tin bệnh nhân",           # Vietnamese
    "患者情報を検索",                    # Japanese
    "如何查看病人资料",                  # Chinese
]

for query in queries:
    result = search_skills_semantic(query)
    # → All return: patient-management skill!
```

## Architecture: Unified Semantic Layer

```
User Query (any language)
         ↓
    ┌─────────────────┐
    │ Semantic Search │
    └────────┬────────┘
         ↓
┌─────────────────┬─────────────────┐
│                 │                 │
Skill Search    Tool Search     Context Search
│                 │                 │
↓                 ↓                 ↓
Select Skill   Select Tools    Build Context
│                 │                 │
└─────────────────┴─────────────────┘
         ↓
    LLM Decision
         ↓
    Execute Action
```

## Configuration

```python
from src.skills.semantic_search import SemanticSkillSearcher

# Standard (English-focused)
searcher = SemanticSkillSearcher()

# Multilingual (better for Vietnamese/Chinese/etc)
searcher = SemanticSkillSearcher(use_multilingual=True)
# Uses: paraphrase-multilingual-MiniLM-L12-v2

# OpenAI embeddings
searcher = SemanticSkillSearcher(
    embedding_provider="openai",
    api_key="sk-..."
)

# Index
searcher.index_skills()

# Search
results = searcher.search("chẩn đoán bệnh", top_k=2)
```

## So sánh: Keyword vs Semantic

### Keyword Search (cũ)
```python
from src.skills.registry import SkillRegistry

registry = SkillRegistry()
skills = registry.select_skills("patient info")
# → Match nếu có từ "patient" hoặc "info" trong name/description/keywords
```

### Semantic Search (mới)
```python
from src.skills.semantic_search import search_skills_semantic

search_skills_semantic("làm sao để xem thông tin ngưới bệnh")
# → Hiểu ý định là "patient information lookup"
# → Match patient-management skill dù query khác hoàn toàn về từ ngữ!
```

## Installation

```bash
# Same requirements as tool semantic search
pip install sentence-transformers numpy

# Hoặc OpenAI
pip install openai
export OPENAI_API_KEY="..."
```

## Performance

- **Indexing**: ~2-5 giây cho 10-20 skills
- **Search**: <100ms
- **Cache**: Tự động lưu/load
- **Memory**: ~50MB (local model)

## Fallback

Nếu không có embeddings library:
```python
search_skills_semantic("find patient")  # Dùng semantic nếu có
# → Auto fallback về keyword matching nếu không có sentence-transformers
```

## Best Practices

1. **Index 1 lần khi startup**:
   ```python
   @app.on_event("startup")
   async def startup():
       index_all_skills()
       index_all_tools()  # Tools cũng cần
   ```

2. **Use for routing decisions**:
   - Semantic search → chọn skill/tool phù hợp
   - Đưa kết quả vào LLM context
   - LLM quyết định cuối cùng

3. **Combine với keyword**:
   - Semantic: Hiểu ý định chung
   - Keyword: Match chính xác từ khóa quan trọng
