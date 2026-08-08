// Shared shape of the timing manifest produced by the narration/TTS pipeline
// (scripts/tts.mjs et al.) and consumed by the Remotion composition at
// render time via public/timing.json.
//
// All time fields are in SECONDS (floats), absolute from the start of the
// narration audio.

export type SentenceTiming = {
  index: number;
  sectionId: string;
  paragraphIndex: number;
  imageId: string;
  text: string;
  start: number;
  end: number;
};

export type SectionTiming = {
  id: string;
  title: string;
  start: number;
  end: number;
};

export type ShotTiming = {
  imageId: string;
  start: number;
  end: number;
  /**
   * What kind of visual this shot needs, written by the pipeline's visuals
   * stage. Absent on the hand-authored Troy manifest, whose shots are placed by
   * id in src/scenes/registry.ts — which is exactly how the renderer tells the
   * two films apart. See docs/scene-layer-contract.md.
   */
  scene?: { kind?: string; options?: Record<string, unknown> };
};

export type Timing = {
  fps: number;
  sampleRate: number;
  voice: string;
  durationSec: number;
  sentences: SentenceTiming[];
  sections: SectionTiming[];
  shots: ShotTiming[];
  /**
   * The run's visual style. Rides inside timing.json deliberately: the
   * composition already loads this file through `calculateMetadata`, so visual
   * direction reaches the renderer with no new props and no change to the
   * render command. Absent on the hand-authored manifest.
   */
  style?: string;
  /** What was asked for, when the scene layer could not honour it. */
  requestedStyle?: string;
  topic?: string;
  title?: string;
};
