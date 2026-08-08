---
name: historical-image-prompting
description: Use when writing prompts for AI-generated historical imagery — period accuracy, inherited art direction, composition for the animation that will be applied, character and object consistency, and avoiding the tells that make generated history look fake. Triggers include "generate an image of", "write an image prompt", "the AI art looks wrong", "period accuracy", and filling shots the archive could not.
version: 1.0.0
---

# Historical image prompting

## Art direction is inherited, never invented

Each style in `pipeline/core/styles.mjs` carries an `artDirection` string that
is appended verbatim to every prompt in the film:

```
<subject prompt>, <the run's artDirection, unchanged>
```

That suffix is why thirty generations read as one film. Never edit it, never
blend styles, never "improve" it for one shot. Re-rolling changes the subject
prompt only.

## Prompt for the composition the animation needs

The storyboard says how the shot moves. Prompt for the structure that requires:

| Animation | Prompt needs |
| --- | --- |
| `PARALLAX_PUSH` | distinct foreground, midground, far plane; depth cues |
| `PARALLAX_ORBIT` | volumetric subject with space around it |
| `RACK_FOCUS` | two clear depth planes, something to focus onto |
| `KEN_BURNS` | detail that rewards a crop; generous framing |
| `STATIC_HOLD` | a single strong composition; nothing that needs to move |

## Period accuracy is research, not vibes

Before prompting, know: clothing, buildings, technology, vehicles, vegetation,
weather, and what the light was like. The dossier has this. A 1932 rifle drawn
wrong is the same class of error as a wrong date, and the viewers who care about
history are exactly the ones who notice.

Name the era concretely — "1932, Western Australia wheat belt, late spring" —
not "old-timey".

## The tells to avoid

- **Faces of real people.** Usually wrong, ethically poor, uncanny. Compose
  around them: from behind, in silhouette, hands, their desk, their handwriting.
- **Legible text.** Generated signage and headlines come out as gibberish and
  read as fake instantly. Real scans come from the archivist; typography comes
  from motion graphics.
- **Film-poster energy.** The failure mode of AI history is looking spectacular.
  Restraint is what lets it sit next to real photographs.
- **Impossible cleanliness.** Real places are worn, cluttered and asymmetrical.
- **Modern faces, modern teeth, modern posture.**

## Consistency

Write recurring subjects as a reference block once and reuse the exact wording
every time — build, clothing, colouring, age, distinguishing detail — kept in
`assets/generated/references.md`. Same for buildings and objects. Drift between
shots of "the same" thing is a tell that the video was assembled rather than
made.

Fix a seed strategy and record the seed so runs are reproducible.

## Review before accepting

Art direction match, period errors, anatomy and structure (hands, limbs, animal
legs, roof lines, wheels), any legible-looking text, and repetition of
composition across shots. Off-style output is a failed deliverable, not a
variation. Re-roll or report the gap; do not ship the fourth-best attempt.

Everything generated is recorded `authenticity: "recreation"` or `"synthetic"`.
Never `authentic`.
