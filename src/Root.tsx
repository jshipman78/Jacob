import React from 'react';
import { Composition, staticFile } from 'remotion';
import { TroyVideo } from './TroyVideo';
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

export const RemotionRoot: React.FC = () => {
  return (
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
  );
};
