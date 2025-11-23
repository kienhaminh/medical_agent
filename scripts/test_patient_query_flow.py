"""
Integration test script for patient query delegation flow.

This script tests the complete flow:
1. User asks: "Who is patient 2?"
2. Main agent analyzes and delegates to Internist sub-agent
3. Internist uses query_patient_info tool
4. Internist reports back to main agent
5. Main agent responds to user with result

Prerequisites:
- Database running (docker-compose up -d)
- Database initialized (python -m scripts.db.init_db)
- Agents seeded (python -m scripts.db.seed.seed_agents)
- Patient data seeded (python -m scripts.db.seed.seed_mock_data)
- Tool assigned (python -m scripts.db.seed.seed_patient_tool_assignment)
- API server running (python -m src.api)
"""

import asyncio
import httpx
import json
import os
from dotenv import load_dotenv

# Load environment
load_dotenv()


async def test_patient_query_via_api():
    """Test patient query delegation via API endpoint."""
    print("=" * 70)
    print("PATIENT QUERY DELEGATION TEST")
    print("=" * 70)
    print()

    api_url = "http://localhost:8000/api/chat"

    # Test queries (will auto-detect first available patient)
    # First, get a patient ID from database
    from src.config.database import AsyncSessionLocal, Patient
    from sqlalchemy import select

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Patient).limit(1))
        patient = result.scalar_one_or_none()
        patient_id = patient.id if patient else 1

    test_queries = [
        f"Who is patient {patient_id}?",
        f"Tell me about patient number {patient_id}",
        f"What do you know about patient {patient_id}?",
    ]

    for i, query in enumerate(test_queries, 1):
        print(f"\nTest {i}: {query}")
        print("-" * 70)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    api_url,
                    json={
                        "message": query,
                        "user_id": "test_user_integration"
                    }
                )

                if response.status_code == 200:
                    # Parse SSE stream
                    lines = response.text.strip().split('\n')
                    full_response = []

                    for line in lines:
                        if line.startswith('data: '):
                            data = line[6:]  # Remove 'data: ' prefix
                            if data != '[DONE]':
                                try:
                                    chunk_data = json.loads(data)
                                    if 'chunk' in chunk_data:
                                        full_response.append(chunk_data['chunk'])
                                except json.JSONDecodeError:
                                    pass

                    response_text = ''.join(full_response)

                    print(f"✓ Response received:")
                    print(f"{response_text}")
                    print()

                    # Verify response contains expected information
                    if "patient" in response_text.lower() and ("2" in response_text or "two" in response_text.lower()):
                        print("✓ Response contains patient information")
                    else:
                        print("⚠ Response may not contain expected patient information")

                    # Check if delegation happened (look for Internist mention)
                    if "internist" in response_text.lower() or "clinical" in response_text.lower():
                        print("✓ Evidence of delegation to Internist sub-agent")

                else:
                    print(f"✗ Error: HTTP {response.status_code}")
                    print(f"Response: {response.text}")

        except httpx.ConnectError:
            print("✗ Error: Could not connect to API server")
            print("  Make sure the server is running: python -m src.api")
            return
        except Exception as e:
            print(f"✗ Error: {e}")

    print("\n" + "=" * 70)
    print("TEST COMPLETED")
    print("=" * 70)


async def test_direct_langgraph_agent():
    """Test patient query delegation directly with LangGraph agent."""
    print("\n" + "=" * 70)
    print("DIRECT LANGGRAPH AGENT TEST")
    print("=" * 70)
    print()

    try:
        from src.agent.langgraph_agent import LangGraphAgent
        from src.llm.kimi import KimiProvider

        # Initialize LLM
        print("Initializing LLM provider...")
        api_key = os.getenv("KIMI_API_KEY")
        if not api_key:
            print("✗ KIMI_API_KEY not found in environment")
            print("  Please set KIMI_API_KEY in your .env file")
            return

        llm_provider = KimiProvider(api_key=api_key)

        # Create agent
        print("Creating LangGraph agent...")
        agent = LangGraphAgent(
            llm_with_tools=llm_provider.get_langchain_llm(with_tools=True),
            user_id="test_user_direct",
            max_iterations=15
        )

        print(f"✓ Agent created: {agent}")
        print()

        # Get first available patient
        from src.config.database import AsyncSessionLocal, Patient
        from sqlalchemy import select

        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Patient).limit(1))
            patient = result.scalar_one_or_none()
            patient_id = patient.id if patient else 1

        # Test query
        query = f"Who is patient {patient_id}?"
        print(f"Query: {query}")
        print("-" * 70)

        response = await agent.process_message(query, stream=False)

        print(f"\nResponse:")
        print(response)
        print()

        # Verify delegation
        if agent.sub_agents and "clinical_text" in agent.sub_agents:
            internist = agent.sub_agents["clinical_text"]
            print(f"✓ Internist sub-agent loaded:")
            print(f"  - Name: {internist['name']}")
            print(f"  - Tools: {internist['tools']}")
        else:
            print("⚠ Internist sub-agent not found")

    except ImportError as e:
        print(f"✗ Import error: {e}")
        print("  Make sure all dependencies are installed")
    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()

    print("\n" + "=" * 70)
    print("DIRECT TEST COMPLETED")
    print("=" * 70)


async def verify_setup():
    """Verify that all prerequisites are met."""
    print("\n" + "=" * 70)
    print("SETUP VERIFICATION")
    print("=" * 70)
    print()

    checks = []

    # Check 1: Database connection
    try:
        from src.config.database import AsyncSessionLocal
        from sqlalchemy import select, text

        async with AsyncSessionLocal() as session:
            result = await session.execute(text("SELECT 1"))
            checks.append(("Database connection", True))
    except Exception as e:
        checks.append(("Database connection", False, str(e)))

    # Check 2: Internist agent exists
    try:
        from src.config.database import AsyncSessionLocal, SubAgent
        from sqlalchemy import select

        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(SubAgent).where(SubAgent.role == "clinical_text")
            )
            internist = result.scalar_one_or_none()
            if internist:
                checks.append((f"Internist agent ({internist.name})", True))
            else:
                checks.append(("Internist agent", False, "Not found"))
    except Exception as e:
        checks.append(("Internist agent", False, str(e)))

    # Check 3: Patient tool assignment
    try:
        from src.config.database import AsyncSessionLocal, SubAgent, AgentToolAssignment
        from sqlalchemy import select

        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(SubAgent).where(SubAgent.role == "clinical_text")
            )
            internist = result.scalar_one_or_none()

            if internist:
                result = await session.execute(
                    select(AgentToolAssignment)
                    .where(
                        AgentToolAssignment.agent_id == internist.id,
                        AgentToolAssignment.tool_name == "query_patient_info",
                        AgentToolAssignment.enabled == True
                    )
                )
                assignment = result.scalar_one_or_none()
                if assignment:
                    checks.append(("Patient tool assignment", True))
                else:
                    checks.append(("Patient tool assignment", False, "Not assigned"))
            else:
                checks.append(("Patient tool assignment", False, "Internist not found"))
    except Exception as e:
        checks.append(("Patient tool assignment", False, str(e)))

    # Check 4: Patient data exists
    try:
        from src.config.database import AsyncSessionLocal, Patient
        from sqlalchemy import select, func

        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(func.count()).select_from(Patient)
            )
            count = result.scalar()

            if count > 0:
                result = await session.execute(select(Patient).limit(1))
                patient = result.scalar_one_or_none()
                checks.append((f"Patient data ({count} patients, e.g. {patient.name})", True))
            else:
                checks.append(("Patient data", False, "No patients found"))
    except Exception as e:
        checks.append(("Patient data", False, str(e)))

    # Print results
    all_passed = True
    for check in checks:
        status = "✓" if check[1] else "✗"
        message = check[0]
        if not check[1] and len(check) > 2:
            message += f" - {check[2]}"
        print(f"{status} {message}")
        if not check[1]:
            all_passed = False

    print()
    if all_passed:
        print("✓ All prerequisites met!")
    else:
        print("⚠ Some prerequisites are missing. Please run:")
        print("  1. docker-compose up -d")
        print("  2. python -m scripts.db.init_db")
        print("  3. python -m scripts.db.seed.seed_agents")
        print("  4. python -m scripts.db.seed.seed_mock_data")
        print("  5. python -m scripts.db.seed.seed_patient_tool_assignment")

    print("=" * 70)
    return all_passed


async def main():
    """Run all tests."""
    print("\n" + "="*70)
    print("PATIENT QUERY DELEGATION - INTEGRATION TEST SUITE")
    print("="*70)

    # Step 1: Verify setup
    setup_ok = await verify_setup()

    if not setup_ok:
        print("\n⚠ Setup incomplete. Please fix prerequisites before running tests.")
        return

    # Step 2: Test direct LangGraph agent
    await test_direct_langgraph_agent()

    # Step 3: Test via API (if server is running)
    print("\n\nNOTE: API test requires server to be running.")
    print("Start server with: python -m src.api")
    user_input = input("Run API test? (y/N): ")

    if user_input.lower() == 'y':
        await test_patient_query_via_api()
    else:
        print("Skipping API test.")

    print("\n" + "="*70)
    print("ALL TESTS COMPLETED")
    print("="*70)


if __name__ == "__main__":
    asyncio.run(main())
