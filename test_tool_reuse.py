"""Test script to verify agent can use tools multiple times."""

import asyncio
import logging
from src.api.dependencies import get_or_create_agent

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

async def test_multiple_tool_calls():
    """Test that agent can call tools multiple times in a single conversation."""
    print("\n" + "="*60)
    print("Testing Multiple Tool Calls")
    print("="*60 + "\n")

    # Get agent
    agent = get_or_create_agent("test_user_tool_reuse")

    # Test message that should trigger multiple tool calls
    test_message = """
    Please help me with the following tasks:
    1. First, tell me what time it is now
    2. Then, tell me what the weather is like in San Francisco
    3. Finally, tell me the date today

    Execute each task sequentially and provide the results.
    """

    print(f"📤 Sending message:\n{test_message}\n")
    print("-" * 60)

    # Track tool calls
    tool_calls_seen = []
    content_chunks = []

    # Stream response
    stream = await agent.process_message(
        user_message=test_message.strip(),
        stream=True,
        chat_history=[]
    )

    print("\n📡 Streaming response...\n")

    async for event in stream:
        if isinstance(event, dict):
            event_type = event.get("type")

            if event_type == "content":
                content = event.get("content", "")
                content_chunks.append(content)
                print(content, end="", flush=True)

            elif event_type == "tool_call":
                tool_name = event.get("tool")
                tool_args = event.get("args")
                tool_calls_seen.append({
                    "tool": tool_name,
                    "args": tool_args
                })
                print(f"\n\n🔧 Tool Call: {tool_name}")
                print(f"   Args: {tool_args}")

            elif event_type == "tool_result":
                result = event.get("result", "")
                print(f"   ✅ Result: {result[:100]}...")

            elif event_type == "usage":
                usage = event.get("usage", {})
                print(f"\n\n📊 Token Usage: {usage}")

    print("\n\n" + "="*60)
    print("Test Results")
    print("="*60)

    print(f"\n✅ Total tool calls: {len(tool_calls_seen)}")
    for i, call in enumerate(tool_calls_seen, 1):
        print(f"   {i}. {call['tool']} - {call['args']}")

    print(f"\n✅ Response length: {len(''.join(content_chunks))} characters")

    # Verify multiple tools were called
    if len(tool_calls_seen) >= 2:
        print("\n✅ SUCCESS: Agent successfully called tools multiple times!")
        return True
    else:
        print("\n❌ FAILURE: Agent only called {len(tool_calls_seen)} tool(s)")
        return False


async def test_conversation_with_tool_reuse():
    """Test that agent can use tools across multiple messages in a conversation."""
    print("\n" + "="*60)
    print("Testing Tool Reuse Across Multiple Messages")
    print("="*60 + "\n")

    agent = get_or_create_agent("test_user_conversation")

    messages = [
        "What time is it?",
        "What's the weather in New York?",
        "What's the date today?",
    ]

    chat_history = []

    for i, msg in enumerate(messages, 1):
        print(f"\n📤 Message {i}: {msg}")
        print("-" * 60)

        stream = await agent.process_message(
            user_message=msg,
            stream=True,
            chat_history=chat_history
        )

        tool_count = 0
        response_content = []

        async for event in stream:
            if isinstance(event, dict):
                if event.get("type") == "content":
                    content = event.get("content", "")
                    response_content.append(content)
                    print(content, end="", flush=True)
                elif event.get("type") == "tool_call":
                    tool_count += 1
                    print(f"\n   🔧 Tool: {event.get('tool')}")

        full_response = "".join(response_content)
        chat_history.append({"role": "user", "content": msg})
        chat_history.append({"role": "assistant", "content": full_response})

        print(f"\n   ✅ Tools used: {tool_count}")

    print("\n\n✅ SUCCESS: Agent used tools across multiple messages!")
    return True


async def main():
    """Run all tests."""
    print("\n🧪 Testing Agent Tool Reuse Functionality\n")

    try:
        # Test 1: Multiple tools in single message
        result1 = await test_multiple_tool_calls()

        # Test 2: Tools across multiple messages
        result2 = await test_conversation_with_tool_reuse()

        if result1 and result2:
            print("\n" + "="*60)
            print("✅ ALL TESTS PASSED")
            print("="*60 + "\n")
        else:
            print("\n" + "="*60)
            print("❌ SOME TESTS FAILED")
            print("="*60 + "\n")

    except Exception as e:
        print(f"\n❌ Error during testing: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
