---
name: documentary-scriptwriting
description: Use when writing or rewriting documentary narration — turning verified claims and a story architecture into conversational spoken prose, hitting a word budget, applying required hedges, and satisfying the script contract. Triggers include "write the narration", "this sounds like an encyclopedia", "rewrite this section", "make it sound human", and running the pipeline's script stage.
version: 1.0.0
---

# Documentary scriptwriting

The facts are settled and the order is fixed before writing starts. The writer
decides how it sounds.

```bash
npm run make-video -- "<topic>" --slug=<slug> --only=script --minutes=<n> --style=<style>
```

Output must satisfy `docs/CONTRACT.md` §4 exactly. Read the artifact afterwards
and check the invariants yourself.

## The difference

Not this:

> The Emu War was a wildlife management operation conducted in Australia in 1932
> in response to agricultural damage caused by emu populations.

This:

> In 1932, Australia found itself facing an enemy it hadn't planned for.
> Thousands of them were moving across Western Australia. They were fast, they
> were hard to stop — and they weren't human.

Then reveal the emus.

## Rules

**Write for the ear.** Short sentences, one idea each. If you lose the thread
reading it in your head, it is too long.

**Concrete before abstract.** "Two million gallons" lands; "a substantial
quantity" does not.

**No throat-clearing.** Delete "It's important to note", "Interestingly",
"Let's take a look at", "But first, some context". Each is a cue to leave.

**Transitions state what changed.** Not "However" but "That worked for nine
days."

**Hedge in plain speech.** Not "it is disputed among historians whether", but
"nobody actually knows how many. The army said 986. The farmers said far more,
and the army had reason to round down." A hedge stated as a specific
disagreement is *more* interesting than false confidence.

**Say the uncertainty once, where it belongs.** Sprinkling it everywhere reads
as evasive.

**Cut claims stay cut.** Not as "some say", not as a rhetorical question, not as
a joke. If a section is thin without one, report it.

**Land the argument, then the theme.** The final section calls back to the cold
open, then to `CHANNEL.theme`, then the sign-off from `pipeline/channel.mjs`,
verbatim.

## Word budget

143 words per minute (`WORDS_PER_MINUTE`), measured from a finished film
including pauses. Budget per section from the architecture. A section 30% over
is not tight enough — cut it; do not plan to speed up delivery.

## The `tts` field

Only where the written form would be misread aloud — years, Roman numerals,
BCE, "c.", symbols. `"text": "In 146 BC, …"` → `"tts": "In one forty-six BC, …"`.
Never restate a whole sentence: `text` is what the subtitles show, and the two
must not drift.

## Before handing off

Read the cold open aloud. Check each `requiredHedge` landed. Check word counts
per section. Check no cut claim came back. Check the last paragraph's
`pauseAfter` is `"paragraph"`.
