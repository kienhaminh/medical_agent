"""Tests for parallel sub-agent execution with fan-in/fan-out pattern."""

import pytest
import asyncio
import time
from unittest.mock import Mock, AsyncMock, patch
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from src.agent.langgraph_agent import LangGraphAgent


class TestParallelSubAgentExecution:
    """Test parallel execution of sub-agents."""

    @pytest.mark.asyncio
    async def test_parallel_execution_faster_than_sequential(self):
        """Verify parallel execution is faster than sequential.
        
        With 3 sub-agents each taking 1 second:
        - Sequential: ~3 seconds
        - Parallel: ~1 second
        """
        # Mock LLM with async invoke that takes 1 second
        mock_llm = Mock()
        mock_llm.tools = []
        
        async def mock_ainvoke(*args, **kwargs):
            await asyncio.sleep(1.0)  # Simulate 1 second LLM call
            return AIMessage(content="Specialist response")
        
        mock_llm.ainvoke = AsyncMock(side_effect=mock_ainvoke)
        mock_llm.bind_tools = Mock(return_value=mock_llm)
        
        # Create agent
        agent = LangGraphAgent(
            llm_with_tools=mock_llm,
            max_concurrent_subagents=5,
            subagent_timeout=30.0
        )
        
        # Mock sub-agents
        agent.sub_agents = {
            "radiologist": {
                "id": 1,
                "name": "Radiologist",
                "role": "radiologist",
                "system_prompt": "You are a radiologist",
                "tools": []
            },
            "pathologist": {
                "id": 2,
                "name": "Pathologist",
                "role": "pathologist",
                "system_prompt": "You are a pathologist",
                "tools": []
            },
            "pharmacist": {
                "id": 3,
                "name": "Pharmacist",
                "role": "pharmacist",
                "system_prompt": "You are a pharmacist",
                "tools": []
            }
        }
        
        # Create mock state with specialist request
        state = {
            "messages": [
                HumanMessage(content="I need radiologist, pathologist, and pharmacist"),
                AIMessage(content="CONSULT: radiologist,pathologist,pharmacist")
            ],
            "patient_profile": {},
            "steps_taken": 0,
            "final_report": None,
            "next_agents": []
        }
        
        # Get the sub_agent_consultation function from the graph
        # We need to access it directly for testing
        # Extract the function from the compiled graph
        import inspect
        
        # Find the sub_agent_consultation function in the _build_graph locals
        graph_build_code = inspect.getsource(agent._build_graph)
        
        # For now, we'll test by measuring process_message timing
        start_time = time.time()
        
        # Mock the graph to test just the consultation node
        with patch.object(agent, '_extract_specialist_request', return_value=['radiologist', 'pathologist', 'pharmacist']):
            # We need to rebuild the graph to get the new async function
            agent.graph = agent._build_graph()
            
            # Since the graph is compiled, we test end-to-end timing
            result = await agent.process_message(
                "Consult radiologist, pathologist, pharmacist",
                stream=False
            )
        
        elapsed_time = time.time() - start_time
        
        # Should complete in ~1-2 seconds (parallel), not ~3 seconds (sequential)
        # Allow 2.5s buffer for test execution overhead
        assert elapsed_time < 2.5, f"Expected parallel execution <2.5s, got {elapsed_time:.2f}s"

    @pytest.mark.asyncio
    async def test_handles_partial_subagent_failures(self):
        """Verify system continues when one sub-agent fails."""
        mock_llm = Mock()
        mock_llm.tools = []
        
        # Mock ainvoke: radiologist succeeds, pathologist fails
        call_count = [0]
        
        async def mock_ainvoke(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:  # First call (radiologist)
                return AIMessage(content="Radiologist analysis complete")
            else:  # Second call (pathologist)
                raise Exception("Pathologist service unavailable")
        
        mock_llm.ainvoke = AsyncMock(side_effect=mock_ainvoke)
        mock_llm.bind_tools = Mock(return_value=mock_llm)
        
        agent = LangGraphAgent(llm_with_tools=mock_llm)
        
        # Mock sub-agents
        agent.sub_agents = {
            "radiologist": {
                "id": 1,
                "name": "Radiologist",
                "role": "radiologist",
                "system_prompt": "You are a radiologist",
                "tools": []
            },
            "pathologist": {
                "id": 2,
                "name": "Pathologist",
                "role": "pathologist",
                "system_prompt": "You are a pathologist",
                "tools": []
            }
        }
        
        with patch.object(agent, '_extract_specialist_request', return_value=['radiologist', 'pathologist']):
            agent.graph = agent._build_graph()
            result = await agent.process_message("Consult radiologist and pathologist", stream=False)
        
        # Should contain successful radiologist response
        assert "Radiologist" in result
        # Should contain error message for pathologist
        assert "Error" in result or "Exception" in result

    @pytest.mark.asyncio
    async def test_respects_concurrency_limit(self):
        """Verify max concurrent sub-agents limit is enforced."""
        mock_llm = Mock()
        mock_llm.tools = []
        
        # Track concurrent executions
        active_count = [0]
        max_concurrent_seen = [0]
        lock = asyncio.Lock()
        
        async def mock_ainvoke(*args, **kwargs):
            async with lock:
                active_count[0] += 1
                max_concurrent_seen[0] = max(max_concurrent_seen[0], active_count[0])
            
            await asyncio.sleep(0.1)  # Simulate work
            
            async with lock:
                active_count[0] -= 1
            
            return AIMessage(content="Response")
        
        mock_llm.ainvoke = AsyncMock(side_effect=mock_ainvoke)
        mock_llm.bind_tools = Mock(return_value=mock_llm)
        
        # Create agent with max_concurrent=2
        agent = LangGraphAgent(
            llm_with_tools=mock_llm,
            max_concurrent_subagents=2
        )
        
        # Mock 5 sub-agents
        agent.sub_agents = {
            f"specialist_{i}": {
                "id": i,
                "name": f"Specialist {i}",
                "role": f"specialist_{i}",
                "system_prompt": f"You are specialist {i}",
                "tools": []
            }
            for i in range(5)
        }
        
        specialist_roles = [f"specialist_{i}" for i in range(5)]
        
        with patch.object(agent, '_extract_specialist_request', return_value=specialist_roles):
            agent.graph = agent._build_graph()
            await agent.process_message("Consult all 5 specialists", stream=False)
        
        # Should never exceed max_concurrent limit of 2
        assert max_concurrent_seen[0] <= 2, f"Expected max 2 concurrent, saw {max_concurrent_seen[0]}"

    @pytest.mark.asyncio
    async def test_timeout_prevents_hanging(self):
        """Verify timeout cancels slow sub-agents."""
        mock_llm = Mock()
        mock_llm.tools = []
        
        # Mock slow ainvoke (5 seconds)
        async def slow_ainvoke(*args, **kwargs):
            await asyncio.sleep(5.0)
            return AIMessage(content="This should timeout")
        
        mock_llm.ainvoke = AsyncMock(side_effect=slow_ainvoke)
        mock_llm.bind_tools = Mock(return_value=mock_llm)
        
        # Create agent with 1 second timeout
        agent = LangGraphAgent(
            llm_with_tools=mock_llm,
            subagent_timeout=1.0
        )
        
        agent.sub_agents = {
            "slow_specialist": {
                "id": 1,
                "name": "Slow Specialist",
                "role": "slow_specialist",
                "system_prompt": "You are slow",
                "tools": []
            }
        }
        
        with patch.object(agent, '_extract_specialist_request', return_value=['slow_specialist']):
            agent.graph = agent._build_graph()
            
            start_time = time.time()
            result = await agent.process_message("Consult slow specialist", stream=False)
            elapsed = time.time() - start_time
        
        # Should complete within timeout + overhead (not 5 seconds)
        assert elapsed < 2.0, f"Should timeout in ~1s, took {elapsed:.2f}s"
        # Result should mention timeout
        assert "Timeout" in result or "timeout" in result.lower()

    @pytest.mark.asyncio
    async def test_error_handling_in_parallel(self):
        """Test that errors in one specialist don't crash the entire system."""
        mock_llm = Mock()
        mock_llm.tools = []
        
        specialist_errors = {
            "specialist_1": None,  # Success
            "specialist_2": ValueError("Invalid input"),  # Error
            "specialist_3": None,  # Success
        }
        
        current_specialist = [None]
        
        async def mock_ainvoke(*args, **kwargs):
            # Determine which specialist based on system prompt
            for msg in args[0]:
                if isinstance(msg, SystemMessage):
                    for spec_name, error in specialist_errors.items():
                        if spec_name.replace("_", " ") in msg.content.lower():
                            current_specialist[0] = spec_name
                            break
            
            if specialist_errors.get(current_specialist[0]):
                raise specialist_errors[current_specialist[0]]
            
            return AIMessage(content=f"{current_specialist[0]} analysis")
        
        mock_llm.ainvoke = AsyncMock(side_effect=mock_ainvoke)
        mock_llm.bind_tools = Mock(return_value=mock_llm)
        
        agent = LangGraphAgent(llm_with_tools=mock_llm)
        
        agent.sub_agents = {
            name: {
                "id": i,
                "name": name.replace("_", " ").title(),
                "role": name,
                "system_prompt": f"You are {name}",
                "tools": []
            }
            for i, name in enumerate(specialist_errors.keys())
        }
        
        with patch.object(agent, '_extract_specialist_request', return_value=list(specialist_errors.keys())):
            agent.graph = agent._build_graph()
            result = await agent.process_message("Consult all specialists", stream=False)
        
        # Should contain successful responses
        assert "specialist_1" in result.lower() or "specialist 1" in result.lower()
        assert "specialist_3" in result.lower() or "specialist 3" in result.lower()
        
        # Should contain error for specialist_2
        assert "error" in result.lower() or "exception" in result.lower()


class TestParallelPerformance:
    """Performance benchmarks for parallel execution."""

    @pytest.mark.asyncio
    async def test_speedup_ratio(self):
        """Measure speedup ratio for parallel vs sequential."""
        # This is more of a benchmark than a test
        # Skip in CI, run manually for performance profiling
        pytest.skip("Manual performance benchmark")
        
        # TODO: Implement detailed performance comparison
