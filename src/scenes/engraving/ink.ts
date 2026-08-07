/**
 * The graver's toolkit.
 *
 * Everything the engraved scenes draw with is built here, and everything
 * here obeys three rules:
 *
 *  1. No line is straight. Every stroke carries a low-frequency wander of a
 *     fraction of a pixel to a pixel or two — the hand, not the Bezier.
 *  2. Tone is built from strokes, never from a flat fill. Lightness comes
 *     from hatch pitch, stroke weight and cross-hatching, the way a wood
 *     engraver builds a grey.
 *  3. Every generator is a pure function of its arguments, one of which is
 *     always the scene seed. Nothing consults the clock or Math.random.
 *
 * The house style is WHITE-LINE wood engraving — Bewick's technique, and the
 * dominant book-illustration method of exactly the decades this film is
 * about. The block is dark; the engraver cuts lines *away* and those cuts
 * print as light. So in these scenes bone-coloured strokes sit on a warm
 * near-black ground, and hatching builds light rather than shadow. Where a
 * scene wants the opposite register — a plate tipped into the page — the
 * `Plate` component supplies cream laid paper and the same generators are
 * used with dark ink.
 */

import { makeFbm1D, rngFor, clamp, clamp01, lerp } from './rand';

export type Pt = { x: number; y: number };

export type Stroke = {
  /** SVG path data. */
  d: string;
  /** Approximate path length, for stroke-dash draw-on. */
  len: number;
  /** Suggested stroke width for this line. */
  w: number;
  /** Suggested opacity for this line. */
  o: number;
  /** Stable 0..1 value for per-stroke variation by the caller. */
  k: number;
};

// ---------------------------------------------------------------------------
// Core: a line with a hand behind it
// ---------------------------------------------------------------------------

/**
 * Convert a point list into a smooth SVG path, adding a seeded low-frequency
 * wander perpendicular to the local direction.
 *
 * `amp` is the wander amplitude in px; `wavelength` is roughly how far along
 * the line one wobble takes. Keep amp small (0.5–2px) — this should read as
 * a slightly imperfect hand, not as a wavy decorative line.
 */
export function wobble(
  pts: Pt[],
  fbm: (x: number) => number,
  amp: number,
  wavelength = 90,
  phase = 0
): { d: string; len: number; pts: Pt[] } {
  if (pts.length < 2) return { d: '', len: 0, pts };

  // Arc-length parameterise so the wobble frequency is uniform in space
  // rather than in index — otherwise densely-sampled sections wobble faster.
  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    cum.push(cum[i - 1] + Math.hypot(dx, dy));
  }
  const total = cum[cum.length - 1] || 1;

  const out: Pt[] = pts.map((p, i) => {
    // Local tangent, and its normal.
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const tl = Math.hypot(tx, ty) || 1;
    const nx = -ty / tl;
    const ny = tx / tl;

    // Taper the wander to zero at both ends so joined strokes still meet.
    const u = cum[i] / total;
    const endTaper = Math.min(1, Math.min(u, 1 - u) * 6);

    const w = fbm(cum[i] / wavelength + phase) * amp * endTaper;
    return { x: p.x + nx * w, y: p.y + ny * w };
  });

  // Emit as a Catmull-Rom-ish smooth path (quadratic through midpoints):
  // cheap, and it keeps the wander looking like a drawn curve.
  let d = `M ${out[0].x.toFixed(2)} ${out[0].y.toFixed(2)}`;
  if (out.length === 2) {
    d += ` L ${out[1].x.toFixed(2)} ${out[1].y.toFixed(2)}`;
  } else {
    for (let i = 1; i < out.length - 1; i++) {
      const mx = (out[i].x + out[i + 1].x) / 2;
      const my = (out[i].y + out[i + 1].y) / 2;
      d += ` Q ${out[i].x.toFixed(2)} ${out[i].y.toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)}`;
    }
    const last = out[out.length - 1];
    d += ` L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`;
  }

  let len = 0;
  for (let i = 1; i < out.length; i++) {
    len += Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y);
  }
  return { d, len: len * 1.02, pts: out };
}

/** Sample a straight segment into `n` points, for feeding to `wobble`. */
export function segment(a: Pt, b: Pt, n = 12): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
  }
  return pts;
}

/**
 * A tapered "swelled" line: the burin cuts deeper in the middle of a stroke
 * and lifts at both ends, so real engraved lines are lens-shaped. SVG can't
 * vary stroke width along a path, so this returns a FILLED outline instead.
 *
 * `profile(u)` returns the half-width at arc position u in [0,1].
 */
export function swelled(
  pts: Pt[],
  profile: (u: number) => number
): { d: string; len: number } {
  if (pts.length < 2) return { d: '', len: 0 };

  const cum: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  const total = cum[cum.length - 1] || 1;

  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const tl = Math.hypot(tx, ty) || 1;
    const nx = -ty / tl;
    const ny = tx / tl;
    const hw = Math.max(0.05, profile(cum[i] / total));
    left.push({ x: pts[i].x + nx * hw, y: pts[i].y + ny * hw });
    right.push({ x: pts[i].x - nx * hw, y: pts[i].y - ny * hw });
  }

  const fwd = left.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  const back = right
    .slice()
    .reverse()
    .map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');
  return { d: `${fwd} ${back} Z`, len: total };
}

/** The classic burin profile: thin at both ends, fattest just past centre. */
export const burinProfile = (maxHalfWidth: number, bias = 0.55) => (u: number) => {
  const x = clamp01(u);
  const s = Math.sin(Math.PI * Math.pow(x, Math.log(0.5) / Math.log(bias)));
  return maxHalfWidth * Math.pow(s, 0.7);
};

// ---------------------------------------------------------------------------
// Hatching — how tone is made
// ---------------------------------------------------------------------------

export type HatchOptions = {
  /** Region to fill, in local user units. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Hatch direction in degrees. 0 = horizontal strokes. */
  angle?: number;
  /** Distance between adjacent strokes, px. Smaller = denser = brighter. */
  pitch?: number;
  /** Wander amplitude, px. */
  amp?: number;
  /** Fraction of a stroke's length actually cut, 0..1 — engravers lift the
   *  burin, so a hatch field is not a set of full-width rules. */
  coverage?: number;
  /** Random variation in per-stroke start position. */
  jitter?: number;
  /** Base stroke width. */
  width?: number;
  /** Optional density function in [0,1] over the normalised region, used to
   *  model form: strokes fade and thin where the surface turns away. */
  density?: (u: number, v: number) => number;
  /** Number of sample points per stroke. Lower is cheaper. */
  samples?: number;
};

/**
 * Build a hatch field: a set of parallel graver strokes across a region.
 *
 * This is the workhorse. Every grey in these scenes is one or two of these
 * fields, not a gradient.
 */
export function hatch(
  seed: number,
  channel: string,
  opts: HatchOptions
): Stroke[] {
  const {
    x, y, w, h,
    angle = 28,
    pitch = 16,
    amp = 0.9,
    coverage = 0.94,
    jitter = 0.35,
    width = 1.1,
    density,
    samples = 8,
  } = opts;

  const rand = rngFor(seed, `hatch:${channel}`);
  const fbm = makeFbm1D(seed, `hatchw:${channel}`);

  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  // Normal to the hatch direction — we step along this.
  const nx = -dy;
  const ny = dx;

  const cx = x + w / 2;
  const cy = y + h / 2;
  // Long enough to always cross the region at any angle.
  const half = Math.hypot(w, h) / 2 + pitch;
  const count = Math.ceil((half * 2) / pitch);

  const strokes: Stroke[] = [];
  for (let i = 0; i <= count; i++) {
    const offset = -half + i * pitch + (rand() - 0.5) * pitch * jitter;
    const bx = cx + nx * offset;
    const by = cy + ny * offset;

    // Clip the infinite hatch line to the declared region (Liang–Barsky).
    //
    // Without this, a field declared over a 400px-tall band still emits
    // strokes across the full diagonal extent of the region's bounding
    // circle — roughly ±1000px — and any density function that returns a
    // non-zero value outside [0,1] lets them through. That is how a sky
    // hatch ends up drawing horizontal rules across the foreground.
    let t0 = -half;
    let t1 = half;
    const ps = [-dx, dx, -dy, dy];
    const qs = [bx - x, x + w - bx, by - y, y + h - by];
    let inside = true;
    for (let e = 0; e < 4; e++) {
      if (Math.abs(ps[e]) < 1e-9) {
        if (qs[e] < 0) { inside = false; break; }
        continue;
      }
      const r = qs[e] / ps[e];
      if (ps[e] < 0) { if (r > t1) { inside = false; break; } if (r > t0) t0 = r; }
      else { if (r < t0) { inside = false; break; } if (r < t1) t1 = r; }
    }
    if (!inside || t1 - t0 < 4) continue;

    // Where along the clipped span this cut starts and ends — the burin
    // lifts, so a hatch field is not a set of full-width rules.
    const span = t1 - t0;
    const cov = clamp01(coverage - rand() * 0.18);
    const slack = (1 - cov) * span;
    const startT = t0 + rand() * slack;
    const endT = startT + cov * span;

    const a = { x: bx + dx * startT, y: by + dy * startT };
    const b = { x: bx + dx * endT, y: by + dy * endT };

    // Position of this stroke across the region, for the density function.
    const u = clamp01((i / count));
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const v = clamp01((midY - y) / (h || 1));
    const dens = density ? clamp01(density(clamp01((midX - x) / (w || 1)), v)) : 1;
    if (dens <= 0.02) continue;

    const { d, len } = wobble(
      segment(a, b, samples),
      fbm,
      amp,
      110 + rand() * 60,
      i * 7.31
    );

    strokes.push({
      d,
      len,
      // Weight follows density: a thinner cut prints less light.
      w: width * lerp(0.55, 1.15, dens) * lerp(0.85, 1.15, rand()),
      o: lerp(0.18, 1, Math.pow(dens, 0.85)),
      k: u,
    });
  }
  return strokes;
}

/**
 * Two hatch fields at different angles — the darkest tone an engraver has
 * short of leaving the block solid. Returns them separately so the caller
 * can lay the second pass down *after* the first, in time.
 */
export function crossHatch(
  seed: number,
  channel: string,
  opts: HatchOptions & { crossAngle?: number; crossPitch?: number }
): { first: Stroke[]; second: Stroke[] } {
  const { crossAngle, crossPitch, ...base } = opts;
  const a1 = base.angle ?? 28;
  return {
    first: hatch(seed, `${channel}:a`, base),
    second: hatch(seed, `${channel}:b`, {
      ...base,
      angle: crossAngle ?? a1 + 56,
      pitch: crossPitch ?? (base.pitch ?? 16) * 1.35,
      width: (base.width ?? 1.1) * 0.85,
    }),
  };
}

/**
 * Contour hatching — strokes that FOLLOW the form rather than crossing it.
 *
 * This is the single strongest engraving tell, and the thing plain parallel
 * hatching cannot fake: on a hill, a vault, a drapery fold or a shoulder, the
 * engraver's lines curve with the surface, so the lines themselves describe
 * the volume. Bewick and Doré both build almost everything this way.
 *
 * Takes a base contour (e.g. the skyline of a mound) and lays successive
 * offset copies of it *into* the form, each broken into discontinuous cuts —
 * because a real burin lifts constantly — with the breaks controlled by a
 * density field so the surface can turn into shadow.
 */
export function hatchContours(
  seed: number,
  channel: string,
  base: Pt[],
  opts: {
    /** How many offset contours to lay down. */
    lines: number;
    /** Distance between contours, px. Grows with `spacingGrowth`. */
    spacing: number;
    /** Offset direction, degrees (90 = straight down). */
    direction?: number;
    /** Contours spread apart as they go deeper — perspective on the form. */
    spacingGrowth?: number;
    /** Mean length of one cut, px. */
    dashLength?: number;
    /** Mean gap between cuts, px. */
    dashGap?: number;
    amp?: number;
    width?: number;
    /**
     * Tone at (u along the contour, v into the form), both 0..1.
     * 1 = fully cut (bright), 0 = left solid (dark).
     */
    density?: (u: number, v: number) => number;
    /** Lateral drift of each successive contour, px — stops them from
     *  stacking into a moiré. */
    drift?: number;
  }
): Stroke[] {
  const {
    lines, spacing, direction = 90, spacingGrowth = 1.06,
    dashLength = 34, dashGap = 16, amp = 0.9, width = 1.1,
    density, drift = 6,
  } = opts;

  const rand = rngFor(seed, `cont:${channel}`);
  const fbm = makeFbm1D(seed, `contw:${channel}`);
  const rad = (direction * Math.PI) / 180;
  const ox = Math.cos(rad);
  const oy = Math.sin(rad);

  const out: Stroke[] = [];
  let dist = 0;

  for (let li = 0; li < lines; li++) {
    dist += spacing * Math.pow(spacingGrowth, li);
    const v = li / Math.max(1, lines - 1);
    const lateral = (rand() - 0.5) * drift;

    // Offset copy of the base contour, slightly flattened as it goes deeper
    // so the form reads as rounding away rather than extruding.
    const flat = 1 - v * 0.35;
    const offset: Pt[] = base.map((p, i) => {
      const centreY = base[Math.floor(base.length / 2)].y;
      return {
        x: p.x + ox * dist + lateral,
        y: centreY + (p.y - centreY) * flat + oy * dist,
      };
    });

    // Walk the offset contour, cutting dashes.
    let acc = 0;
    let cutStart = 0;
    let cutting = rand() < 0.7;
    const cum: number[] = [0];
    for (let i = 1; i < offset.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(offset[i].x - offset[i - 1].x, offset[i].y - offset[i - 1].y));
    }
    const total = cum[cum.length - 1] || 1;

    const at = (s: number): Pt => {
      // Linear lookup along the contour by arc length.
      let i = 1;
      while (i < cum.length - 1 && cum[i] < s) i++;
      const t = (s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
      return {
        x: lerp(offset[i - 1].x, offset[i].x, t),
        y: lerp(offset[i - 1].y, offset[i].y, t),
      };
    };

    while (acc < total) {
      const u = acc / total;
      const dens = density ? clamp01(density(u, v)) : 1;
      // Where the form is dark, cuts get shorter and gaps get longer —
      // exactly how an engraver graduates a tone.
      const lenHere = dashLength * lerp(0.25, 1.5, dens) * lerp(0.6, 1.4, rand());
      const gapHere = dashGap * lerp(2.2, 0.5, dens) * lerp(0.6, 1.6, rand());

      if (cutting && dens > 0.05) {
        const end = Math.min(total, acc + lenHere);
        const n = Math.max(2, Math.round((end - acc) / 12));
        const pts: Pt[] = [];
        for (let k = 0; k <= n; k++) pts.push(at(acc + ((end - acc) * k) / n));
        if (pts.length >= 2) {
          const { d, len } = wobble(pts, fbm, amp, 70, li * 5.3 + acc * 0.01);
          out.push({
            d,
            len,
            w: width * lerp(0.6, 1.2, dens) * lerp(0.85, 1.1, rand()),
            o: lerp(0.25, 1, Math.pow(dens, 0.8)),
            k: v * 0.6 + u * 0.4,
          });
        }
        acc = end + gapHere;
      } else {
        acc += gapHere;
      }
      cutting = true;
      cutStart = acc;
      void cutStart;
    }
  }
  return out;
}

/**
 * Stipple / flick field — dots and short flicks, for grain, soil, aerial
 * distance, and anywhere hatching would be too regimented.
 */
export function stipple(
  seed: number,
  channel: string,
  opts: {
    x: number; y: number; w: number; h: number;
    count: number;
    minR?: number; maxR?: number;
    density?: (u: number, v: number) => number;
  }
): { x: number; y: number; r: number; o: number; k: number }[] {
  const { x, y, w, h, count, minR = 0.6, maxR = 2.1, density } = opts;
  const rand = rngFor(seed, `stipple:${channel}`);
  const out: { x: number; y: number; r: number; o: number; k: number }[] = [];
  for (let i = 0; i < count; i++) {
    const u = rand();
    const v = rand();
    const dens = density ? clamp01(density(u, v)) : 1;
    // Rejection-sample against the density field so dots cluster where the
    // form is light, rather than sitting on an even grid.
    if (rand() > dens) continue;
    out.push({
      x: x + u * w,
      y: y + v * h,
      r: lerp(minR, maxR, rand() * rand()),
      o: lerp(0.25, 1, dens * lerp(0.5, 1, rand())),
      k: i / count,
    });
  }
  return out;
}

/**
 * Short curved flicks that follow a direction field — for grass, ash, water
 * and any surface that wants direction without regimentation.
 */
export function flicks(
  seed: number,
  channel: string,
  opts: {
    x: number; y: number; w: number; h: number;
    count: number;
    length?: number;
    angleAt: (u: number, v: number) => number;
    density?: (u: number, v: number) => number;
  }
): Stroke[] {
  const { x, y, w, h, count, length = 14, angleAt, density } = opts;
  const rand = rngFor(seed, `flicks:${channel}`);
  const fbm = makeFbm1D(seed, `flicksw:${channel}`);
  const out: Stroke[] = [];
  for (let i = 0; i < count; i++) {
    const u = rand();
    const v = rand();
    const dens = density ? clamp01(density(u, v)) : 1;
    if (rand() > dens) continue;
    const px = x + u * w;
    const py = y + v * h;
    const a = (angleAt(u, v) * Math.PI) / 180;
    const l = length * lerp(0.55, 1.4, rand());
    const pts = segment(
      { x: px - Math.cos(a) * l * 0.5, y: py - Math.sin(a) * l * 0.5 },
      { x: px + Math.cos(a) * l * 0.5, y: py + Math.sin(a) * l * 0.5 },
      4
    );
    const { d, len } = wobble(pts, fbm, 1.1, 22, i * 3.7);
    out.push({ d, len, w: lerp(0.7, 1.5, rand()), o: lerp(0.3, 1, dens), k: i / count });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Draw-on
// ---------------------------------------------------------------------------

/**
 * Stroke-dash draw-on for a single path.
 *
 * `t` in [0,1]. Returns the dash props that reveal the stroke from its start.
 * A tiny overshoot on the dash array avoids a hairline of residual dash at
 * t = 1 caused by our approximate length measure.
 */
export const drawOn = (len: number, t: number) => {
  const L = len * 1.04;
  return {
    strokeDasharray: `${L} ${L}`,
    strokeDashoffset: L * (1 - clamp01(t)),
  };
};

/**
 * Reveal a whole hatch FIELD the way an engraver actually works it: not
 * every stroke growing together, and not strictly left-to-right, but in a
 * few passes across the region, each pass biting quickly and then holding.
 *
 * Returns the per-stroke local reveal 0..1.
 */
export function hatchReveal(
  stroke: Stroke,
  t: number,
  passes = 5,
  strokeSpan = 0.3
): number {
  // Which pass this stroke belongs to — interleaved, so pass 1 lays down
  // every 5th stroke across the whole field, pass 2 fills between, etc.
  const idx = Math.floor(stroke.k * 1000);
  const pass = idx % passes;
  const withinPass = ((idx * 2654435761) % 1000) / 1000;

  const slot = 1 / passes;
  const start = pass * slot + withinPass * slot * (1 - strokeSpan);
  const span = slot * strokeSpan;
  return clamp01((clamp01(t) - start) / (span || 1e-6));
}

// ---------------------------------------------------------------------------
// Misc geometry helpers used by several scenes
// ---------------------------------------------------------------------------

/** A wobbled closed rectangle — a plate mark, a frame, a cut edge. */
export function wobblyRect(
  seed: number,
  channel: string,
  x: number,
  y: number,
  w: number,
  h: number,
  amp = 1.1
): { d: string; len: number } {
  const fbm = makeFbm1D(seed, `rect:${channel}`);
  const pts: Pt[] = [
    ...segment({ x, y }, { x: x + w, y }, 10),
    ...segment({ x: x + w, y }, { x: x + w, y: y + h }, 8).slice(1),
    ...segment({ x: x + w, y: y + h }, { x, y: y + h }, 10).slice(1),
    ...segment({ x, y: y + h }, { x, y }, 8).slice(1),
  ];
  const r = wobble(pts, fbm, amp, 160);
  return { d: r.d + ' Z', len: r.len };
}

/** Wobbled ellipse. */
export function wobblyEllipse(
  seed: number,
  channel: string,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  amp = 0.9,
  n = 48
): { d: string; len: number } {
  const fbm = makeFbm1D(seed, `ell:${channel}`);
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  const r = wobble(pts, fbm, amp, 140);
  return { d: r.d + ' Z', len: r.len };
}

/** Turn an irregular contour (already in order) into a wobbled open path. */
export function contour(
  seed: number,
  channel: string,
  pts: Pt[],
  amp = 1.0,
  wavelength = 120
): { d: string; len: number } {
  const fbm = makeFbm1D(seed, `contour:${channel}`);
  return wobble(pts, fbm, amp, wavelength);
}

export { clamp, clamp01, lerp };
