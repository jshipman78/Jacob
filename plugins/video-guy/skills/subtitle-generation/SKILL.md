---
name: subtitle-generation
description: Use when producing captions and subtitles — deriving them from the existing word-level timeline rather than re-transcribing, formatting line lengths and durations, handling proper nouns and numbers, and emitting SRT and VTT sidecars or a burned-in render. Triggers include "add subtitles", "captions", "SRT", "VTT", "the captions are out of sync", and accessibility passes.
version: 1.0.0
---

# Subtitle generation

## Do not re-transcribe

`timing.json` already carries measured per-sentence starts and ends from the
actual synthesized audio. Running speech-to-text over the finished mix throws
that away and introduces errors into text that was already exact. Derive
captions from the timeline.

## Which text

Captions carry the script's `text` field, **never** `tts`.

```
text: "In 146 BC, Rome finally moved."      ← on screen
tts:  "In one forty-six BC, Rome finally moved."  ← in the audio
```

That distinction is exactly why the contract has two fields.

## Formatting

| | |
| --- | --- |
| Line length | 32–42 characters |
| Lines | 2 maximum |
| Minimum on screen | 1.2 s |
| Maximum on screen | 6 s — split longer sentences |
| Gap between cues | ≥ 2 frames, so they do not appear to merge |
| Reading rate | ≤ 20 characters per second |

Break on clause boundaries. Never break inside a name, a number, or between a
number and its unit. Keep an article with its noun.

## Splitting a long sentence

Split at the natural pause, and give each part its share of the sentence's
measured span proportional to its character count. Do not split at a fixed
character count — you will cut mid-phrase and it will read badly.

## Emit

Sidecars in `out/<slug>/`: `<slug>.srt` and `<slug>.vtt`. SRT indices from 1,
timestamps `HH:MM:SS,mmm`; VTT uses `.` for the decimal separator and needs a
`WEBVTT` header.

Burned-in captions are a **separate render**, never an edit of the master. Keep
the lower ~15% of frame clear of graphics if you burn them.

## Verify

- Cue count matches the sentence count (plus splits).
- First cue starts at the first word, last cue ends at `durationSec`.
- No overlaps, no negative durations.
- Spot-check three moments against the audio — beginning, middle, end.
- Proper nouns spelled as the research dossier spells them.
