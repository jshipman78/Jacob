---
name: documentary-story-structure
description: Use when arranging verified facts into a documentary structure — choosing the cold open, laying out section beats on a clock, sequencing escalation and the turn, and diagnosing a film that reads flat. Triggers include "structure this video", "what order should this go in", "the middle is boring", "story architecture", and planning a runtime's section breakdown.
version: 1.0.0
---

# Documentary story structure

Structure answers one question: in what order does someone hear this so they do
not leave?

## A 15-minute frame

Starting point, not a template:

```
0:00–0:30   Cold open      One concrete image or fact. A question the viewer now needs answered.
0:30–1:30   Setup          Who, where, what is at stake.
1:30–3:30   World          Only the context needed to feel the stakes.
3:30–6:00   Escalation     It gets worse in steps, each with a consequence.
6:00–9:00   Crisis         The thing the film is about.
9:00–11:30  Turn           What changed, was discovered, or is still argued about.
11:30–13:30 Outcome        What happened to the people and the place.
13:30–14:30 Consequences   Why it matters. The argument lands.
14:30–15:00 Final thought  Call back to the cold open, then the channel's theme.
```

Scale by removing beats, not by shortening all of them. A 7-minute film is
cold open / setup / escalation / crisis / outcome / thought.

## The beats the contract knows

`docs/CONTRACT.md` §2 requires 5–8 sections, first `beat: "cold-open"`, last
`beat: "outro"`, drawn from: `cold-open`, `setup`, `turn`, `evidence`,
`complication`, `verdict`, `outro`. Every section names its claim ids. A section
with no claims has nothing to say.

## Rules that actually hold attention

**Cold open on a specific thing, never a summary.** An image, an object, a
sentence somebody wrote at the time.

**Never explain before the viewer wants the explanation.** Context is owed only
after curiosity exists.

**Keep something open at all times.** Maintain a written question ledger: what
opens where, what pays off where. A stretch with nothing open is where people
leave.

**Pay small promises quickly.** One held question is tension; four are a
grievance.

**Escalate by consequence, not volume.** Each beat changes the situation.
Three anecdotes at the same intensity read as a list.

**Reveal after, not before.** Put the recontextualising fact after the section
it recontextualises.

**Uncertainty is a beat.** "Here is where historians stop agreeing" belongs in
the structure — usually at the turn — rather than leaking into every sentence.

## The clock is a constraint on density

At 143 words per minute (`pipeline/channel.mjs`), 14 minutes is ~2,000 words.
A structure needing six names and four dates in the first two minutes fails, and
it fails as "confusing".

## Diagnosing flat

Find the first 60-second window where no question is open. That is where it
died, and it is almost always a context section that arrived before anyone
wanted it.
