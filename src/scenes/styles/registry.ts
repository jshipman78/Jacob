import type { SceneAssignment } from '../registry';
import { sceneForShot } from '../registry';

import { ArchivalField } from './ArchivalField';
import { ArchivalTrench } from './ArchivalTrench';
import { ArchivalStrata } from './ArchivalStrata';
import { CinematicScene } from './CinematicScene';
import { GraphicScene } from './GraphicScene';

import { ExcavationField } from '../ExcavationField';
import { StatementCard } from '../StatementCard';
import { AegeanMap } from '../AegeanMap';
import { DeepTimeline } from '../DeepTimeline';
import { StrataColumn } from '../StrataColumn';
import { ClaimLedger } from '../ClaimLedger';
import { ArtifactPlate } from '../ArtifactPlate';
import { ExcavatorRelay } from '../ExcavatorRelay';
import { GreatTrench } from '../GreatTrench';

/**
 * Two ways to resolve a shot to a scene, for two different films.
 *
 *   sceneForShotInStyle(shotId, style)  — the hand-authored Troy video. Every
 *     shot is placed by hand in `SCENE_BY_SHOT`; the style tables below swap in
 *     an alternate treatment for the three shots inside the comparison window.
 *
 *   resolveScene({ kind, options }, style)  — any generated film. The pipeline
 *     decides what *kind* of visual the narration needs and writes it onto each
 *     shot in timing.json; this side decides what that kind looks like in the
 *     chosen style. Neither side has to know the other's catalogue, which is
 *     what makes a fifth style a matter of registering scenes rather than
 *     editing a pipeline stage.
 *
 * See docs/scene-layer-contract.md.
 */

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

/** The scene layer's own spelling, kept for the hand-authored reels. */
export type StyleId = 'handdrawn' | 'archival' | 'cinematic' | 'graphic';

/** The pipeline's spelling. Both are accepted everywhere in this module. */
export type CanonicalStyleId = 'hand-drawn' | 'archival' | 'cinematic' | 'motion-graphics';

/**
 * The styles this scene layer implements. Read *statically* by
 * `probeSceneLayer()` in pipeline/core/styles.mjs, without a TypeScript build —
 * so it must stay a literal array of string literals.
 */
export const AVAILABLE_STYLES: CanonicalStyleId[] = [
  'hand-drawn',
  'archival',
  'cinematic',
  'motion-graphics',
];

export const STYLE_LABELS: Record<StyleId, string> = {
  handdrawn: 'Hand-drawn period illustration',
  archival: 'Elevated archival',
  cinematic: 'Cinematic depth',
  graphic: 'Bold motion graphics',
};

const TO_CANONICAL: Record<string, CanonicalStyleId> = {
  handdrawn: 'hand-drawn',
  'hand-drawn': 'hand-drawn',
  archival: 'archival',
  cinematic: 'cinematic',
  graphic: 'motion-graphics',
  graphics: 'motion-graphics',
  'motion-graphics': 'motion-graphics',
};

const TO_LEGACY: Record<CanonicalStyleId, StyleId> = {
  'hand-drawn': 'handdrawn',
  archival: 'archival',
  cinematic: 'cinematic',
  'motion-graphics': 'graphic',
};

/** Accepts either vocabulary; unknown or missing resolves to the base style. */
export const canonicalStyle = (style: string | undefined | null): CanonicalStyleId =>
  TO_CANONICAL[String(style ?? '').toLowerCase()] ?? 'hand-drawn';

// ---------------------------------------------------------------------------
// The scene vocabulary
// ---------------------------------------------------------------------------

export type SceneKind =
  | 'atmosphere'
  | 'statement'
  | 'map'
  | 'timeline'
  | 'strata'
  | 'ledger'
  | 'artifact'
  | 'relay'
  | 'cutaway';

/**
 * A scene request as it arrives from timing.json. `kind` is typed loosely on
 * purpose — it comes out of a JSON file written by another workstream, so it is
 * validated here rather than trusted by the type system.
 */
export type SceneRequest = { kind?: string; options?: Record<string, unknown> };

const SCENE_KINDS: SceneKind[] = [
  'atmosphere', 'statement', 'map', 'timeline', 'strata',
  'ledger', 'artifact', 'relay', 'cutaway',
];

const isSceneKind = (k: unknown): k is SceneKind =>
  typeof k === 'string' && (SCENE_KINDS as string[]).includes(k);

/**
 * The base treatment for every kind — the finished hand-drawn scenes, which is
 * also what any style falls through to for a kind it has no treatment of yet.
 */
const BASE: Record<SceneKind, SceneAssignment> = {
  atmosphere: { Component: ExcavationField, options: { mood: 'dusk' } },
  statement: { Component: StatementCard },
  map: { Component: AegeanMap, options: { focus: 'region', showLabels: true } },
  timeline: { Component: DeepTimeline },
  strata: { Component: StrataColumn },
  ledger: { Component: ClaimLedger },
  artifact: { Component: ArtifactPlate },
  relay: { Component: ExcavatorRelay },
  cutaway: { Component: GreatTrench },
};

/**
 * Per-style overrides. A style lists only the kinds it genuinely treats
 * differently; everything else falls through to BASE, which makes the boundary
 * of an unfinished style obvious on screen rather than hiding it behind four
 * identical-looking renders.
 */
const OVERRIDES: Record<CanonicalStyleId, Partial<Record<SceneKind, SceneAssignment>>> = {
  'hand-drawn': {},

  archival: {
    atmosphere: { Component: ArchivalField, options: { mood: 'dust', intensity: 0.75 } },
    cutaway: { Component: ArchivalTrench },
    strata: { Component: ArchivalStrata },
  },

  cinematic: {
    atmosphere: { Component: CinematicScene, options: { subject: 'field' } },
    cutaway: { Component: CinematicScene, options: { subject: 'trench' } },
    strata: { Component: CinematicScene, options: { subject: 'strata' } },
  },

  'motion-graphics': {
    atmosphere: { Component: GraphicScene, options: { subject: 'field' } },
    cutaway: { Component: GraphicScene, options: { subject: 'trench' } },
    strata: { Component: GraphicScene, options: { subject: 'strata' } },
  },
};

/**
 * Native style treatments, as flat `"<style>:<kind>"` pairs. Read statically by
 * the pipeline so `--list-styles` can report honest coverage, so it must stay a
 * literal array of string literals. Anything absent falls through to the
 * hand-drawn scene for that kind.
 */
export const SCENE_COVERAGE: string[] = [
  'hand-drawn:atmosphere', 'hand-drawn:statement', 'hand-drawn:map', 'hand-drawn:timeline',
  'hand-drawn:strata', 'hand-drawn:ledger', 'hand-drawn:artifact', 'hand-drawn:relay', 'hand-drawn:cutaway',
  'archival:atmosphere', 'archival:cutaway', 'archival:strata',
  'cinematic:atmosphere', 'cinematic:cutaway', 'cinematic:strata',
  'motion-graphics:atmosphere', 'motion-graphics:cutaway', 'motion-graphics:strata',
];

// ---------------------------------------------------------------------------
// Topic portability
// ---------------------------------------------------------------------------

/**
 * Four scenes draw content from the hand-authored Troy film rather than from
 * their options: `AegeanMap` has the Aegean in it, `StrataColumn` has
 * Hisarlik's phases, `ExcavatorRelay` has Calvert/Schliemann/Dörpfeld/Blegen,
 * and `DeepTimeline` has Troy's axis. Putting any of them under a film about
 * something else is a factual error on screen, and no amount of narration
 * accuracy repairs it.
 *
 * So: those kinds are used when the request carries no content of its own — the
 * Troy path, where the hand-placed options are correct — and are degraded to
 * the style's atmosphere treatment when the request supplies the topic data
 * they would have to ignore. The listed option keys are what the pipeline fills
 * for a generated topic (see SCENE_KINDS in pipeline/core/styles.mjs).
 *
 * Each entry disappears from this table the moment its scene reads that option.
 */
const TOPIC_LOCKED: Partial<Record<SceneKind, string[]>> = {
  map: ['places'],
  timeline: ['span', 'marks'],
  strata: ['layers'],
  relay: ['actors'],
};

/**
 * Scene kinds this layer can render for any topic. Flat literal array — read
 * statically by the pipeline, same as SCENE_COVERAGE.
 */
export const PORTABLE_KINDS: SceneKind[] = [
  'atmosphere', 'statement', 'ledger', 'artifact', 'cutaway',
];

const hasContent = (v: unknown): boolean =>
  Array.isArray(v) ? v.length > 0 : v != null && v !== '';

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a scene request to a component, in a given style.
 *
 * Never throws. An unknown kind, a kind this style has no treatment for, and a
 * kind whose scene cannot yet carry this topic all land on the style's
 * atmosphere scene — a missing picture at frame 4,000 is a far worse failure
 * than a plainer one.
 */
export function resolveScene(
  request: SceneRequest | undefined | null,
  style: string | undefined | null
): SceneAssignment {
  const styleId = canonicalStyle(style);
  const kind: SceneKind = isSceneKind(request?.kind) ? request.kind : 'atmosphere';
  const options = request?.options ?? {};

  const lockedOn = TOPIC_LOCKED[kind];
  const carriesOwnContent = lockedOn?.some((key) => hasContent(options[key])) ?? false;

  if (carriesOwnContent) {
    // The request has real content for a scene that would ignore it and draw
    // Troy instead. Drop to atmosphere, and drop the options with it — they
    // describe a different kind of picture.
    return OVERRIDES[styleId].atmosphere ?? BASE.atmosphere;
  }

  const assignment = OVERRIDES[styleId][kind] ?? BASE[kind];
  return {
    Component: assignment.Component,
    options: { ...assignment.options, ...options },
  };
}

/**
 * The hand-authored Troy path: resolve by shot id, unchanged.
 *
 * Any shot a style does not override falls through to the finished hand-drawn
 * scene, which is exactly what a comparison reel wants — it makes the boundary
 * of the sketch obvious rather than hiding it.
 */
export const sceneForShotInStyle = (
  imageId: string,
  style: string | undefined
): SceneAssignment => {
  const styleId = canonicalStyle(style);
  if (styleId === 'hand-drawn') return sceneForShot(imageId);
  return SHOT_OVERRIDES[TO_LEGACY[styleId]]?.[imageId] ?? sceneForShot(imageId);
};

/**
 * Shot-level style variants for the comparison reels. These cover only the
 * three shots inside the chosen one-minute window —
 *
 *   dig-crews   (atmospheric)
 *   dig-trench  (explanatory)
 *   dig-layers  (explanatory section)
 *
 * — which is enough to judge a direction and nothing like enough to carry a
 * fourteen-minute film.
 */
const SHOT_OVERRIDES: Record<StyleId, Record<string, SceneAssignment>> = {
  handdrawn: {},
  archival: {
    'dig-crews': { Component: ArchivalField, options: { mood: 'dust', intensity: 0.75 } },
    'dig-trench': { Component: ArchivalTrench },
    'dig-layers': { Component: ArchivalStrata },
  },
  cinematic: {
    'dig-crews': { Component: CinematicScene, options: { subject: 'field' } },
    'dig-trench': { Component: CinematicScene, options: { subject: 'trench' } },
    'dig-layers': { Component: CinematicScene, options: { subject: 'strata' } },
  },
  graphic: {
    'dig-crews': { Component: GraphicScene, options: { subject: 'field' } },
    'dig-trench': { Component: GraphicScene, options: { subject: 'trench' } },
    'dig-layers': { Component: GraphicScene, options: { subject: 'strata' } },
  },
};
