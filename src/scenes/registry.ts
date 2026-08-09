import type React from 'react';
import type { SceneProps } from './types';

import { StrataColumn } from './StrataColumn';
import { GreatTrench } from './GreatTrench';
import { DeepTimeline } from './DeepTimeline';
import { AegeanMap } from './AegeanMap';
import { ExcavatorRelay } from './ExcavatorRelay';
import { ClaimLedger } from './ClaimLedger';
import { ExcavationField } from './ExcavationField';
import { StatementCard } from './StatementCard';
import { ArtifactPlate } from './ArtifactPlate';
import { LampInterior } from './LampInterior';

export type SceneAssignment = {
  Component: React.FC<SceneProps>;
  options?: Record<string, unknown>;
};

/**
 * Which background carries which shot.
 *
 * The explanatory scenes (stratigraphy, the trench, the deep-time axis, the
 * map, the relay of excavators, the claim ledger) are placed where the
 * narration is making a factual argument the viewer benefits from *seeing*.
 * The atmospheric and typographic scenes carry the narrative and rhetorical
 * passages, where a diagram would be literal-minded and wrong.
 *
 * Keys are the shot ids in scripts/script-data.mjs and public/timing.json.
 */
export const SCENE_BY_SHOT: Record<string, SceneAssignment> = {
  // --- Hook ---------------------------------------------------------------
  'hook-trench': { Component: GreatTrench },
  'hook-credit': {
    Component: ArtifactPlate,
    options: { artifact: 'hoard', label: '“PRIAM’S TREASURE” · RECOVERED 1873' },
  },
  'hook-portrait': {
    Component: StatementCard,
    options: {
      variant: 'quiet',
      kicker: 'HEINRICH SCHLIEMANN · 1822–1890',
      lines: ['Not an archaeologist.', 'Not a historian.'],
    },
  },
  'hook-question': {
    Component: StatementCard,
    options: { variant: 'question', lines: ['How much of it', 'did he make up?'] },
  },
  'hook-title': { Component: ExcavationField, options: { mood: 'fire', intensity: 0.8 } },

  // --- The obsession ------------------------------------------------------
  // A wide landscape was the wrong picture for a boy reading Homer by one
  // candle; this beat is an interior, so it gets the nocturne plate.
  'obsession-book': { Component: LampInterior, options: { subject: 'book', intensity: 0.75 } },
  // `correction` and the Schliemann headings are true of this film and only
  // this film — the component defaults to a neutral two-account contrast now,
  // so the register that strikes a claim out has to be asked for.
  'obsession-letters': { Component: ClaimLedger, options: { mode: 'correction' } },
  'obsession-merchant': { Component: ExcavationField, options: { mood: 'dusk' } },
  'obsession-homer': {
    Component: StatementCard,
    options: {
      variant: 'quiet',
      kicker: 'THE SCHOLARLY CONSENSUS, c. 1868',
      lines: ['A setting.', 'Not a location.'],
    },
  },

  // --- The dig ------------------------------------------------------------
  'dig-dardanelles': { Component: AegeanMap, options: { focus: 'region', showLabels: true } },
  'dig-calvert': { Component: ExcavatorRelay, options: { highlight: 'calvert' } },
  'dig-partnership': { Component: ExcavatorRelay, options: { highlight: 'schliemann' } },
  'dig-crews': { Component: ExcavationField, options: { mood: 'dust', intensity: 0.75 } },
  'dig-trench': { Component: GreatTrench },
  'dig-layers': { Component: StrataColumn },

  // --- The treasure and the lie -------------------------------------------
  'treasure-gold': {
    Component: ArtifactPlate,
    options: {
      artifact: 'diadem',
      label: 'GOLD DIADEM · TROY II',
      // Provenance is per-shot now, because it is a factual claim. Schliemann
      // really did publish plates of this gold; he did not publish the finds
      // other films put this scene to.
      sub: 'From the plates published by H. Schliemann',
    },
  },
  'treasure-shawl': { Component: LampInterior, options: { subject: 'bundle', intensity: 0.85 } },
  'treasure-sophia': {
    Component: ClaimLedger,
    options: {
      mode: 'correction',
      rows: [
        { claimed: 'Sophia excavated it at his side', record: 'She was in Greece that day' },
        { claimed: 'Carried out hidden in her shawl', record: 'Written in afterward' },
      ],
    },
  },
  'treasure-smuggle': { Component: LampInterior, options: { subject: 'crates', intensity: 0.6 } },
  // The scene the whole section turns on: Troy II predates the war by over a
  // thousand years, so the gold cannot have been Priam's.
  'treasure-date': {
    Component: DeepTimeline,
    options: { emphasizeGap: [-2500, -1200] },
  },

  // --- Wrong and right ----------------------------------------------------
  'right-ruins': { Component: AegeanMap, options: { focus: 'site', showLabels: true } },
  'right-destroyed': {
    Component: StrataColumn,
    options: { mode: 'destroyed', highlight: 'VIIa' },
  },
  'right-dorpfeld': { Component: ExcavatorRelay, options: { highlight: 'dorpfeld' } },
  'right-blegen': { Component: ExcavatorRelay, options: { highlight: 'blegen' } },
  'right-question': {
    Component: StatementCard,
    options: {
      variant: 'question',
      lines: ['Brilliant amateur,', 'or reckless treasure hunter?'],
    },
  },

  // --- Legacy -------------------------------------------------------------
  'legacy-modern': { Component: StrataColumn, options: { mode: 'intact' } },
  'legacy-tangled': { Component: ExcavationField, options: { mood: 'gold' } },

  // --- Outro --------------------------------------------------------------
  'outro-theme': {
    Component: StatementCard,
    options: { variant: 'verdict', lines: ['Every legend', 'has a layer of truth.'] },
  },
  'outro-troy': { Component: ExcavationField, options: { mood: 'dusk', intensity: 0.45 } },
};

/** Fallback for any shot id not explicitly assigned above. */
export const DEFAULT_SCENE: SceneAssignment = {
  Component: ExcavationField,
  options: { mood: 'dusk' },
};

export const sceneForShot = (imageId: string): SceneAssignment =>
  SCENE_BY_SHOT[imageId] ?? DEFAULT_SCENE;
