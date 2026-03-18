"""
RAG Agent client — connects to the hackathon RAG agent at http://10.1.96.117

The client tries the following endpoint patterns in order, adapting to whichever
API the RAG server exposes. Update RAG_BASE_URL or endpoint paths as needed
once you know the exact API spec.
"""

import asyncio
import json
import os
from typing import AsyncGenerator

import httpx

RAG_BASE_URL = os.getenv("RAG_BASE_URL", "http://10.1.96.117")
RAG_TIMEOUT = float(os.getenv("RAG_TIMEOUT", "120"))


class RAGClient:
    """
    Streams completions from the hackathon RAG agent.

    Supported API shapes (tried in order):
      1. OpenAI-compatible:  POST /v1/chat/completions  (stream=True)
      2. Simple chat:        POST /chat                 (streaming)
      3. Query endpoint:     POST /query                (non-streaming, chunked manually)
    """

    def __init__(self):
        self.base_url = RAG_BASE_URL.rstrip("/")

    async def stream_completion(
        self,
        system_prompt: str,
        user_prompt: str,
        agent_name: str = "Agent",
    ) -> AsyncGenerator[str, None]:
        """Yields text chunks as they stream from the RAG agent."""
        try:
            async for chunk in self._try_openai_compat(system_prompt, user_prompt):
                yield chunk
        except Exception:
            try:
                async for chunk in self._try_chat_endpoint(system_prompt, user_prompt):
                    yield chunk
            except Exception:
                async for chunk in self._try_query_endpoint(system_prompt, user_prompt, agent_name):
                    yield chunk

    # ------------------------------------------------------------------
    # Endpoint strategy 1: OpenAI-compatible /v1/chat/completions
    # ------------------------------------------------------------------

    async def _try_openai_compat(
        self, system_prompt: str, user_prompt: str
    ) -> AsyncGenerator[str, None]:
        payload = {
            "model": "hackathon-rag",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "stream": True,
            "max_tokens": 1500,
            "temperature": 0.7,
        }

        async with httpx.AsyncClient(timeout=RAG_TIMEOUT) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/v1/chat/completions",
                json=payload,
                headers={"Content-Type": "application/json"},
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line or not line.startswith("data: "):
                        continue
                    data_str = line[len("data: "):]
                    if data_str.strip() == "[DONE]":
                        break
                    try:
                        data = json.loads(data_str)
                        delta = data["choices"][0]["delta"].get("content", "")
                        if delta:
                            yield delta
                    except (json.JSONDecodeError, KeyError):
                        continue

    # ------------------------------------------------------------------
    # Endpoint strategy 2: POST /chat with streaming
    # ------------------------------------------------------------------

    async def _try_chat_endpoint(
        self, system_prompt: str, user_prompt: str
    ) -> AsyncGenerator[str, None]:
        payload = {
            "system": system_prompt,
            "message": user_prompt,
            "stream": True,
        }

        async with httpx.AsyncClient(timeout=RAG_TIMEOUT) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/chat",
                json=payload,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    # Try JSON chunk format
                    try:
                        data = json.loads(line.lstrip("data: "))
                        text = data.get("text") or data.get("content") or data.get("response", "")
                        if text:
                            yield text
                    except json.JSONDecodeError:
                        # Plain text stream
                        yield line

    # ------------------------------------------------------------------
    # Endpoint strategy 3: POST /query (non-streaming, yielded in chunks)
    # ------------------------------------------------------------------

    async def _try_query_endpoint(
        self, system_prompt: str, user_prompt: str, agent_name: str
    ) -> AsyncGenerator[str, None]:
        payload = {
            "query": user_prompt,
            "system_prompt": system_prompt,
            "agent": agent_name,
        }

        async with httpx.AsyncClient(timeout=RAG_TIMEOUT) as client:
            response = await client.post(
                f"{self.base_url}/query",
                json=payload,
            )
            response.raise_for_status()
            data = response.json()

            # Extract text from common response shapes
            text = (
                data.get("response")
                or data.get("answer")
                or data.get("text")
                or data.get("result")
                or str(data)
            )

        # Simulate streaming by yielding word by word
        words = text.split(" ")
        for i, word in enumerate(words):
            yield word + (" " if i < len(words) - 1 else "")
            await asyncio.sleep(0.02)
