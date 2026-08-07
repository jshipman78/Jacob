# Scene-layer contract

**Audience:** whoever owns `src/scenes/`.
**Status:** partially met. The scene layer has since shipped a style system of
its own (`src/scenes/styles/registry.ts`) with four styles and
`sceneForShotInStyle(imageId, style)`. The pipeline detects it, accepts both
vocabularies, and degrades explicitly — see [Where the two sides
differ](#where-the-two-sides-differ) and [Degraded mode](#degraded-mode-what-happens-today).

## Where the two sides differ

Two gaps, one cosmetic and one load-bearing.

**Style ids (cosmetic — already handled).** The scene layer uses `handdrawn`
and `graphic`; this pipeline uses `hand-drawn` and `motion-graphics`. Every
style in `pipeline/core/styles.mjs` carries a `sceneLayerId` and `aliases`, so
`--style=handdrawn` and `--style=hand-drawn` both work and `probeSceneLayer()`
translates the scene layer's union type into canonical ids. Nothing needs to
change on either side; worth converging eventually, purely for readability.

**Scene keying (load-bearing — not yet handled).** `sceneForShotInStyle` is
keyed by *shot id*, and its style variants are keyed to the hand-authored Troy
shot ids (`dig-crews`, `dig-trench`, `dig-layers`). A generated topic has its
own shot ids — `fall-of-carthage-harbour`, not `dig-trench` — so **every shot
falls through to the default scene and `--style` has no visible effect on a
generated film.** The pipeline reports this at the top of every run rather than
producing four identical clips and calling them a comparison.

The fix is the `resolveScene(request, style)` interface below. The pipeline
already writes `scene: { kind, options }` onto every shot in `timing.json`, so
nothing upstream has to change or re-run — the moment `ShotScenes` prefers
`shot.scene`, style starts reaching generated topics.

The pipeline (`pipeline/`) and the scene layer (`src/scenes/`) are owned by
different workstreams, so this file is the whole of the agreement between them.
Nothing else in `pipeline/` reaches into `src/`, and nothing in `src/` needs to
know a pipeline exists.

## The split

| | decides | owner |
| --- | --- | --- |
| **What kind of visual this shot needs** — a map, a timeline, a claim ledger, a typographic beat | follows from the narration | pipeline (`stages/visuals.mjs`) |
| **What that kind looks like in a given style** | design | scene layer (`src/scenes/`) |

That split is the reason a fifth visual style is a matter of adding scenes and
registering them, rather than editing a pipeline stage. The pipeline never
names a component; the scene layer never reads a script.

## What the pipeline emits

Two additive fields on `public/timing.json`. Everything already in that file
keeps its current shape and meaning — `scripts/tts.mjs` still owns it.

```jsonc
{
  "style": "archival",              // ADDED — the run's visual style id
  "requestedStyle": "hand-drawn",   // ADDED — what was asked for, if it differed
  "topic": "the fall of Carthage",  // ADDED
  "title": "THE CITY ROME COULD NOT FORGIVE",
  "shots": [
    {
      "imageId": "hook-harbour",     // unchanged
      "start": 0, "end": 21.4,       // unchanged
      "scene": {                     // ADDED
        "kind": "timeline",
        "options": { "span": [-264, -146], "marks": [{ "year": -218, "label": "Hannibal crosses" }] }
      }
    }
  ]
}
```

`style` rides inside `timing.json` deliberately: the composition already loads
that file through `calculateMetadata`, so visual direction reaches the renderer
with **no new props and no changes to `Root.tsx` or the render command**.

## What the pipeline needs back

Three exports from `src/scenes/registry.ts`:

```ts
export type StyleId = 'archival' | 'hand-drawn' | 'cinematic' | 'motion-graphics';

/** The styles this scene layer actually implements. The CLI reads this to
 *  validate --style, to drive --compare-styles, and to warn instead of
 *  silently rendering the wrong look. Must be a literal array of string
 *  literals — it is read statically, without a TypeScript build. */
export const AVAILABLE_STYLES: StyleId[] = ['archival', 'hand-drawn'];

/** Resolve a scene request to a component, in a given style. */
export function resolveScene(
  request: { kind: SceneKind; options?: Record<string, unknown> },
  style: StyleId
): SceneAssignment;

/** Unchanged, still used by the hand-authored Troy video. */
export function sceneForShot(shotId: string, style?: StyleId): SceneAssignment;
```

`resolveScene` must never throw: an unknown kind, or a kind with no treatment in
this style, falls back to the style's atmosphere scene. A missing picture is a
worse failure at frame 4,000 than at frame 0.

This can wrap what already exists rather than replacing it — `resolveScene` maps
a scene kind to whichever component that style uses for it, and
`sceneForShotInStyle` stays exactly as it is for the Troy shots:

```ts
export function resolveScene(request, style) {
  const table = SCENE_BY_KIND[style] ?? SCENE_BY_KIND.handdrawn;
  const Component = table[request.kind] ?? table.atmosphere;
  return { Component, options: request.options };
}
```

And one change in `src/components/ShotScenes.tsx`:

```ts
const assignment = shot.scene
  ? resolveScene(shot.scene, timing.style)                    // generated topics
  : sceneForShotInStyle(shot.imageId, timing.style);          // Troy path, unchanged
```

`ShotScenes` currently receives `shots` and `fps` but not `style`; it needs
`timing.style` threaded down from `TroyVideo.tsx`, or the whole `timing` object.

## The scene vocabulary

Nine kinds, generalized from the existing Troy scene set so they carry any
topic. The mapping to what exists today is exact, which is why `archival` is
already implementable — it is a rename plus a lookup, not new artwork.

| kind | purpose | today's Troy scene |
| --- | --- | --- |
| `atmosphere` | mood and place under narrative passages | `ExcavationField` |
| `statement` | the line a section turns on, set in type | `StatementCard` |
| `map` | where this happened, relative to somewhere known | `AegeanMap` |
| `timeline` | when, relative to something else — especially the gap | `DeepTimeline` |
| `strata` | layered or nested evidence, in order | `StrataColumn` |
| `ledger` | what was claimed against what the record shows | `ClaimLedger` |
| `artifact` | one object or document, as a captioned plate | `ArtifactPlate` |
| `relay` | a succession of named people, and who did what | `ExcavatorRelay` |
| `cutaway` | a cross-section reveal | `GreatTrench` |

The authoritative option shapes live in `SCENE_KINDS` in
`pipeline/core/styles.mjs` and are reproduced in `docs/CONTRACT.md` §4. They are
the current Troy scenes' own option shapes, made topic-neutral: `AegeanMap`'s
`focus`/`showLabels` become `map`'s, `DeepTimeline`'s `emphasizeGap` becomes
`timeline`'s, `ClaimLedger`'s `rows` become `ledger`'s.

Two things the pipeline supplies that the current scenes do not yet accept, and
which matter for any topic other than Troy:

- `map.places` — the current `AegeanMap` has the Aegean drawn into it. A general
  map scene needs to take its place names (and ideally coordinates) as options.
- `strata.layers` and `relay.actors` — currently hard-coded to Hisarlik's phases
  and to Calvert/Schliemann/Dörpfeld/Blegen.

Until those accept data, a non-Troy film renders those kinds with Troy's
content. `stages/visuals.mjs` fills the options correctly regardless, so the
scenes can start reading them whenever they are ready — no pipeline change.

## Degraded mode (what happens today)

`probeSceneLayer()` in `pipeline/core/styles.mjs` reads `registry.ts` statically
and looks for `AVAILABLE_STYLES` and `resolveScene`. Neither exists yet, so:

- The scene layer reports mode `legacy`, styles `['archival']`.
- `--style=hand-drawn` is **accepted**, not rejected: the script, the shot plan
  and the art direction are all built for hand-drawn, and only the on-screen
  look falls back. The CLI says so explicitly, once, at the top of the run:

  > The scene layer does not implement the "hand-drawn" treatment yet (it
  > exposes: archival). The script, narration and shot plan are still built for
  > "hand-drawn" — only the on-screen look falls back to "archival". Re-render
  > with `--style=hand-drawn` once `src/scenes/` registers it; nothing upstream
  > needs to re-run.

- `--compare-styles` renders only the implemented styles and marks the rest
  "pending" in the contact sheet, rather than producing four identical clips
  under four different names.
- Shot ids are topic-specific (`fall-of-carthage`, not `hook-trench`), so
  `SCENE_BY_SHOT` misses and every shot lands on `DEFAULT_SCENE`. The film
  renders; it is visually monotonous. This resolves the moment `ShotScenes`
  prefers `shot.scene`.

Nothing above requires the pipeline to change when the scene layer catches up.
Re-running is `--refresh=visuals` at worst, and usually nothing at all.
