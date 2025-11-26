"""Test script to verify patient query functionality."""

import asyncio
import logging
from src.api.dependencies import get_or_create_agent

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

async def test_patient_query():
    """Test that agent can query patient information."""
    print("\n" + "="*60)
    print("Testing Patient Query")
    print("="*60 + "\n")

    # Get agent
    agent = get_or_create_agent("test_user_patient_query")

    # Test message
    test_message = "Tell me about patient 24"

    print(f"📤 Sending message: {test_message}\n")
    print("-" * 60)

    # Track events
    tool_calls_seen = []
    response_content = []

    # Stream response
    stream = await agent.process_message(
        user_message=test_message,
        stream=True,
        chat_history=[]
    )

    print("\n📡 Streaming response...\n")

    async for event in stream:
        if isinstance(event, dict):
            event_type = event.get("type")

            if event_type == "content":
                content = event.get("content", "")
                response_content.append(content)
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
                print(f"   ✅ Result: {result[:200]}...")

            elif event_type == "log":
                log_msg = event.get("message", "")
                print(f"\n📋 Log: {log_msg}")

    print("\n\n" + "="*60)
    print("Test Results")
    print("="*60)

    print(f"\n✅ Total tool calls: {len(tool_calls_seen)}")
    for i, call in enumerate(tool_calls_seen, 1):
        print(f"   {i}. {call['tool']} - {call['args']}")

    full_response = "".join(response_content)
    print(f"\n✅ Response length: {len(full_response)} characters")
    
    if full_response:
        print(f"\n✅ Response preview: {full_response[:200]}...")
    else:
        print("\n❌ NO RESPONSE CONTENT")

    if len(tool_calls_seen) == 0:
        print("\n❌ FAILURE: Agent did not use any tools")
        return False
    
    if len(full_response) == 0:
        print("\n❌ FAILURE: Agent did not provide any response")
        return False

    print("\n✅ SUCCESS: Agent queried patient information!")
    return True


async def main():
    """Run test."""
    print("\n🧪 Testing Patient Query Functionality\n")

    try:
        result = await test_patient_query()

        if result:
            print("\n" + "="*60)
            print("✅ PATIENT QUERY TEST PASSED")
            print("="*60 + "\n")
        else:
            print("\n" + "="*60)
            print("❌ PATIENT QUERY TEST FAILED")
            print("="*60 + "\n")

    except Exception as e:
        print(f"\n❌ Error during testing: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
