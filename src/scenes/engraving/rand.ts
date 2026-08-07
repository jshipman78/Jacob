/**
 * Deterministic randomness for the engraving system.
 *
 * Remotion renders frames out of order across parallel workers, so nothing
 * may consult `Math.random()` or the wall clock at render time. Every piece
 * of "hand-made" variation in these scenes — the wobble of a graver line,
 * the scatter of a stipple field, the misregistration of the plate — is
 * derived here from the scene's `seed` prop, which is itself hashed from the
 * shot id. Same frame, same pixels, on every worker, forever.
 */

/** mulberry32: fast, well-distributed, 32-bit state. */
export function mulberry32(seed: number) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return function rand(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Turn a scene's unit-float `seed` prop into a usable 32-bit integer seed. */
export const seedInt = (seed: number, salt = 0): number =>
  (Math.floor(seed * 0xffffffff) ^ Math.imul(salt + 1, 0x85ebca6b)) >>> 0;

/** A seeded generator for a named sub-system, so two systems in one scene
 *  don't consume from the same stream and shift when one is edited. */
export const rngFor = (seed: number, channel: string) => {
  let h = 2166136261;
  for (let i = 0; i < channel.length; i++) {
    h ^= channel.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return mulberry32(seedInt(seed, h >>> 0));
};

/**
 * Cheap 1-D value noise, smooth and continuous, in [-1, 1].
 *
 * Used for the low-frequency wander of a graver line and for the drift of
 * dust. Deliberately not trigonometric-sum noise: this is evaluated a few
 * thousand times per frame and needs to stay inexpensive.
 */
export function makeValueNoise1D(seed: number, channel: string) {
  const rand = rngFor(seed, channel);
  const TABLE = 256;
  const table = new Float32Array(TABLE);
  for (let i = 0; i < TABLE; i++) table[i] = rand() * 2 - 1;

  return function noise(x: number): number {
    const xi = Math.floor(x);
    const xf = x - xi;
    const a = table[((xi % TABLE) + TABLE) % TABLE];
    const b = table[(((xi + 1) % TABLE) + TABLE) % TABLE];
    // smoothstep interpolation — C1 continuous, no visible kinks.
    const t = xf * xf * (3 - 2 * xf);
    return a + (b - a) * t;
  };
}

/** Fractal sum of the above — two octaves is plenty for line wobble. */
export function makeFbm1D(seed: number, channel: string) {
  const n = makeValueNoise1D(seed, channel);
  return (x: number): number => n(x) * 0.68 + n(x * 2.17 + 31.7) * 0.32;
}

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
