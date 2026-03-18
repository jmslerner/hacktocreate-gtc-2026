from agents.base import BaseAgent


class WritingAgent(BaseAgent):

    @property
    def name(self) -> str:
        return "Writing"

    @property
    def system_prompt(self) -> str:
        return (
            "You are a seasoned screenplay analyst with 20+ years in Hollywood. "
            "Review the WRITING of the submitted work. Be concise and direct — like a senior exec giving notes. "
            "Cover: Story Structure, Character & Dialogue, Theme, Script Execution. "
            "Rate each: Exceptional / Strong / Developing / Needs Work. "
            "End with exactly 3 numbered, actionable notes."
        )

    @property
    def fallback_response(self) -> str:
        return """\
### Story Structure — **Developing**
*"If you have a problem with the third act, the real problem is in the first act."* — Billy Wilder
The narrative arc in **{{filename}}** has energy but lacks spine. The scenes don't build on each other — they just follow each other.

### Character & Dialogue — **Developing**
*"A story is not about what happens. It's about what happens to someone."* — William Goldman
Your characters are happening *at* us. Cut every line that explains what we can already see.

### Theme & Concept — **Strong**
The concept is genuinely compelling. You just keep explaining it instead of trusting the audience to feel it. Stop explaining. Start showing.

### Script Execution — **Developing**
Good instincts, weak follow-through. The camera should be doing half the work the script is currently doing.

---

### 🎬 Director's Notes

1. **Open stronger** — you have 90 seconds to make the audience lean forward. Use them.
2. **Kill your darlings** — find the scene you love most. If the story survives without it, cut it.
3. **One more draft** — there are three better versions of this script inside this one. Go find them.
"""
