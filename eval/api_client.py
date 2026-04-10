# eval/api_client.py
import json
import os
from dataclasses import dataclass, field

import httpx

BASE_URL = os.getenv("EVAL_BASE_URL", "http://localhost:8000")


@dataclass
class ChatEvent:
    chunks: list[str] = field(default_factory=list)
    tool_calls: list[dict] = field(default_factory=list)
    session_id: int | None = None

    @property
    def content(self) -> str:
        return "".join(self.chunks)


class EvalApiClient:
    def __init__(self, base_url: str = BASE_URL):
        self._base_url = base_url
        self._client = httpx.AsyncClient(base_url=base_url, timeout=120.0)

    async def __aenter__(self) -> "EvalApiClient":
        return self

    async def __aexit__(self, *args) -> None:
        await self._client.aclose()

    async def create_patient(self, name: str, dob: str, gender: str) -> dict:
        """POST /api/patients — returns patient dict with 'id'."""
        resp = await self._client.post(
            "/api/patients",
            json={"name": name, "dob": dob, "gender": gender},
        )
        resp.raise_for_status()
        return resp.json()

    async def form_response(
        self,
        session_id: int,
        form_id: str,
        answers: dict,
        template: str | None = None,
    ) -> None:
        """POST /api/chat/{session_id}/form-response."""
        payload: dict = {"form_id": form_id, "answers": answers}
        if template is not None:
            payload["template"] = template
        resp = await self._client.post(
            f"/api/chat/{session_id}/form-response",
            json=payload,
        )
        resp.raise_for_status()

    async def chat(
        self,
        message: str,
        patient_id: int | None = None,
        visit_id: int | None = None,
        session_id: int | None = None,
        mode: str | None = None,
        user_id: str = "eval-user",
    ) -> ChatEvent:
        """POST /api/chat with streaming=True. Consumes SSE stream and returns ChatEvent."""
        payload: dict = {
            "message": message,
            "user_id": user_id,
            "stream": True,
        }
        if patient_id is not None:
            payload["patient_id"] = patient_id
        if visit_id is not None:
            payload["visit_id"] = visit_id
        if session_id is not None:
            payload["session_id"] = session_id
        if mode is not None:
            payload["mode"] = mode

        event = ChatEvent()
        async with self._client.stream("POST", "/api/chat", json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line.startswith("data: "):
                    continue
                try:
                    data = json.loads(line[6:])
                except json.JSONDecodeError:
                    continue

                if "chunk" in data:
                    event.chunks.append(data["chunk"])
                elif "tool_call" in data:
                    event.tool_calls.append(data["tool_call"])
                elif "session_id" in data:
                    event.session_id = data["session_id"]
                elif data.get("done"):
                    break

        return event
