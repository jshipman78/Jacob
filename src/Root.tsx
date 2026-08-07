import React from 'react';
import { Composition, staticFile } from 'remotion';
import { TroyVideo } from './TroyVideo';
import { StyleReel } from './StyleReel';
import type { StyleId } from './scenes/styles/registry';
import type { Timing } from './types';
import { WIDTH, HEIGHT } from './constants';

// An empty-but-well-typed timing manifest. Only used as the composition's
// `defaultProps` placeholder before `calculateMetadata` fetches and
// substitutes the real public/timing.json at bundle/render time — see
// below. Kept intentionally trivial (zero duration) so nothing renders
// before real data is loaded.
const EMPTY_TIMING: Timing = {
  fps: 30,
  sampleRate: 24000,
  voice: '',
  durationSec: 1,
  sentences: [],
  sections: [],
  shots: [],
};

// Swap this for TIMING_PATH = 'fixtures/timing.fixture.json'-style local
// testing is done instead via `--public-dir` on the CLI (see project notes
// in the task report) so this always points at the real production path.
const TIMING_STATIC_PATH = 'timing.json';

/**
 * The one-minute stretch of the real narration used for every style
 * comparison reel. Chosen so the same window exercises both an atmospheric
 * beat and an explanatory one:
 *
 *   f8600–9261  dig-crews   — the gang working the mound (atmospheric)
 *   f9261–10043 dig-trench  — the cut going down (explanatory)
 *   f10043–10400 dig-layers — the stratigraphic section (explanatory)
 *
 * Identical for all four reels, so the only variable is the treatment.
 */
const REEL_START_FRAME = 8600;
const REEL_DURATION_FRAMES = 1800; // 60s at 30fps

const STYLES: StyleId[] = ['handdrawn', 'archival', 'cinematic', 'graphic'];

export const RemotionRoot: React.FC = () => {
  return (
    <>
    <Composition
      id="TroyVideo"
      component={TroyVideo}
      width={WIDTH}
      height={HEIGHT}
      fps={30}
      durationInFrames={30}
      defaultProps={{ timing: EMPTY_TIMING }}
      calculateMetadata={async ({ props }) => {
        const response = await fetch(staticFile(TIMING_STATIC_PATH));
        if (!response.ok) {
          throw new Error(
            `Could not load ${TIMING_STATIC_PATH} (HTTP ${response.status}). ` +
              'Has the narration/timing pipeline run yet?'
          );
        }
        const timing = (await response.json()) as Timing;
        const fps = timing.fps ?? 30;
        const durationInFrames = Math.max(
          1,
          Math.ceil(timing.durationSec * fps)
        );

        return {
          fps,
          durationInFrames,
          props: { ...props, timing },
        };
      }}
    />

    {STYLES.map((style) => (
      <Composition
        key={style}
        id={`StyleReel-${style}`}
        component={StyleReel}
        width={WIDTH}
        height={HEIGHT}
        fps={30}
        durationInFrames={REEL_DURATION_FRAMES}
        defaultProps={{
          timing: EMPTY_TIMING,
          style,
          startFrame: REEL_START_FRAME,
          masterDurationInFrames: REEL_DURATION_FRAMES,
        }}
        calculateMetadata={async ({ props }) => {
          const response = await fetch(staticFile(TIMING_STATIC_PATH));
          if (!response.ok) {
            throw new Error(`Could not load ${TIMING_STATIC_PATH} (HTTP ${response.status}).`);
          }
          const timing = (await response.json()) as Timing;
          const fps = timing.fps ?? 30;
          return {
            fps,
            durationInFrames: REEL_DURATION_FRAMES,
            props: {
              ...props,
              timing,
              masterDurationInFrames: Math.max(1, Math.ceil(timing.durationSec * fps)),
            },
          };
        }}
      />
    ))}
    </>
  );
};
