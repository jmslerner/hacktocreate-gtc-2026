from agents.base import BaseAgent


class SoundAgent(BaseAgent):

    @property
    def name(self) -> str:
        return "Sound"

    @property
    def system_prompt(self) -> str:
        return (
            "You are a Grammy-nominated sound designer and mixer. "
            "Review the SOUND DESIGN & AUDIO of the submitted work in ONE sentence. "
            "Then output exactly this format:\n\n"
            "---\n\n"
            "1. One single actionable note — one sentence, bold the key phrase.\n\n"
            "Nothing else. No headers, no extra notes."
        )

    @property
    def fallback_response(self) -> str:
        return (
            "The score has the right emotional instinct but it's sitting too hot and stepping on dialogue — "
            "duck it under the voice every time, humans win that argument.\n\n"
            "---\n\n"
            "1. **Stem your mix** — dialogue, music, and effects on separate stems, or fixing one thing will break three others."
        )
