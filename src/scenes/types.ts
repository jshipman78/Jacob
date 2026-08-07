/**
 * Every background scene implements this interface. Scenes are full-frame
 * animated React components that illustrate what the narrator is actually
 * saying — the stratigraphy of Hisarlik, the gap between Troy II and the
 * Trojan War, who dug when — rather than decorating behind it.
 */
export type SceneProps = {
  /** 0 → 1 across this shot's own duration. Drive all animation from this. */
  progress: number;
  /** Frame index within the shot, 0-based. */
  frame: number;
  /** This shot's duration in frames. */
  durationInFrames: number;
  /** Composition frame rate. */
  fps: number;
  /**
   * Stable per-shot value in [0, 1), hashed from the shot id. Use it for
   * deterministic variation (drift direction, speckle placement) so a scene
   * reused in two places doesn't look copy-pasted.
   */
  seed: number;
  /** Scene-specific configuration, supplied by the shot registry. */
  options?: Record<string, unknown>;
};

/**
 * Layout budget every scene must respect, so subtitles and title cards stay
 * legible over it. Values are in composition pixels on the 1920x1080 canvas.
 */
export const SAFE_AREA = {
  /** Keep the bottom band visually calm and dark — subtitles sit here. */
  bottom: 260,
  /** Section title cards land across the vertical middle. */
  titleBandTop: 380,
  titleBandBottom: 700,
  /** General edge margin for any scene content that reads as information. */
  edge: 120,
} as const;

/** Shared palette, so the scenes read as one designed system. */
export const PALETTE = {
  ink: '#08060a',
  soil: '#150f0b',
  soilWarm: '#241812',
  bronze: '#8a6636',
  gold: '#d9b872',
  goldBright: '#f0d38f',
  ash: '#6d6257',
  bone: '#cfc3b0',
  ember: '#c4621f',
} as const;
