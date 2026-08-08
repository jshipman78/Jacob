---
name: visual-storytelling
description: Use when deciding what the viewer sees at each moment of a documentary — designing shot sequences rather than one image per paragraph, choosing scene treatments, controlling visual variety and rhythm, and fixing cuts that look like slideshows. Triggers include "what should be on screen here", "this looks like a slideshow", "b-roll ideas", "visual plan", and running the pipeline's visuals stage.
version: 1.0.0
---

# Visual storytelling

The question, asked continuously: *what should the viewer be looking at right
now?* The answer is almost never "a picture of the thing being said".

## Scene kinds

`pipeline/core/styles.mjs` defines the vocabulary the renderer understands:
`atmosphere`, `statement`, `map`, `timeline`, `strata`, `ledger`, `artifact`,
`relay`, `cutaway`. Each style weights them differently via `sceneBias` — a
motion-graphics film leans on typography, a cinematic one on depth and mood.

```bash
npm run make-video -- "<topic>" --slug=<slug> --only=visuals --style=<style>
```

That is a good first pass, not a director. Read the assignment and fix the
literal-minded ones.

## Sequences, not slides

One paragraph is not one image. A 15-second paragraph is a sequence:

> *The soldiers quickly discovered that emus were surprisingly difficult targets.*
>
> | | |
> |---|---|
> | 0:00–0:03 | Animated map, campaign area drawn on |
> | 0:03–0:06 | 1932 press photograph, slow parallax push |
> | 0:06–0:09 | Close crop of the Lewis gun, rack focus onto the sight |
> | 0:09–0:12 | Crosshair overlay tracking running emu silhouettes |
> | 0:12–0:15 | Newspaper headline flies in and holds |

## Rhythm

- 3–8 seconds per shot under active narration.
- 10–20 seconds only when the image earns it or the narration has stopped.
- Never two long holds in a row.
- Cut on the word that changes the picture, not on the sentence boundary.
- Plot the shot-length histogram. A flat line is a slideshow; a spiky mess is a
  music video; you want deliberate variation tied to the beats.

## Variety

- No asset twice within 90 seconds; no asset more than three times in a film.
- Vary framing between adjacent shots — wide, then detail, then a graphic.
- Vary treatment: photograph, map, typography, document, motion, diagram.
- Vary movement direction; three pushes in a row read as one long push.

## Match the treatment to the epistemics

This is the rule most systems get wrong. **Certainty in pictures overrides
hedging in words.** A disputed claim illustrated with a photorealistic
recreation, shown like evidence, tells the viewer it is established no matter
what the narrator says. For disputed material: diagram it, show the conflicting
sources, or show the document rather than the scene.

## Reserve typography

`statement` scenes are the film's exclamation marks. More than one every two
minutes and they stop meaning anything.

## Every map answers a question

A distance, a route, a relationship the viewer does not have. A map that says
"here is the country" is eight wasted seconds.
