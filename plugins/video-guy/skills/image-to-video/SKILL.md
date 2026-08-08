---
name: image-to-video
description: Use when adding AI-generated motion to a documentary — animating a still, generating short clips, choosing which shots deserve motion at all, and keeping cost and visual drift under control. Triggers include "animate this image", "generate video for", "add motion to that shot", "image to video", and deciding where generated motion is worth its cost.
version: 1.0.0
---

# Image to video

## Use it rarely, on purpose

Generated video is expensive, drifts, and rarely survives close viewing. Most
motion in a good documentary should come from parallax on real photographs and
from motion graphics — both cheap, deterministic, and consistent.

Worth generating:

- Weather, smoke, dust, water, fire — motion the viewer expects and cannot get
  from a still.
- Crowds and traffic at a distance.
- Slow environmental drift under an atmospheric passage.
- A single establishing shot per film, if it earns it.

Not worth generating:

- Anything with a face doing something.
- Anything with legible text.
- Anything where a still with a parallax push would read the same.
- Anything a viewer will study.

## Animate a still you already like

Prefer image-to-video over text-to-video. You keep the composition and the art
direction, and only the motion is uncertain — one variable instead of three. The
still can come from the archivist (with the same authenticity caveats) or from
generation.

## Prompt the motion, not the scene

The image already establishes the scene. Describe only what moves, how fast,
and where the camera goes:

> Slow drift of dust through the shafts of light; the silhouetted figures remain
> still; camera pushes forward almost imperceptibly.

- One motion idea per clip. Two fight each other.
- Slow beats fast. Documentary motion is nearly still.
- Say what must **not** move — that is often the most useful instruction.

## Length and cutting

- 2–5 seconds. Generate a little longer than needed and cut before the drift.
- Watch for: subjects morphing, hands and limbs reorganising, background
  geometry sliding, the frame slowly zooming when it should not.
- Cut away on motion rather than on a hold; drift is least visible mid-movement.

## Cost control

Paid generation needs the user's approval for this production, obtained through
the producer, with model, unit cost, count and total stated. Approval for one
batch is not approval for re-rolls. Log every spend:

```bash
node plugins/video-guy/scripts/production.mjs cost <id> generated 4.50 "5 clips @ $0.90"
```

## Record it

`kind: "generated-video"`, `authenticity: "recreation"` or `"synthetic"`, with
the model, the full prompt, the source still, and the seed.
