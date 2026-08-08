---
name: animated-maps
description: Use when building map graphics for a documentary — geography that answers a question, route and movement animation, period-correct borders and place names, scale and orientation cues, and the timeline's map scene kind. Triggers include "animate a map", "show where this happened", "the map is confusing", "battle movements", and any shot with visualType MAP_ANIMATED.
version: 1.0.0
---

# Animated maps

Maps are the workhorse of history video. They are also where most channels waste
eight seconds at a time.

## Every map answers a question

Before building one, write the question down: *How far was it? Which way did
they go? Why does that hill matter? How close is this to somewhere I know?*
A map that says "here is Australia" answers nothing.

## Orient before you inform

The viewer needs to know where they are within two seconds:

- Start from something recognisable — a coastline, a country, a familiar city —
  then move in. Never open on an unlabelled close crop.
- Keep north up unless the story requires otherwise, and say so if it does.
- Hold one **scale cue** on screen: a bar, a familiar distance, or a comparison.
- Change one thing at a time: zoom, *then* reveal, *then* animate movement.

## Period correctness

Use the borders, place names and coastlines of the period. A 1932 story on
modern borders is a factual error a lot of viewers will catch. If the modern
name is needed for orientation, show both — period name primary, modern in
parentheses — rather than silently modernising.

Coastlines and rivers move. Harbours silt up. Check before drawing.

## Movement

- Draw routes progressively, in the direction of travel, at a readable speed.
- One arrow per force or party, consistently coloured for the whole film.
- Dashed for uncertain or disputed routes — and say so in the narration.
- Never animate faster than the narration describing it.

## Legibility

- Label only what the narration mentions. Every other name is noise.
- Labels stay upright and stationary while the map moves under them.
- Keep type outside the outer 5% of frame, and clear of the caption zone.
- Contrast: land, water and route must be distinguishable in greyscale and to a
  colour-blind viewer.

## In this repo

`map` is a scene kind in `pipeline/core/styles.mjs`, with options `focus`
(`'region' | 'site'`), `showLabels`, and an ordered `places` array. Build map
scenes in `src/scenes/` per `docs/scene-layer-contract.md`, styled for the run's
style id — an engraved survey map for `archival`, flat vector for
`motion-graphics`. The composition reads `timing.style`; the scene resolves
itself.

Prefer a deterministic vector map with real coordinates over a generated image
of a map. Generated maps have invented coastlines and unreadable labels.
