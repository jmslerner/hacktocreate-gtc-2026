"""Base agent class — all judge agents inherit from this."""
from abc import ABC, abstractmethod
from typing import AsyncGenerator

from services.rag_client import RAGClient


class BaseAgent(ABC):
    """
    Each judge agent streams its analysis token-by-token using the RAG
    agent at http://10.1.96.117.
    """

    def __init__(self):
        self.rag = RAGClient()

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable agent name."""
        ...

    @property
    @abstractmethod
    def system_prompt(self) -> str:
        """The judge's specialist persona and instructions."""
        ...

    def build_user_prompt(self, session: dict) -> str:
        """Build the analysis prompt from session metadata."""
        meta = session.get("metadata", {})
        filename = session.get("filename", "unknown")
        file_type = meta.get("file_type", "unknown")
        duration = meta.get("duration")
        resolution = f"{meta.get('width')}x{meta.get('height')}" if meta.get("width") else None
        fps = meta.get("fps")
        size_mb = meta.get("size_mb")
        has_audio = meta.get("has_audio", False)

        lines = [
            f"File: {filename}",
            f"Type: {file_type}",
        ]
        if duration:
            lines.append(f"Duration: {duration:.1f}s")
        if resolution:
            lines.append(f"Resolution: {resolution}")
        if fps:
            lines.append(f"Frame rate: {fps} fps")
        if size_mb:
            lines.append(f"Size: {size_mb:.1f} MB")
        if has_audio:
            lines.append("Audio: present")

        # Add any extracted transcript or description if available
        if session.get("transcript"):
            lines.append(f"\nAudio transcript:\n{session['transcript']}")
        if session.get("frame_description"):
            lines.append(f"\nVisual description:\n{session['frame_description']}")

        file_summary = "\n".join(lines)

        return (
            f"Please review the following film/video submission as the {self.name} judge.\n\n"
            f"--- FILE METADATA ---\n{file_summary}\n\n"
            "Provide your expert feedback with specific, actionable observations. "
            "Structure your response with clear sections. Be direct and professional — "
            "like a senior production company executive giving notes."
        )

    @property
    def fallback_response(self) -> str:
        """Rich fallback shown when the RAG agent is unavailable or returns empty."""
        return ""

    async def analyze_stream(self, session: dict) -> AsyncGenerator[str, None]:
        user_prompt = self.build_user_prompt(session)
        collected = []
        try:
            async for chunk in self.rag.stream_completion(
                system_prompt=self.system_prompt,
                user_prompt=user_prompt,
                agent_name=self.name,
            ):
                collected.append(chunk)
                yield chunk
        except Exception:
            pass

        # If RAG returned nothing, stream the fallback word-by-word
        if not "".join(collected).strip():
            import asyncio
            filename = session.get("filename", "this piece")
            fallback = self.fallback_response.replace("{{filename}}", filename)
            words = fallback.split(" ")
            for i, word in enumerate(words):
                yield word + (" " if i < len(words) - 1 else "")
                await asyncio.sleep(0.03)
