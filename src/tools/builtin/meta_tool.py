"""Meta-tool for creating other tools."""

import os
from ..registry import ToolRegistry
from ...config.database import SessionLocal, Tool
from ...utils.enums import MessageRole

def create_new_tool(
    name: str,
    description: str,
    instructions: str = ""
) -> str:
    """Create a new tool for the agent to use.

    Generates Python code for a new tool based on the description and instructions,
    registers it dynamically, and persists it to the database.

    Args:
        name: Name of the tool (must be a valid Python identifier, e.g., 'calculate_fibonacci')
        description: Brief description of what the tool does.
        instructions: Detailed instructions on how the tool should be implemented (logic, inputs, outputs).

    Returns:
        Success message or error.
    """
    try:
        # 1. Generate Code
        api_key = os.getenv("MOONSHOT_API_KEY") or os.getenv("KIMI_API_KEY")
        if not api_key:
            return "Error: MOONSHOT_API_KEY or KIMI_API_KEY not found."

        from openai import OpenAI
        client = OpenAI(
            api_key=api_key,
            base_url="https://api.moonshot.ai/v1",
        )

        prompt = f"""
You are an expert Python developer. Write a Python function for an AI agent tool.
Function Name: {name}
Description: {description}
Instructions: {instructions}

Requirements:
1. The function must be named exactly `{name}`.
2. It must have type hints.
3. It must have a Google-style docstring describing args and returns.
4. It must be self-contained (import necessary modules inside the function).
5. It must return a string or a value convertible to string.
6. Do NOT use any external libraries other than standard library or `requests`.
7. Output ONLY the Python code. No markdown backticks.
"""
        response = client.chat.completions.create(
            model="kimi-k2-thinking",
            messages=[
                {"role": MessageRole.SYSTEM.value, "content": "You are a helpful assistant."},
                {"role": MessageRole.USER.value, "content": prompt}
            ],
            temperature=0.3
        )
        code = response.choices[0].message.content.strip()
        
        # Clean up markdown if present
        if code.startswith("```python"):
            code = code[9:]
        if code.startswith("```"):
            code = code[3:]
        if code.endswith("```"):
            code = code[:-3]
        code = code.strip()

        # 2. Validate Code (Basic syntax check)
        try:
            compile(code, "<string>", "exec")
        except SyntaxError as e:
            return f"Error: Generated code has syntax errors: {e}"

        # 3. Persist to DB
        session = SessionLocal()
        try:
            # Check if exists
            existing = session.query(Tool).filter(Tool.name == name).first()
            if existing:
                existing.code = code
                existing.description = description
            else:
                # Generate symbol from name
                symbol = name.lower().replace(' ', '_').replace('-', '_')
                new_tool = Tool(
                    name=name,
                    symbol=symbol,
                    description=description,
                    code=code,
                    tool_type="function"
                )
                session.add(new_tool)
            session.commit()
        except Exception as e:
            session.rollback()
            return f"Error saving to database: {e}"
        finally:
            session.close()

        # 4. Register in Memory
        local_scope = {}
        exec(code, {}, local_scope)
        func = local_scope.get(name)
        
        if not func or not callable(func):
            return f"Error: Generated code did not define function '{name}'."

        registry = ToolRegistry()
        # If already registered, we might need to unregister or overwrite?
        # Registry raises ValueError if exists.
        # We should probably allow overwriting for this tool.
        # But ToolRegistry doesn't have unregister.
        # We can access _tools directly using the symbol.
        symbol = name.lower().replace(' ', '_').replace('-', '_')
        registry._tools[symbol] = func


        return f"Tool '{name}' (symbol: {symbol}) created and registered successfully. You can now use it."

    except Exception as e:
        return f"Error creating tool: {e}"

# Auto-register
_registry = ToolRegistry()
_registry.register(create_new_tool, scope="global")
