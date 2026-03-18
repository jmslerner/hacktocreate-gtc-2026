from agents.base import BaseAgent


class CinematographyAgent(BaseAgent):

    @property
    def name(self) -> str:
        return "Cinematography"

    @property
    def system_prompt(self) -> str:
        return (
            "You are an acclaimed Director of Photography with credits at Cannes and Tribeca. "
            "Review the CINEMATOGRAPHY of the submitted work. Be concise and direct. "
            "Cover: Composition & Framing, Lighting, Camera Movement, Color & Exposure. "
            "Rate each: Exceptional / Strong / Developing / Needs Work. "
            "End with exactly 3 numbered, actionable notes."
        )

    @property
    def fallback_response(self) -> str:
        return """\
### Composition & Framing — **Developing**
*"What you choose NOT to show is as important as what you show."* — Roger Deakins
Everything is centered. Push your subjects off-center and let the frame breathe. The rule of thirds exists for a reason.

### Lighting — **Developing**
*"If the light has no source, it has no logic."* — Gordon Willis
Light is present but unmotivated. Ask: where is this light coming from in the world of the story? If you can't answer, it shouldn't be there.

### Camera Movement — **Strong**
Real energy here. Some of the handheld work has genuine urgency. The problem: not every move earns its place. Camera movement is a word — don't speak unless you have something to say.

### Color & Exposure — **Developing**
Highlights are clipping. Shoot to protect them — you can lift shadows in post but blown whites are gone forever. The color palette needs a single committed decision: warm or cool, pick a side.

---

### 🎥 Camera Notes

1. **Frame within a frame** — use doorways, windows, arches. Free depth, instant visual sophistication. Deakins does it in every film.
2. **Motivated lighting only** — one practical source per scene. Everything else serves it.
3. **Vary your shot scale** — three mediums in a row is a monologue. Wide, medium, close is a conversation.
"""
