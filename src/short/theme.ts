// The short's own frame and palette.
//
// The film is 1920x1080 and paced in minutes; the short is 1080x1920 and paced
// in beats. Rather than bend src/constants.ts (which the film's scenes read as
// their canvas size) the short carries its own geometry, and borrows only the
// channel's colours so the two obviously come from the same shop.

export const SHORT_W = 1080;
export const SHORT_H = 1920;
export const SHORT_FPS = 30;

/** Vertical band the phone UI will not cover. Keep every readable thing here. */
export const SAFE_TOP = 200;
export const SAFE_BOTTOM = 300;

/** Captions live in the lower third; scenes stay above this line. */
export const CAPTION_TOP = 1360;

export const C = {
  /** The inked block — warm near-black, never pure black. */
  ink: '#0a0806',
  inkMid: '#151009',
  inkWarm: '#20160d',
  /** A cut line: what the burin removes, printing as light. */
  cut: '#cfc3b0',
  cutDim: '#8d8072',
  cutFaint: '#4a4238',
  gold: '#d9b872',
  goldBright: '#f0d38f',
  ember: '#c4621f',
  /** Verdict colours. Red is used only for a refusal or a cut. */
  red: '#c2402f',
  green: '#7f9b6a',
  paper: '#d6c8ac',
  paperInk: '#1a130d',
} as const;

export const FONT_DISPLAY = '"Cinzel", Georgia, serif';
export const FONT_UI = '"Inter", system-ui, sans-serif';
export const FONT_MONO = '"SFMono-Regular", Menlo, Consolas, monospace';
