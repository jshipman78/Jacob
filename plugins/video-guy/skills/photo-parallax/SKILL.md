---
name: photo-parallax
description: Use when making historical photographs move convincingly — depth-based 2.5D parallax, foreground and background separation, camera pushes and orbits, rack focus simulation, grain and dust, and restoration or upscaling before animation. Triggers include "animate this photo", "Ken Burns", "parallax", "make the stills less static", and giving archival material production value.
version: 1.0.0
---

# Photo parallax

This is the highest-value visual technique available to a history channel: real
photographs, made to move, without inventing anything.

## Beyond Ken Burns

A plain pan-and-zoom on a flat image is recognisable and tiring. 2.5D parallax
separates the photograph into depth planes and moves them at different rates, so
the camera appears to move *through* the scene.

Pipeline:

1. **Restore first** — dust, scratches, tears, contrast. Animating a damaged
   scan magnifies the damage.
2. **Upscale to at least 2× the frame** so a push has headroom. Sharpen after
   upscaling, not before.
3. **Estimate depth** — a depth map, or hand-cut planes. Two or three planes are
   usually enough: subject, midground, background.
4. **Inpaint behind the cut edges.** The gaps revealed as planes separate are
   the whole illusion. Unfilled gaps produce the "cardboard cutout" look.
5. **Animate the camera**, not the layers, so perspective stays coherent.
6. **Grade and grain** the composite as one image so the planes belong together.

## Move restrainedly

| Move | Use |
| --- | --- |
| Slow push in | Default. Draws the viewer in. 2–4% over 6 seconds. |
| Slow pull out | Reveals context. Good on a section's last shot. |
| Lateral drift | Landscapes, group photographs, crowds. |
| Orbit | Only with genuine depth; strongest on objects and interiors. |
| Rack focus | Simulated with a depth-based blur ramp. Excellent for a reveal. |

Rules: one move per shot; movement under ~5% of frame per second; ease in and
out, never linear; move **toward** the subject the narration is discussing.

## Grain, dust and light

A small amount of animated film grain over the whole composite unifies the
planes and hides interpolation. Add sparingly: too much reads as a filter.
Slow-drifting dust motes in a light shaft sell depth cheaply. Never add grain
per-plane — it must sit on the final image.

## Never

- Fabricate detail inside the photograph's subject. Inpainting fills what the
  separation revealed at the edges, and nothing more.
- Animate a face's expression or a person's posture. That crosses from
  presentation into invention, and the asset stops being archival.
- Push so far the image softens. Stop before the resolution runs out.

## In this repo

Parallax is a scene treatment, not a post-process: implement it in the Remotion
scene layer under `src/scenes/`, driven by the storyboard's `animation` block, so
it is deterministic and re-renders identically. See
`docs/scene-layer-contract.md`.
