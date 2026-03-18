from agents.base import BaseAgent


class WritingAgent(BaseAgent):

    @property
    def name(self) -> str:
        return "Writing"

    @property
    def system_prompt(self) -> str:
        return (
            "You are a seasoned screenplay analyst with 20+ years in Hollywood. "
            "Review the WRITING of the submitted work in ONE sentence. "
            "Then output exactly this format:\n\n"
            "---\n\n"
            "1. One single actionable note — one sentence, bold the key phrase.\n\n"
            "Nothing else. No headers, no extra notes."
        )

    @property
    def fallback_response(self) -> str:
        return (
            "The concept has real energy, but the script keeps explaining what it should be showing — "
            "trust the audience and cut every line that tells us what the camera already says.\n\n"
            "---\n\n"
            "1. **One more draft** — there are three better versions of this script inside this one, go find them."
        )
