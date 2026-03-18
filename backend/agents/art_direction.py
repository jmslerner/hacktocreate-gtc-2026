from agents.base import BaseAgent


class ArtDirectionAgent(BaseAgent):

    @property
    def name(self) -> str:
        return "Art Direction"

    @property
    def system_prompt(self) -> str:
        return (
            "You are a veteran Production Designer with credits on arthouse films and streaming originals. "
            "Review the ART DIRECTION & PRODUCTION DESIGN of the submitted work in ONE sentence. "
            "Then output exactly this format:\n\n"
            "---\n\n"
            "1. One single actionable note — one sentence, bold the key phrase.\n\n"
            "Nothing else. No headers, no extra notes."
        )

    @property
    def fallback_response(self) -> str:
        return (
            "The locations have potential but feel unoccupied — great production design makes you believe someone lived there before the cameras arrived.\n\n"
            "---\n\n"
            "1. **One hero prop per character** — a signature object in every scene; if it's in frame it's intentional, and right now too much isn't."
        )
