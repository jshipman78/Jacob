/** The manifest scripts/short-tts.mjs writes to public/short-timing.json. */

export type ShortWord = {
  word: string;
  start: number;
  end: number;
  emphasis: boolean;
};

export type ShortLine = {
  id: string;
  /** Which scene in src/short/scenes renders under this line. */
  scene: string;
  text: string;
  /** Measured start/end of the spoken line, in seconds. */
  start: number;
  end: number;
  /** The scene's own span — it opens a little early and holds through the
   *  pause after the line, so the cut never lands in silence. */
  sceneStart: number;
  sceneEnd: number;
  words: ShortWord[];
};

export type ShortTiming = {
  fps: number;
  sampleRate: number;
  voice: string;
  speed: number;
  durationSec: number;
  durationInFrames: number;
  lines: ShortLine[];
};
