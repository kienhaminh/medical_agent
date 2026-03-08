# Semantic Tool Search 🔍

Tìm tools bằng **vector embeddings** - hiểu ý nghĩa, không chỉ keywords!

## Tại sao Semantic Search tốt hơn?

| Feature | Keyword Search | Semantic Search |
|---------|----------------|-----------------|
| "find patient" | ✅ Match | ✅ Match |
| "tìm bệnh nhân" (Vietnamese) | ❌ No match | ✅ Match |
| "retrieve medical records" | ⚠️ Partial | ✅ Match |
| "làm sao để xem thông tin bệnh nhân" | ❌ No match | ✅ Match |
| Multi-language | ❌ English only | ✅ Any language |

## Installation

```bash
# Option 1: Local embeddings (recommended, free)
pip install sentence-transformers numpy

# Option 2: OpenAI embeddings (requires API key)
pip install openai
export OPENAI_API_KEY="your-key"
```

## 3 Tools Mới

### 1. `search_tools_semantic(query, top_k=5)`
Tìm tools bằng semantic similarity.

```python
# English
search_tools_semantic("how to find patient information")

# Vietnamese - same results!
search_tools_semantic("cách tìm thông tin bệnh nhân")

# Natural language
search_tools_semantic("I need to look up a patient's medical history")
```

**Kết quả:**
```
Found 3 relevant tool(s):

1. query_patient_basic_info
   Skill: patient-management
   Relevance: 0.89
   Matched: patient, information, find
   Description: Query basic patient demographics...

2. query_patient_medical_records
   Skill: records
   Relevance: 0.82
   Matched: patient, medical, history
   Description: Query medical records for a patient...
```

### 2. `index_all_tools()`
Build search index (gọi 1 lần khi khởi động).

```python
# At startup
index_all_tools()  # ~2-5 seconds first time
# Sau đó cached, load nhanh
```

### 3. `get_search_stats()`
Xem thông tin search system.

```python
get_search_stats()
# {
#   "indexed": True,
#   "num_tools": 15,
#   "embedding_provider": "sentence_transformers",
#   "model_name": "all-MiniLM-L6-v2",
#   "cache_exists": True
# }
```

## Configuration

```python
from src.tools.semantic_search import SemanticToolSearcher

# Custom config
searcher = SemanticToolSearcher(
    model_name="paraphrase-multilingual-MiniLM-L12-v2",  # Better for non-English
    embedding_provider="sentence_transformers",  # or "openai"
    cache_dir="~/.medical_agent/embeddings"
)

# Index
searcher.index_tools()

# Search
results = searcher.search("tìm bệnh nhân", top_k=3)
```

## So sánh 2 loại Search

```python
# Keyword search - chỉ match từ khóa
tools.search_tools("patient info")
# → Tìm tools có "patient" hoặc "info" trong tên/description

# Semantic search - hiểu ý nghĩa
tools.search_tools_semantic("thông tin bệnh nhân")
# → Tìm tools liên quan đến "patient information" dù query là tiếng Việt!
```

## Usage Pattern

### System Prompt (ngắn gọn)
```
Bạn có tools. Để tìm tools phù hợp:
1. Gọi index_all_tools() khi khởi động (1 lần)
2. Gọi search_tools_semantic("mô tả nhu cầu") để tìm tools
3. Gọi tool với đúng parameters
```

### Agent Flow
```
User: "Tôi muốn xem hồ sơ bệnh án của bệnh nhân"
↓
Agent: search_tools_semantic("xem hồ sơ bệnh án bệnh nhân")
↓
Result: [query_patient_medical_records, ...]
↓
Agent: query_patient_medical_records(patient_id=123)
```

## Models Available

| Model | Size | Speed | Quality | Best For |
|-------|------|-------|---------|----------|
| `all-MiniLM-L6-v2` | 22MB | ⚡ Fast | ⭐⭐⭐ | English |
| `paraphrase-multilingual-MiniLM-L12-v2` | 42MB | 🚀 Medium | ⭐⭐⭐⭐ | Multi-language |
| `text-embedding-3-small` (OpenAI) | Cloud | ⚡ Fast | ⭐⭐⭐⭐⭐ | Production |

## Performance

- **Indexing**: ~2-5 giây cho 50 tools (lần đầu)
- **Search**: <100ms sau khi indexed
- **Cache**: Tự động lưu/load từ disk
- **Memory**: ~50MB cho model local

## Fallback

Nếu không có embeddings library, tự động fallback về keyword search:
```python
search_tools_semantic("find patient")  # Dùng semantic nếu có
# → Fallback to search_tools() nếu không có sentence-transformers
```
