/**
 * Timing vocabulary for the engraving scenes.
 *
 * The single biggest difference between "a diagram that fades in" and
 * animation with craft is the shape of time. Everything here exists to get
 * away from uniform easing:
 *
 *   - `stepped`      — a value that advances in discrete passes with holds
 *                      between, the way an engraver lays down a hatch field
 *                      or a limited-animation unit shoots on twos.
 *   - `holdThenMove` — settle, sit dead still, then go. Nothing in these
 *                      scenes should ease continuously for 40 seconds.
 *   - `anticipate`   — pull back against the move before committing to it.
 *   - `overshoot`    — arrive past the mark and settle back.
 *   - `stagger`      — overlapping action: element i trails element i-1.
 *
 * All of these are pure functions of frame/progress, so they stay
 * deterministic under out-of-order rendering.
 */

import { clamp01 } from './rand';

// --- easing ---------------------------------------------------------------

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
export const easeInCubic = (t: number) => Math.pow(clamp01(t), 3);
export const easeInOutCubic = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
export const easeOutQuint = (t: number) => 1 - Math.pow(1 - clamp01(t), 5);
export const easeOutExpo = (t: number) =>
  t >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp01(t));

/** Ramp `v` from 0→1 across [a, b], clamped outside. */
export const ramp = (v: number, a: number, b: number) =>
  b === a ? (v >= b ? 1 : 0) : clamp01((v - a) / (b - a));

/** 0 at the edges of [a, d], 1 across the plateau [b, c]. */
export const window4 = (v: number, a: number, b: number, c: number, d: number) =>
  v < b ? ramp(v, a, b) : v > c ? 1 - ramp(v, c, d) : 1;

// --- the shape of a hand ---------------------------------------------------

/**
 * Advance in `passes` discrete steps, each of which eases in over
 * `workFraction` of its slot and then HOLDS for the remainder.
 *
 * This is what makes a hatch field read as engraved rather than wiped: the
 * ink arrives in bursts with dead air between, not as a linear sweep.
 */
export function stepped(
  t: number,
  passes: number,
  workFraction = 0.45,
  ease: (x: number) => number = easeOutCubic
): number {
  const x = clamp01(t) * passes;
  const i = Math.min(passes - 1, Math.floor(x));
  const local = x - i;
  const done = ease(clamp01(local / workFraction));
  return (i + done) / passes;
}

/**
 * Quantize continuous time to a lower frame rate — animating "on twos" or
 * "on fours". Held drawings, not interpolated ones.
 */
export const onNs = (frame: number, n: number) => Math.floor(frame / n) * n;

/**
 * Step index for an animation held on `hold` frames, cycling through `mod`
 * states — ALWAYS non-negative.
 *
 * This exists because of a real bug rather than for tidiness. Every scene's
 * `frame` prop goes negative during its crossfade lead-in (the shot layer is
 * mounted `crossfadeFrames` early so it can fade itself in), and JavaScript's
 * `%` keeps the sign of its left operand. A raw `Math.floor(frame / 7) % 420`
 * therefore returns a negative index at every single shot transition, which
 * indexes an array as `undefined` and throws. Stills sampled mid-shot never
 * hit it; the full render would have hit it thirty times.
 */
export const cycle = (frame: number, hold: number, mod: number): number => {
  const i = Math.floor(onNs(frame, hold) / hold);
  return ((i % mod) + mod) % mod;
};

/**
 * Move from 0 to 1 across [start, start+move], then hold dead still until
 * `nextStart`, where the caller picks the move up again. Returns 0..1 for
 * one beat of a hold-move-hold rhythm.
 */
export function holdThenMove(
  frame: number,
  start: number,
  moveFrames: number,
  ease: (x: number) => number = easeOutQuint
): number {
  return ease(ramp(frame, start, start + moveFrames));
}

/**
 * Anticipation + overshoot in one curve. Dips to `-anticipation` before
 * rising, crosses 1 at ~78%, peaks at 1+overshoot, settles to exactly 1.
 */
export function anticipate(
  t: number,
  anticipation = 0.12,
  overshoot = 0.06
): number {
  const x = clamp01(t);
  if (x === 0) return 0;
  if (x >= 1) return 1;
  if (x < 0.22) {
    // Pull back against the move.
    const u = x / 0.22;
    return -anticipation * Math.sin(u * Math.PI);
  }
  const u = (x - 0.22) / 0.78;
  const base = easeOutQuint(u);
  // Damped overshoot that is exactly 0 at u = 1.
  const wobble = overshoot * Math.sin(u * Math.PI * 1.9) * (1 - u) * (1 - u);
  return base + wobble;
}

/**
 * A plate dropped onto the page: overshoots the mark by `amount` and settles.
 * Reaches exactly 1 at t = 1.
 */
export function settle(t: number, amount = 0.055): number {
  const x = clamp01(t);
  if (x >= 1) return 1;
  const base = easeOutExpo(x);
  const damp = (1 - x) * (1 - x);
  return base + amount * Math.sin(x * Math.PI * 2.6) * damp;
}

/**
 * Overlapping action. Element `i` of `count` starts `stride` fractions of the
 * window later than element i-1. Returns that element's own local 0..1.
 */
export function stagger(
  t: number,
  i: number,
  count: number,
  stride = 0.055,
  span = 0.34
): number {
  const start = i * stride;
  const total = Math.max(1e-6, (count - 1) * stride + span);
  return ramp(clamp01(t) * total, start, start + span);
}

/**
 * A pulse that fires once at `at` and decays — used for the moment a stroke
 * bites, a label snaps in, a spark throws.
 */
export const pulse = (t: number, at: number, decay = 0.09) =>
  t < at ? 0 : Math.exp(-((t - at) / decay));

/**
 * A slow travelling highlight position in [0, 1] that crosses the plate once
 * per `periodSec` and eases at the turns, so the light never sits still and
 * never sweeps mechanically.
 */
export function rakingLight(frame: number, fps: number, periodSec: number, phase = 0) {
  const u = ((frame / (fps * periodSec)) + phase) % 1;
  // Triangle wave with cosine easing at the turns.
  const tri = u < 0.5 ? u * 2 : 2 - u * 2;
  return 0.5 - 0.5 * Math.cos(tri * Math.PI);
}
