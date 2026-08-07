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
};

export type Timing = {
  fps: number;
  sampleRate: number;
  voice: string;
  durationSec: number;
  sentences: SentenceTiming[];
  sections: SectionTiming[];
  shots: ShotTiming[];
};
