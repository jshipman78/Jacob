# Scene-layer contract

**Audience:** whoever owns `src/scenes/`.
**Status:** met. `src/scenes/styles/registry.ts` exports `resolveScene`,
`AVAILABLE_STYLES`, `SCENE_COVERAGE` and `PORTABLE_KINDS`;
`src/components/ShotScenes.tsx` prefers `shot.scene`; `TroyVideo` threads
`timing.style` down to it. `probeSceneLayer()` reports `keying: 'scene-kind'`,
and style now reaches a generated topic. Two bounded gaps remain, both reported
by the CLI rather than discovered on screen — see [What is still
partial](#what-is-still-partial).

## How the two sides fit

**Style ids (cosmetic).** The scene layer's own union is `handdrawn` /
`graphic`; this pipeline uses `hand-drawn` / `motion-graphics`. Every style in
`pipeline/core/styles.mjs` carries a `sceneLayerId` and `aliases`, and
`canonicalStyle()` in the scene layer accepts either vocabulary, so both
spellings work in both directions. `AVAILABLE_STYLES` is declared in the
pipeline's spelling, which is what `probeSceneLayer()` reads.

**Scene keying (load-bearing — now handled).** There are two resolvers, and
which one runs is decided by the data, not by a flag:

```ts
const { Component, options } = shot.scene
  ? resolveScene(shot.scene, style)              // generated topics: by scene kind
  : sceneForShotInStyle(shot.imageId, style);    // the Troy film: by shot id, unchanged
```

A shot carrying `scene` came from the pipeline's visuals stage; one without came
from the hand-authored `scripts/script-data.mjs`. The Troy manifest has no
`scene` field and no `style` field, so that film renders exactly as it did
before — which is the property that made this change safe to make.

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

Four exports from `src/scenes/styles/registry.ts`. `probeSceneLayer()` reads
that file and `src/scenes/registry.ts` as text, so the three constants must stay
**literal arrays of string literals** — they are parsed without a TypeScript
build.

```ts
export type CanonicalStyleId = 'hand-drawn' | 'archival' | 'cinematic' | 'motion-graphics';

/** The styles this scene layer implements. Drives --style validation and
 *  --compare-styles. */
export const AVAILABLE_STYLES: CanonicalStyleId[] = [
  'hand-drawn', 'archival', 'cinematic', 'motion-graphics',
];

/** Which kinds each style treats natively, as flat "<style>:<kind>" pairs.
 *  Anything absent falls through to the base scene for that kind. */
export const SCENE_COVERAGE: string[] = ['archival:atmosphere', /* … */];

/** Kinds that can carry any topic. The rest draw content from the
 *  hand-authored film and are degraded when a request supplies its own. */
export const PORTABLE_KINDS: SceneKind[] = [
  'atmosphere', 'statement', 'ledger', 'artifact', 'cutaway',
];

/** Resolve a scene request to a component, in a given style. Never throws. */
export function resolveScene(
  request: { kind?: string; options?: Record<string, unknown> } | null | undefined,
  style: string | null | undefined
): SceneAssignment;
```

`request.kind` is typed loosely on purpose: it arrives from a JSON file written
by another workstream, so it is validated in `resolveScene` rather than trusted
by the type system. An unknown kind, a kind this style has no treatment for, and
a kind whose scene cannot carry this topic all land on the style's atmosphere
scene — a missing picture at frame 4,000 is a far worse failure than a plainer
one.

`sceneForShotInStyle(shotId, style)` is unchanged and still serves the
hand-authored Troy video.

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

`ShotScenes` takes `style?: string` and `TroyVideo` passes `timing.style` into
it. Both accept either style vocabulary.

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

## What is still partial

Resolving by scene kind is what makes a style reach a generated topic at all.
It does not by itself make every style cover every beat, and the two remaining
gaps are declared in the scene layer so the CLI can state them rather than let
a viewer find them at frame 9,000.

**1. Style coverage — `SCENE_COVERAGE`.** A style lists only the kinds it
genuinely treats; the rest fall through to the base hand-drawn scene for that
kind. Today `hand-drawn` covers all nine and `archival`, `cinematic` and
`motion-graphics` cover three each (`atmosphere`, `cutaway`, `strata`), because
those three styles were built as one-minute comparison sketches. `--list-styles`
prints this as `partial · 3/9 scene kinds` rather than `implemented`, and
`--compare-styles` warns that two reels will look alike wherever the sample
window sits on an uncovered kind.

Closing this gap means adding scene components, not touching the pipeline.

**2. Topic portability — `PORTABLE_KINDS`.** Four scenes draw their content from
the hand-authored film rather than from their options: `AegeanMap` has the
Aegean in it, `StrataColumn` has Hisarlik's phases, `ExcavatorRelay` has
Calvert/Schliemann/Dörpfeld/Blegen, and `DeepTimeline` has Troy's axis. Putting
any of them under a film about somewhere else is a factual error on screen that
no amount of narration accuracy repairs.

So `resolveScene` uses them only when the request carries no content of its own
— the Troy path, where the hand-placed options are correct — and degrades to the
style's atmosphere scene when the request supplies the topic data they would
have to ignore:

```ts
const TOPIC_LOCKED = { map: ['places'], timeline: ['span', 'marks'], strata: ['layers'], relay: ['actors'] };
```

A plainer picture is the right trade against a wrong one. Each entry disappears
the moment its scene reads that option — `stages/visuals.mjs` already fills them
correctly, so that is a scene-layer change with no pipeline change and no
re-run behind it.

Nothing in either gap requires the pipeline to change when the scene layer
catches up. Re-running is `--refresh=visuals` at worst, and usually nothing.
