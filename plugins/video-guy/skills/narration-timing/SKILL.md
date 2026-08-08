---
name: narration-timing
description: Use when the film's clock matters — converting a runtime target into a word budget, estimating spoken duration before synthesis, reading the measured timeline, and re-timing a storyboard against real narration. Triggers include "how long will this be", "word count for 12 minutes", "the video is too long", "scene timings", and any work that must lock to narration.
version: 1.0.0
---

# Narration timing

**The narration is the master clock.** Shot durations, storyboard timings,
caption timings, music cues and the render's frame count are all derived from
it. Nothing downstream is real until narration exists.

## Before synthesis: estimate

`WORDS_PER_MINUTE = 143` in `pipeline/channel.mjs`, measured from a finished
film — 1,984 script words rendering to 831.8 seconds including every pause. Use
it for budgets, never for final timings.

| Target | Words |
| --- | --- |
| 6 min | ~860 |
| 10 min | ~1,430 |
| 14 min | ~2,000 |
| 20 min | ~2,860 |

Estimation caveats: dense proper nouns and numbers read slower; pauses are a
real fraction of runtime (`PAUSE` values on paragraphs:
`sentence|paragraph|effect|beat|section`); an estimate within ±8% is as good as
this gets.

## After synthesis: measure

```bash
npm run make-video -- "<topic>" --slug=<slug> --only=narrate --voice=Voice1
```

`pipeline/work/<slug>/rt/public/timing.json` carries **measured** per-sentence
starts and ends from the actual audio, plus sections, shots and total
`durationSec`. The visuals stage adds `shots[]` with `scene`, plus `style`,
`topic` and `title` (`docs/CONTRACT.md` §5).

The moment this file exists, every estimated timing in the storyboard is
replaced by a derived one. Mark storyboards built before narration
`"timingSource": "estimated"` so it is obvious which ones still need re-deriving.

## Deriving shot timings

```
shot.start    = timing.sentences[firstSentenceOfShot].start
shot.end      = timing.sentences[lastSentenceOfShot].end
shot.duration = end - start
```

Sub-shots inside a paragraph subdivide that span. Two invariants, asserted
arithmetically: the spans are contiguous with no gaps, and they sum to
`durationSec`.

## Frames

```
frames = round(durationSec * fps)     # fps from timing.json, normally 30
```

A render short by exactly one section's length means the frame count was
computed from the wrong timeline — check `timing.json`, not the encoder.

## When runtime misses target

Off by more than 10% is a script problem. Send it to the writer to cut or
extend. Do not change the voice speed, do not trim pauses, do not stretch shots
to fill — all three are audible.
