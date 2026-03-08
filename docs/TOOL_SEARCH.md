# Tool Search - Tiết Kiệm System Prompt Tokens

## Vấn Đề

System prompt truyền thống phải chứa mô tả của **tất cả tools** (~500-2000 tokens), rất tốn kém.

## Giải Pháp: Tool Search

Chỉ đưa 3 meta-tools vào system prompt, agent tự tìm tools khi cần:

```python
# System prompt ngắn gọn:
"""
Bạn có quyền truy cập tools. Sử dụng:
- search_tools(query) để tìm tools phù hợp
- get_tool_info(tool_name) để xem chi tiết tool
- list_available_tools() để liệt kê tất cả tools
"""
```

## 3 Meta-Tools

### 1. `search_tools(query, top_k=5)`
Tìm tools theo mô tả tự nhiên.

```python
# Agent gọi:
search_tools("tìm bệnh nhân theo tên")

# Kết quả:
"""
Found 2 relevant tool(s):

1. query_patient_basic_info
   Skill: patient-management
   Description: Query basic patient demographics...
   Parameters:
     - query (Optional[str], optional)
     - patient_id (Optional[int], optional)
     - name (Optional[str], optional)

2. list_all_patients
   Skill: patient-management
   Description: List all patients in database...
"""
```

### 2. `get_tool_info(tool_name)`
Xem chi tiết 1 tool cụ thể.

```python
# Agent gọi:
get_tool_info("query_patient_basic_info")

# Kết quả:
"""
Tool: query_patient_basic_info
Skill: patient-management
Type: code

Description:
Query basic patient information (demographics).
Use this tool when you need to find basic information about a patient...

Parameters:
  - query: Optional[str] (optional)
  - patient_id: Optional[int] (optional)
  - name: Optional[str] (optional)
  - dob: Optional[str] (optional)
"""
```

### 3. `list_available_tools(compact=True)`
Liệt kê tất cả tools theo skill.

```python
# Agent gọi:
list_available_tools()

# Kết quả:
"""
Available Tools (12 total):

[patient-management]
  query_patient_basic_info, list_all_patients

[records]
  search_medical_records, add_medical_record

[imaging]
  query_patient_imaging, upload_image
"""
```

## Flow Hoạt Động

```
User Query
    ↓
Agent nhận query + system prompt (ngắn, không có tool descriptions)
    ↓
Agent gọi: search_tools("tìm thông tin bệnh nhân")
    ↓
Nhận về 2-3 relevant tools
    ↓
Agent gọi: get_tool_info("query_patient_basic_info")
    ↓
Nhận về full documentation của tool đó
    ↓
Agent thực thi tool với đúng parameters
```

## Tiết Kiệm Bao Nhiêu Tokens?

| Cách | Est. Tokens |
|------|-------------|
| Traditional (all tools in prompt) | ~1500-3000 |
| Tool Search (3 meta-tools) | ~200-300 |
| **Tiết kiệm** | **~80-90%** |

## Code Implementation

```python
from src.tools.search import search_tools, get_tool_info, list_available_tools

# Hoặc dùng qua ToolRegistry (auto-registered)
from src.tools.builtin import search_tools

# Search
results = search_tools("find patient", top_k=3)

# Get details
details = get_tool_info("query_patient_basic_info")

# List all
all_tools = list_available_tools()
```

## Integration với Agent

### Option 1: Auto-call trước mỗi query
```python
class SmartAgent:
    def process(self, user_query):
        # Step 1: Tìm relevant tools
        tools_str = search_tools(user_query, top_k=3)
        
        # Step 2: Đưa vào context cho LLM
        context = f"User: {user_query}\n\nAvailable Tools:\n{tools_str}"
        
        # Step 3: LLM quyết định dùng tool nào
        response = self.llm.complete(context)
        ...
```

### Option 2: LLM tự gọi (ReAct pattern)
```python
# System prompt:
"""
Bạn có thể dùng tools. Trước khi dùng tool, hãy:
1. Gọi search_tools(query) để tìm tool phù hợp
2. Gọi get_tool_info(tool_name) để xem cách dùng
3. Gọi tool với đúng parameters

Ví dụ:
Thought: Tôi cần tìm bệnh nhân
Action: search_tools("tìm bệnh nhân")
Observation: Found 2 tools: query_patient_basic_info, list_all_patients
Thought: query_patient_basic_info phù hợp hơn
Action: get_tool_info("query_patient_basic_info")
...
"""
```

## Testing

```bash
# Test tool search
cd /home/user/.openclaw/workspace/medical_agent
python -c "
from src.tools.search import search_tools
print(search_tools('find patient'))
"
```
