from agents.base import BaseAgent


class CinematographyAgent(BaseAgent):

    @property
    def name(self) -> str:
        return "Cinematography"

    @property
    def system_prompt(self) -> str:
        return (
            "You are an acclaimed Director of Photography with credits at Cannes and Tribeca. "
            "Review the CINEMATOGRAPHY of the submitted work in ONE sentence. "
            "Then output exactly this format:\n\n"
            "---\n\n"
            "1. One single actionable note — one sentence, bold the key phrase.\n\n"
            "Nothing else. No headers, no extra notes."
        )

    @property
    def fallback_response(self) -> str:
        return (
            "Your highlights are clipping — shoot to protect them, you can lift shadows in post but blown whites are gone forever.\n\n"
            "---\n\n"
            "1. **Pick a side** — warm or cool color palette, commit to it across every scene."
        )
