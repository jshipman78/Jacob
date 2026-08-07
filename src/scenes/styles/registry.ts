import type { SceneAssignment } from '../registry';
import { sceneForShot } from '../registry';

import { ArchivalField } from './ArchivalField';
import { ArchivalTrench } from './ArchivalTrench';
import { ArchivalStrata } from './ArchivalStrata';
import { CinematicScene } from './CinematicScene';
import { GraphicScene } from './GraphicScene';

/**
 * Alternate visual directions, for the side-by-side comparison reels.
 *
 * IMPORTANT: these are NOT finished styles. Each one covers only the three
 * shots inside the chosen one-minute comparison window —
 *
 *   dig-crews   (atmospheric)
 *   dig-trench  (explanatory)
 *   dig-layers  (explanatory section)
 *
 * — which is enough to judge the direction and nothing like enough to carry a
 * fourteen-minute film. Any shot not listed here falls through to the finished
 * hand-drawn scenes, which is exactly what you want in a reel: it makes the
 * boundary of the sketch obvious rather than hiding it.
 */
export type StyleId = 'handdrawn' | 'archival' | 'cinematic' | 'graphic';

export const STYLE_LABELS: Record<StyleId, string> = {
  handdrawn: 'Hand-drawn period illustration',
  archival: 'Elevated archival',
  cinematic: 'Cinematic depth',
  graphic: 'Bold motion graphics',
};

const ARCHIVAL: Record<string, SceneAssignment> = {
  'dig-crews': { Component: ArchivalField, options: { mood: 'dust', intensity: 0.75 } },
  'dig-trench': { Component: ArchivalTrench },
  'dig-layers': { Component: ArchivalStrata },
};

const CINEMATIC: Record<string, SceneAssignment> = {
  'dig-crews': { Component: CinematicScene, options: { subject: 'field' } },
  'dig-trench': { Component: CinematicScene, options: { subject: 'trench' } },
  'dig-layers': { Component: CinematicScene, options: { subject: 'strata' } },
};

const GRAPHIC: Record<string, SceneAssignment> = {
  'dig-crews': { Component: GraphicScene, options: { subject: 'field' } },
  'dig-trench': { Component: GraphicScene, options: { subject: 'trench' } },
  'dig-layers': { Component: GraphicScene, options: { subject: 'strata' } },
};

const STYLES: Record<StyleId, Record<string, SceneAssignment>> = {
  handdrawn: {},
  archival: ARCHIVAL,
  cinematic: CINEMATIC,
  graphic: GRAPHIC,
};

export const sceneForShotInStyle = (
  imageId: string,
  style: StyleId | undefined
): SceneAssignment => {
  if (!style || style === 'handdrawn') return sceneForShot(imageId);
  return STYLES[style]?.[imageId] ?? sceneForShot(imageId);
};
