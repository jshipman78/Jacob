---
name: remotion-video
description: Use when working with the Remotion composition layer in this repo — building or editing scene components, resolving scenes by style, previewing in studio, rendering stills and previews, and diagnosing render failures. Triggers include "remotion", "the composition", "add a scene component", "render a still", "studio", and any change under src/.
version: 1.0.0
---

# Remotion in this repo

## The contract

The pipeline **invokes** Remotion; it does not wrap it. The composition, its
components and the scene layer belong to `src/` and are consumed as they are.
The only thing the render stage controls is which public directory Remotion
reads — which is what lets a generated topic render from its own overlay
(`pipeline/work/<slug>/rt/public/`) while the repository's hand-authored build
stays exactly where it is.

Visual direction arrives as **data, not props**: the composition reads
`timing.style` and resolves scenes through `src/scenes/`. Read
`docs/scene-layer-contract.md` before touching anything there.

## Commands

```bash
npm run dev                                              # studio
npx remotion compositions src/index.ts                   # list ids
npx remotion still src/index.ts <Id> out/check.png --frame=<n>
npx remotion render src/index.ts <Id> out/x.mp4 --frames=0-899   # preview span
npm run make-video -- "<topic>" --slug=<slug> --only=render --preview=30
```

Always preview before a full render. A 14-minute render that dies at frame
21,000 on a missing asset costs an hour; the preview costs a minute.

## Scene components

A scene component receives `(sceneOptions, styleId, shot, timing)` and renders
one shot. Rules that keep renders reproducible:

- **Deterministic.** No `Math.random()`, no `Date.now()`, no network. Seed any
  randomness from the shot id — `src/scenes/engraving/rand.ts` is the pattern.
- **Frame-driven.** All animation from `useCurrentFrame()`, never from wall
  clock or state.
- **Self-contained timing.** A scene knows its own duration from its props; it
  never reads global time to decide what to show.
- **Resolve by scene kind**, not by shot id. A scene layer keyed to one film's
  shot ids cannot render a generated topic — `probeSceneLayer()` reports which
  mode the layer is in, and `--list-styles` will tell you.

## Failure modes

| Symptom | Cause |
| --- | --- |
| Black frames | asset path wrong, or the public dir Remotion read is not the overlay |
| Renders but wrong length | frame count from the wrong `durationSec` |
| Fonts wrong | font not loaded in the composition; check `@fontsource` imports |
| Slow render | too much per-frame work; precompute outside the frame loop |
| Works in studio, fails in render | studio serves a different public dir; pass it explicitly |
| Every style looks identical | scene layer resolves by shot id, not scene kind |

## Performance

Concurrency defaults to the machine's cores; cap it with `--concurrency` when
memory-bound. Large images cost more per frame than complex vector drawing —
downscale assets to the frame size before rendering rather than letting every
frame resample a 6000-pixel scan.
