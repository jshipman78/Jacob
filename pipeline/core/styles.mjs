// Visual direction: the style registry, the scene vocabulary, and the
// capability probe against the scene layer.
//
// Style is a *parameter* of this pipeline, never a fork in it. A run carries
// one style id from the CLI all the way to the renderer, and the scene layer
// under src/scenes/ is what turns (scene kind, style) into an actual React
// component. This module owns the vocabulary on both sides of that boundary;
// see docs/scene-layer-contract.md for the interface the scene layer must
// expose, and docs/architecture.md for how it is transported.
//
// Adding a fifth style means adding an entry here and registering scenes for
// it in src/scenes/. It should never mean editing a stage.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './paths.mjs';
import { PipelineError } from './log.mjs';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

/**
 * `artDirection` is the shared suffix appended to every image prompt in a run
 * (the generalization of scripts/script-data.mjs's STYLE_SUFFIX). It is what
 * makes thirty separate generations read as one film rather than thirty
 * unrelated pictures, so it is fixed once per run and never varied per shot.
 *
 * `sceneBias` nudges the visual-assignment stage: which scene kinds this style
 * carries well, and which fall flat in it. A motion-graphics film leans on
 * typography; a cinematic one leans on atmosphere and depth.
 */
export const STYLES = {
  archival: {
    id: 'archival',
    sceneLayerId: 'archival',
    aliases: [],
    label: 'Archival',
    summary:
      'Engraved information design: strata columns, deep-time axes, claim ledgers and survey maps ' +
      'drawn as if plated into a 19th-century monograph. Explanatory first, atmospheric second.',
    artDirection:
      'Engraved archival plate, 19th century scientific monograph illustration, fine hatching and stipple, ' +
      'warm gold and bone on deep ink ground, precise draughtsmanship, aged paper grain, restrained and authoritative',
    sceneBias: { strata: 2, timeline: 2, ledger: 2, map: 2, artifact: 1.5, statement: 1, relay: 1.5, cutaway: 1.5, atmosphere: 0.6 },
    pacing: { shotSecondsMin: 8, shotSecondsTarget: 22 },
  },
  'hand-drawn': {
    id: 'hand-drawn',
    sceneLayerId: 'handdrawn',
    aliases: ['handdrawn'],
    label: 'Hand-drawn',
    summary:
      'Period illustration: inked linework and washed colour, the look of a plate torn from a ' +
      'contemporary account. Warmer and more human than archival; drawings of people and places, not diagrams.',
    artDirection:
      'Hand-drawn period illustration, pen and ink linework with loose watercolour wash, visible paper tooth, ' +
      'muted ochre umber and slate palette, expressive imperfect line, the feel of a contemporary eyewitness plate',
    sceneBias: { artifact: 2, relay: 2, atmosphere: 1.8, map: 1.5, cutaway: 1.5, strata: 1, statement: 1, ledger: 0.8, timeline: 0.8 },
    pacing: { shotSecondsMin: 7, shotSecondsTarget: 18 },
  },
  cinematic: {
    id: 'cinematic',
    sceneLayerId: 'cinematic',
    aliases: [],
    label: 'Cinematic',
    summary:
      'Layered parallax and volumetric depth: dust in shafts of light, foreground silhouettes drifting ' +
      'against far horizons. Carries mood and scale; weakest when the narration needs a diagram.',
    artDirection:
      'Cinematic layered composition, volumetric light shafts through haze and dust, deep parallax planes, ' +
      'shallow focus falloff, chiaroscuro of warm amber against cold shadow, epic scale, filmic grain',
    sceneBias: { atmosphere: 2.5, cutaway: 2, map: 1.2, artifact: 1.2, relay: 1, statement: 1, strata: 0.8, timeline: 0.8, ledger: 0.6 },
    pacing: { shotSecondsMin: 9, shotSecondsTarget: 26 },
  },
  'motion-graphics': {
    id: 'motion-graphics',
    sceneLayerId: 'graphic',
    aliases: ['graphic', 'graphics'],
    label: 'Motion graphics',
    summary:
      'Kinetic typography led: the argument is set in type and moves with the voice. Numbers, dates and ' +
      'contradictions land as text on screen. Fast, modern, and unforgiving of a woolly script.',
    artDirection:
      'Kinetic typographic motion graphics, bold editorial type on flat fields, hard geometric transitions, ' +
      'restrained two-colour accent palette on near-black, precise alignment and generous negative space',
    sceneBias: { statement: 3, ledger: 2.5, timeline: 2, strata: 1.2, map: 1.2, relay: 1.2, artifact: 0.8, cutaway: 0.6, atmosphere: 0.4 },
    pacing: { shotSecondsMin: 5, shotSecondsTarget: 14 },
  },
};

export const STYLE_IDS = Object.freeze(Object.keys(STYLES));

/**
 * The scene layer's own complete treatment is its hand-drawn one — the finished
 * Troy scenes — so that is what a run defaults to. The other three exist there
 * as comparison sketches covering a handful of shots; see `probeSceneLayer`.
 */
export const DEFAULT_STYLE = 'hand-drawn';

/** Maps every accepted spelling, including the scene layer's, to a canonical id. */
const ALIAS_TO_ID = new Map(
  Object.values(STYLES).flatMap((s) => [
    [s.id, s.id],
    [s.sceneLayerId, s.id],
    ...s.aliases.map((a) => [a, s.id]),
  ])
);

/** Canonicalises a style id written in either vocabulary. */
export const canonicalStyleId = (id) => ALIAS_TO_ID.get(String(id ?? '').toLowerCase()) ?? null;

/** Resolves a style id, or fails with the list of valid ones. */
export function resolveStyle(id = DEFAULT_STYLE) {
  const style = STYLES[canonicalStyleId(id) ?? id];
  if (!style) {
    throw new PipelineError(
      `Unknown visual style "${id}".`,
      `Valid styles are:\n${STYLE_IDS.map((s) => `  ${s.padEnd(16)} ${STYLES[s].summary.split('.')[0]}.`).join('\n')}\n\n` +
        `Pick one with --style=<id>, or run --compare-styles to render a short sample of each and choose by eye.`
    );
  }
  return style;
}

// ---------------------------------------------------------------------------
// Scene vocabulary
// ---------------------------------------------------------------------------

/**
 * The topic-neutral vocabulary the pipeline emits, generalized from the Troy
 * scene set. A shot says what *kind* of visual its narration needs — a
 * content decision, made by the pipeline, from the script. The scene layer
 * decides what that kind *looks like* in a given style — a design decision,
 * made in src/scenes/. Neither side needs to know the other's catalogue.
 */
export const SCENE_KINDS = {
  atmosphere: {
    purpose: 'Mood and place under narrative or rhetorical passages, where a diagram would be literal-minded.',
    options: { mood: 'string — e.g. dusk, night, fire, dust, candle, gold, cold', intensity: 'number 0–1' },
  },
  statement: {
    purpose: 'A typographic beat: the line the section turns on, set on screen. Use sparingly and never over a list of facts.',
    options: {
      variant: "'quiet' | 'question' | 'verdict'",
      kicker: 'string — small caps label above, e.g. a name and dates',
      lines: 'string[] — two or three short lines, no full sentences',
    },
  },
  map: {
    purpose: 'Where this happened, and its relation to somewhere the viewer already knows.',
    options: { focus: "'region' | 'site'", showLabels: 'boolean', places: '{name,label?}[] — ordered, most important first' },
  },
  timeline: {
    purpose: 'When this happened relative to something else — especially when the gap itself is the point.',
    options: {
      span: '[startYear, endYear] — negative for BCE',
      marks: '{year:number,label:string}[]',
      emphasizeGap: '[fromYear, toYear] — the interval the narration is arguing about',
    },
  },
  strata: {
    purpose: 'Layered or nested evidence: phases, periods, editions, versions stacked in order.',
    options: { layers: '{id,label,note?}[] — deepest/oldest first', highlight: 'string — layer id', mode: "'intact' | 'destroyed'" },
  },
  ledger: {
    purpose: 'What was claimed set against what the record shows. The workhorse of an accuracy-first channel.',
    options: { rows: '{claimed:string, record:string}[] — two to four rows, short phrases' },
  },
  artifact: {
    purpose: 'A single object, document or find, presented as a plate with a caption.',
    options: { artifact: 'string — short subject key, e.g. hoard, diadem, tablet, coin', label: 'string — caption in caps' },
  },
  relay: {
    purpose: 'A succession of named people over time, and who actually did what.',
    options: { actors: '{id,name,years?,note?}[] — in chronological order', highlight: 'string — actor id' },
  },
  cutaway: {
    purpose: 'A cross-section reveal: cutting into something to show what is inside or beneath it.',
    options: { depth: 'number 0–1', labels: 'string[] — top to bottom' },
  },
};

export const SCENE_KIND_IDS = Object.freeze(Object.keys(SCENE_KINDS));

export const FALLBACK_SCENE = Object.freeze({ kind: 'atmosphere', options: { mood: 'dusk' } });

export function validateScene(scene, where = 'shot') {
  const problems = [];
  if (!scene || typeof scene !== 'object') return [`${where}: missing scene object.`];
  if (!SCENE_KIND_IDS.includes(scene.kind)) {
    problems.push(`${where}: scene.kind "${scene.kind}" is not one of ${SCENE_KIND_IDS.join(', ')}.`);
  }
  if (scene.options != null && typeof scene.options !== 'object') {
    problems.push(`${where}: scene.options must be an object when present.`);
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Scene-layer capability probe
// ---------------------------------------------------------------------------

const REGISTRY_PATH = path.join(ROOT, 'src', 'scenes', 'registry.ts');
const STYLE_REGISTRY_PATH = path.join(ROOT, 'src', 'scenes', 'styles', 'registry.ts');

/**
 * Reads src/scenes/registry.ts and reports what the scene layer can currently
 * do. src/ belongs to the animation team and evolves independently, so the
 * pipeline never assumes: it probes, then degrades with an explicit message
 * rather than rendering a wrong-looking film or crashing at frame 0.
 *
 * Detected statically (no TypeScript build required):
 *   - `AVAILABLE_STYLES` — the styles the scene layer actually implements.
 *   - `resolveScene`     — style-aware (scene kind, style) resolution.
 *   - `sceneForShot`     — the legacy shot-id lookup, always present.
 *
 * @returns {{mode:'styled'|'legacy', styles:string[], hasResolveScene:boolean, registryPresent:boolean}}
 */
export function probeSceneLayer() {
  const base = { styles: [DEFAULT_STYLE], mode: 'legacy', keying: 'none', registryPresent: existsSync(REGISTRY_PATH) };
  if (!base.registryPresent) return base;

  const main = readFileSync(REGISTRY_PATH, 'utf8');
  const styleSrc = existsSync(STYLE_REGISTRY_PATH) ? readFileSync(STYLE_REGISTRY_PATH, 'utf8') : '';
  const src = `${main}\n${styleSrc}`;

  // The interface this pipeline asked for: (scene kind, style) -> component.
  const hasResolveScene = /export\s+(?:const|function)\s+resolveScene\b/.test(src);
  // The interface the scene layer actually shipped: (shot id, style) -> component.
  const hasShotInStyle = /export\s+(?:const|function)\s+sceneForShotInStyle\b/.test(src);

  // Styles, from either an AVAILABLE_STYLES array or a StyleId union type.
  let declared = null;
  const arr = /export\s+const\s+AVAILABLE_STYLES\s*(?::[^=]+)?=\s*(\[[^\]]*\])/s.exec(src);
  if (arr) declared = [...arr[1].matchAll(/['"]([a-z0-9-]+)['"]/gi)].map((m) => m[1]);
  if (!declared?.length) {
    const union = /export\s+type\s+StyleId\s*=\s*([^;]+);/s.exec(src);
    if (union) declared = [...union[1].matchAll(/['"]([a-z0-9-]+)['"]/gi)].map((m) => m[1]);
  }
  if (!declared?.length) return { ...base, hasResolveScene, hasShotInStyle };

  // Translate the scene layer's vocabulary into this pipeline's canonical ids,
  // keeping anything it exposes that we have no name for.
  const styles = [...new Set(declared.map((d) => canonicalStyleId(d) ?? d))];

  return {
    ...base,
    styles,
    sceneLayerStyles: declared,
    hasResolveScene,
    hasShotInStyle,
    keying: hasResolveScene ? 'scene-kind' : hasShotInStyle ? 'shot-id' : 'none',
    mode: hasResolveScene ? 'styled' : hasShotInStyle ? 'shot-keyed' : 'legacy',
  };
}

/**
 * Decides what actually gets rendered for a requested style, and what to tell
 * the user about it. Never throws for an unimplemented-but-valid style — a
 * missing treatment degrades to the default look with a clear warning, because
 * a finished film in the wrong style beats no film at all.
 */
export function planStyle(requestedId) {
  const style = resolveStyle(requestedId);
  const layer = probeSceneLayer();
  const supported = layer.styles.includes(style.id);
  const fallback = layer.styles.includes(DEFAULT_STYLE) ? DEFAULT_STYLE : layer.styles[0] ?? DEFAULT_STYLE;

  const notes = [];
  if (!supported) {
    notes.push(
      `The scene layer does not expose the "${style.id}" treatment (it exposes: ${layer.styles.join(', ')}). ` +
        `The script, narration, shot plan and art direction are still built for "${style.id}" — only the ` +
        `on-screen look falls back to "${fallback}". Re-render with --style=${style.id} once src/scenes/ ` +
        'registers it; nothing upstream needs to re-run.'
    );
  }
  if (layer.keying === 'shot-id') {
    notes.push(
      'The scene layer resolves scenes by *shot id* (sceneForShotInStyle) rather than by scene kind, and its ' +
        'style variants are keyed to the hand-authored Troy shot ids. A generated topic has its own shot ids, ' +
        'so every shot will fall through to the default scene and the film will render in one look regardless ' +
        `of --style. The per-shot scene kinds this pipeline computed are still written into timing.json, so ` +
        'this resolves the moment src/scenes/ reads shot.scene — see docs/scene-layer-contract.md.'
    );
  } else if (layer.keying === 'none') {
    notes.push(
      'The scene layer exposes no style-aware resolver yet, so every shot renders in its single existing look.'
    );
  }

  return {
    style,
    layer,
    supported,
    effectiveStyleId: supported ? style.id : fallback,
    /** What the renderer will actually honour, given how the scene layer keys scenes. */
    styleReachesRender: supported && layer.keying === 'scene-kind',
    message: notes.length ? notes.join('\n  ') : null,
  };
}
