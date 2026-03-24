import pytest
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from src.utils.token_budget import trim_to_token_budget, count_message_tokens


class TestTrimToTokenBudget:
    def test_empty_list_returns_empty(self):
        assert trim_to_token_budget([], budget=100) == []

    def test_only_system_messages_never_dropped(self):
        msgs = [SystemMessage(content="sys1"), SystemMessage(content="sys2")]
        result = trim_to_token_budget(msgs, budget=1)  # impossibly small budget
        assert len(result) == 2
        assert all(isinstance(m, SystemMessage) for m in result)

    def test_oldest_messages_dropped_first(self):
        msgs = [
            HumanMessage(content="old message"),
            AIMessage(content="old reply"),
            HumanMessage(content="recent message"),
            AIMessage(content="recent reply"),
        ]
        # Force trim by using a tiny budget that keeps only the recent pair
        budget = count_message_tokens([msgs[2], msgs[3]]) + 10
        result = trim_to_token_budget(msgs, budget=budget)
        contents = [m.content for m in result]
        assert "recent message" in contents
        assert "recent reply" in contents
        assert "old message" not in contents

    def test_system_messages_preserved_when_trimming(self):
        msgs = [
            SystemMessage(content="system prompt"),
            HumanMessage(content="old message"),
            HumanMessage(content="recent message"),
        ]
        budget = count_message_tokens([msgs[0], msgs[2]]) + 5
        result = trim_to_token_budget(msgs, budget=budget)
        assert any(isinstance(m, SystemMessage) for m in result)
        assert any(m.content == "recent message" for m in result)
        assert not any(m.content == "old message" for m in result)

    def test_result_is_under_budget(self):
        msgs = [HumanMessage(content="x" * 500) for _ in range(10)]
        result = trim_to_token_budget(msgs, budget=50)
        total = count_message_tokens(result)
        assert total <= 50 or result == []  # may be empty if even one msg exceeds budget

    def test_already_under_budget_unchanged(self):
        msgs = [
            SystemMessage(content="sys"),
            HumanMessage(content="hi"),
            AIMessage(content="hello"),
        ]
        budget = count_message_tokens(msgs) + 100
        result = trim_to_token_budget(msgs, budget=budget)
        assert len(result) == 3
