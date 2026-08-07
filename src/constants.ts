// Central place for the composition's timing/style constants, so nothing is
// scattered as magic numbers inside components.

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

// ---------------------------------------------------------------------------
// Opening / closing fades
// ---------------------------------------------------------------------------
export const OPEN_FADE_SEC = 1.0;
export const CLOSE_FADE_SEC = 1.5;

// ---------------------------------------------------------------------------
// Image shots — Ken Burns + cross-fade
// ---------------------------------------------------------------------------
export const SHOT_CROSSFADE_SEC = 0.8;

// Zoom rate is derived from each shot's own duration (rate-per-second),
// then clamped so very short shots don't whip and very long shots don't
// stall or over-reveal past the source image's edges.
export const KEN_BURNS_RATE_PER_SEC = 0.0035; // fraction of scale gained per second
export const KEN_BURNS_MIN_ZOOM = 0.025; // minimum total zoom over a shot (2.5%)
export const KEN_BURNS_MAX_ZOOM = 0.12; // maximum total zoom over a shot (12%)

// How far the image is allowed to pan, expressed as a multiple of the shot's
// own zoom amount. Kept well under the geometrically-safe bound (derived in
// ImageShots.tsx) so the frame edge is never revealed.
export const KEN_BURNS_PAN_RATIO = 18;
// Vertical pan is damped relative to horizontal for a more restrained move.
export const KEN_BURNS_VERTICAL_DAMPING = 0.6;

// ---------------------------------------------------------------------------
// Grade / vignette
// ---------------------------------------------------------------------------
export const VIGNETTE_EDGE_OPACITY = 0.38;
export const GRADE_WARMTH_OPACITY = 0.06;
export const GRADE_DARKEN_OPACITY = 0.10;

// ---------------------------------------------------------------------------
// Subtitles
// ---------------------------------------------------------------------------
export const SUBTITLE_MIN_WORDS_PER_CHUNK = 8;
export const SUBTITLE_TARGET_WORDS_PER_CHUNK = 11;
export const SUBTITLE_MAX_WORDS_PER_CHUNK = 14;

export const SUBTITLE_FADE_SEC = 5 / FPS; // ~5 frames, per spec (4-6 frames)
export const SUBTITLE_HOLD_AFTER_SEC = 0.55; // hold last chunk before fading during silence
export const SUBTITLE_FONT_SIZE = 50;
export const SUBTITLE_LINE_HEIGHT = 1.3;
export const SUBTITLE_BOTTOM_OFFSET = 120;
export const SUBTITLE_MAX_WIDTH = 1500;

// ---------------------------------------------------------------------------
// Section title cards
// ---------------------------------------------------------------------------
export const TITLE_CARD_FADE_IN_SEC = 0.9;
export const TITLE_CARD_HOLD_SEC = 1.6;
export const TITLE_CARD_FADE_OUT_SEC = 1.1;
// Total on-screen time for a normal section title card.
export const TITLE_CARD_DURATION_SEC =
  TITLE_CARD_FADE_IN_SEC + TITLE_CARD_HOLD_SEC + TITLE_CARD_FADE_OUT_SEC;

// The first section is the film's main title — bigger, held longer.
export const MAIN_TITLE_FADE_IN_SEC = 1.4;
export const MAIN_TITLE_HOLD_SEC = 2.6;
export const MAIN_TITLE_FADE_OUT_SEC = 1.4;
export const MAIN_TITLE_DURATION_SEC =
  MAIN_TITLE_FADE_IN_SEC + MAIN_TITLE_HOLD_SEC + MAIN_TITLE_FADE_OUT_SEC;

export const GOLD = '#d9b872';
export const GOLD_BRIGHT = '#f0d38f';
