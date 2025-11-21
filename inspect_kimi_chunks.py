import os
import asyncio
from dotenv import load_dotenv
from openai import AsyncOpenAI

load_dotenv()

async def inspect_chunks():
    api_key = os.getenv("KIMI_API_KEY")
    if not api_key:
        print("KIMI_API_KEY not found")
        return

    client = AsyncOpenAI(
        api_key=api_key,
        base_url="https://api.moonshot.ai/v1",
    )

    messages = [{"role": "user", "content": "Why is the sky blue?"}]

    print("Streaming response...")
    stream = await client.chat.completions.create(
        model="kimi-k2-thinking",
        messages=messages,
        stream=True
    )

    async for chunk in stream:
        print(f"--- Chunk ---")
        print(chunk.model_dump_json(indent=2))
        print("-" * 20)

if __name__ == "__main__":
    asyncio.run(inspect_chunks())
