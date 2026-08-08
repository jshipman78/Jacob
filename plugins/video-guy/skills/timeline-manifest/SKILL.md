---
name: timeline-manifest
description: Use when working with the timeline that drives rendering — reading and enriching timing.json, keeping narration, shots, style and captions in one contiguous structure, and validating it before a render. Triggers include "timeline.json", "timing manifest", "the render is out of sync", "scene durations", and any change to what the composition reads.
version: 1.0.0
---

# Timeline manifest

One file drives the render. `pipeline/work/<slug>/rt/public/timing.json`.

## Shape

`scripts/tts.mjs` writes its schema unchanged; the visuals stage adds fields
**additively** so existing consumers keep working (`docs/CONTRACT.md` §5):

```jsonc
{
  "fps": 30, "sampleRate": 24000, "voice": "Voice1", "voiceModel": "am_michael",
  "durationSec": 831.8,
  "sentences": [ { "text": "...", "start": 0, "end": 4.2 } ],
  "sections":  [ { "id": "hook", "title": "...", "start": 0, "end": 62.1 } ],
  "shots":     [ { "imageId": "hook-harbour", "start": 0, "end": 21.4,
                   "scene": { "kind": "atmosphere", "options": {} } } ],  // ADDED
  "style": "archival",                                                    // ADDED
  "topic": "the fall of Carthage",                                        // ADDED
  "title": "THE CITY ROME COULD NOT FORGIVE"                              // ADDED
}
```

## Why style travels in the data

The composition takes no new props — it reads `timing.style` and resolves scenes
through `src/scenes/`. That is what lets one composition render four visual
styles, and it is why a style change never means editing a stage. See
`docs/scene-layer-contract.md`.

## Additive only

New consumers must tolerate missing fields; new fields must not change the
meaning of existing ones. Renaming a field breaks `scripts/tts.mjs`, the
composition, the citations stage and the caption generator at once. If a shape
genuinely needs to change, say so — `docs/CONTRACT.md` is normative and shared,
and another workstream is coding against it right now.

## Validate before rendering

```js
const t = JSON.parse(readFileSync(overlayTiming(slug), 'utf8'));
assert(t.fps > 0 && t.durationSec > 0);
assert(t.sentences.length && t.sections.length && t.shots.length);
// contiguity
t.shots.reduce((prev, s) => { assert(Math.abs(s.start - prev) < 1/t.fps); return s.end; }, 0);
assert(Math.abs(t.shots.at(-1).end - t.durationSec) < 0.5);
// every shot resolvable
t.shots.forEach((s) => assert(SCENE_KIND_IDS.includes(s.scene.kind)));
```

A render that comes out short by exactly one section's length is a timeline
problem, not an encoder problem — the frame count was computed from the wrong
duration.

## Rendering from it

```
frames = round(durationSec * fps)
```

The render stage points Remotion at the overlay's public directory, so the
timeline, audio and images a run reads are always its own. Never hand-edit
`timing.json` to fix a visual problem — fix the stage that produced it and
re-run, or the next run silently reverts you.
