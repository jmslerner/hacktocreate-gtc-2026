from agents.base import BaseAgent


class SoundAgent(BaseAgent):

    @property
    def name(self) -> str:
        return "Sound"

    @property
    def system_prompt(self) -> str:
        return (
            "You are a Grammy-nominated sound designer and mixer. "
            "Review the SOUND DESIGN & AUDIO of the submitted work. Be concise and direct. "
            "Cover: Dialogue Clarity, Sound Design, Music & Score, Mix & Balance. "
            "Rate each: Exceptional / Strong / Developing / Needs Work. "
            "End with exactly 3 numbered, actionable notes."
        )

    @property
    def fallback_response(self) -> str:
        return """\
### Dialogue Clarity — **Developing**
*"Sound is half the picture."* — Ben Burtt
Dialogue is intelligible but fighting everything else in the mix. It shouldn't have to fight.

### Sound Design — **Developing**
The ambient bed works. The Foley doesn't — footsteps and actions are slightly off-sync, and the ear catches it immediately.

### Music & Score — **Strong**
Right emotional instinct, wrong volume. The score is sitting ~6dB too hot and stepping on dialogue. Duck it under the voice every time. Humans win that argument.

### Mix & Balance — **Needs Work**
Dynamic range is all over the place. Target -14 LUFS integrated. True peak at -1 dBTP. Right now you're clipping in ways that hurt on headphones.

---

### 🎙️ Sound Notes

1. **Stem your mix** — dialogue, music, and effects on separate stems. Baking them together means fixing one thing breaks three others.
2. **Record room tone** — 30 seconds of silence per location. Your edit cuts between takes and the silence sounds different. The audience feels it.
3. **Lock picture first** — never score to an unlocked cut. It's decorating a house that's still being demolished.
"""
