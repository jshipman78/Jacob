---
name: storyboard-generation
description: Use when producing the machine-readable shot list that drives assembly — one entry per shot with timing, visual type, asset id, animation, overlay and transition. Triggers include "build the storyboard", "shot list", "what assets do we need", "storyboard.json", and converting a visual plan into something the editor and asset agents can execute against.
version: 1.0.0
---

# Storyboard generation

The storyboard is the core data structure of the production. Everything
downstream reads it: the archivist knows what to source, the artist knows what
to generate, the editor knows what to assemble, QC knows what should have been
on screen.

`productions/<id>/storyboard/storyboard.json`

## Entry shape

```json
{
  "sceneId": "SC018",
  "shotId": "war-lewis-gun",
  "start": 287.2,
  "duration": 6.8,
  "narration": "The soldiers quickly discovered that emus were surprisingly difficult targets.",
  "visualType": "ARCHIVAL_PHOTO",
  "assetId": "loc-emu-soldiers-1932",
  "authenticity": "authentic",
  "animation": { "type": "PARALLAX_PUSH", "direction": "LEFT_TO_RIGHT", "intensity": 0.35 },
  "overlay": { "kind": "LOWER_THIRD", "text": "Western Australia — 1932" },
  "transition": { "type": "FILM_BURN", "duration": 0.5 },
  "claimIds": ["C12"],
  "notes": ""
}
```

## Enumerations

`visualType`: `ARCHIVAL_PHOTO` `ARCHIVAL_FILM` `NEWSPAPER` `DOCUMENT`
`MAP_ANIMATED` `TIMELINE` `DATA_VIZ` `TYPOGRAPHY` `GENERATED_STILL`
`GENERATED_MOTION` `DIAGRAM` `TITLE_CARD`

`animation.type`: `KEN_BURNS` `PARALLAX_PUSH` `PARALLAX_ORBIT` `RACK_FOCUS`
`STATIC_HOLD` `MAP_REVEAL` `TYPE_ON` `CROSSFADE_STACK`

`overlay.kind`: `LOWER_THIRD` `DATE_STAMP` `LOCATION` `QUOTE` `CITATION`
`STAT` `NONE`

`transition.type`: `CUT` `DISSOLVE` `FILM_BURN` `WHIP` `MATCH_CUT` `FADE_BLACK`

`authenticity`: `authentic` `recreation` `synthetic` `diagram` — carried from
the asset, never assigned independently.

## Timing

Derive from `timing.json`, never estimate once it exists. Before narration,
estimate from word counts and set `"timingSource": "estimated"` at the top of
the file so it is obvious the timings are provisional.

## Invariants to assert, not eyeball

1. Entries sorted by `start`, contiguous: `entry[i].start + duration ==
   entry[i+1].start` within a frame.
2. The last entry ends at `timing.durationSec`.
3. Every entry has an `assetId`, and every `assetId` either exists in the
   manifest or is assigned to a maker.
4. No `assetId` repeats within 90 seconds.
5. `claimIds` on any entry making a factual visual assertion.

Write the check as a script and run it; four of the five are arithmetic and a
human reading the file will miss them.

## Splitting the work

Group entries by `visualType` and hand out:

- `ARCHIVAL_*`, `NEWSPAPER`, `DOCUMENT` → archivist
- `GENERATED_*` → AI visual artist
- `MAP_ANIMATED`, `TIMELINE`, `DATA_VIZ`, `TYPOGRAPHY`, `TITLE_CARD` → motion
  graphics, built as Remotion scenes

Each list is keyed by `assetId` so nothing is sourced twice or missed.
