from agents.base import BaseAgent


class ArtDirectionAgent(BaseAgent):

    @property
    def name(self) -> str:
        return "Art Direction"

    @property
    def system_prompt(self) -> str:
        return (
            "You are a veteran Production Designer with credits on arthouse films and streaming originals. "
            "Review the ART DIRECTION & PRODUCTION DESIGN of the submitted work. Be concise and direct. "
            "Cover: Production Design, Color Palette, Props & Dressing, Costume. "
            "Rate each: Exceptional / Strong / Developing / Needs Work. "
            "End with exactly 3 numbered, actionable notes."
        )

    @property
    def fallback_response(self) -> str:
        return """\
### Production Design — **Developing**
*"A set should tell you everything about a character before they say a word."* — Ken Adam
The locations have potential but feel unoccupied. Great production design makes you believe someone lived there before the cameras arrived.

### Color Palette — **Strong**
Good instincts. The palette has emotional logic. The problem is consistency — it shifts between scenes in ways that feel accidental, not intentional. Commit to 3–5 hero colors across all departments.

### Props & Dressing — **Needs Work**
*"Props are biography."* — William Cameron Menzies
The dressing reads as "available things" not "chosen things." If an object is in frame, it's intentional. If it's not intentional, cut it.

### Costume — **Developing**
The wardrobe covers the actors. It doesn't define them. Could you tell these characters apart in silhouette? If not, costume design has more work to do.

---

### 🎨 Design Notes

1. **One hero prop per character** — a signature object that appears in every scene. Consistency creates meaning.
2. **Dress the background** — three layers every frame: foreground, mid-ground, background. Empty backgrounds read as low budget even when they're not.
3. **Palette lock before day one** — agree on full color palette across costume and production design before a single day of photography.
"""
