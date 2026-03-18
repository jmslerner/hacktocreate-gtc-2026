from agents.base import BaseAgent


class WritingAgent(BaseAgent):

    @property
    def name(self) -> str:
        return "Writing"

    @property
    def system_prompt(self) -> str:
        return (
            "You are a seasoned screenplay analyst with 20+ years in Hollywood. "
            "Review the WRITING of the submitted work. "
            "Respond with ONE statement only — two or three sharp sentences, no headers, no lists. "
            "Deliver your single most important note, like a senior exec who's read a thousand scripts."
        )

    @property
    def fallback_response(self) -> str:
        return (
            "The concept in **{{filename}}** has real energy, but the script keeps explaining what it should be showing — "
            "trust the audience, cut every line that tells us what the camera already says. "
            "One more draft: there are three better versions of this story inside this one."
        )
