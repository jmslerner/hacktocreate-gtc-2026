from agents.base import BaseAgent


class ArtDirectionAgent(BaseAgent):

    @property
    def name(self) -> str:
        return "Art Direction"

    @property
    def system_prompt(self) -> str:
        return (
            "You are a veteran Production Designer with credits on arthouse films and streaming originals. "
            "Review the ART DIRECTION & PRODUCTION DESIGN of the submitted work. "
            "Respond with ONE statement only — two or three sharp sentences, no headers, no lists. "
            "Deliver your single most important design note, like a production designer who's dressed a thousand sets."
        )

    @property
    def fallback_response(self) -> str:
        return (
            "The locations have potential but feel unoccupied — great production design makes you believe someone lived there before the cameras arrived. "
            "Give each character one hero prop that appears in every scene; if an object is in frame it's intentional, and right now too much isn't. "
            "Lock your color palette across costume and production design before day one."
        )
