import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import { rngFor, lerp, clamp01 } from './rand';
import { onNs, rakingLight } from './timing';
import { WIDTH, HEIGHT } from '../../constants';

/**
 * The physical substrate every engraved scene is printed on.
 *
 * The film's house style is white-line wood engraving: a dark inked block
 * with the design cut *away*, so the cuts print light. `Plate` supplies that
 * block — its colour, its laid-paper grain, its plate mark, the raking light
 * that travels across it, and the misregistration of a hand press — and the
 * scene draws bone-coloured strokes on top.
 *
 * PERFORMANCE CONTRACT (this is load-bearing; the full film is ~25,000
 * frames on four cores):
 *
 *  - No SVG filter primitive runs here. `feTurbulence` and
 *    `feDisplacementMap` are banned outright — one large animated turbulence
 *    per frame is enough on its own to make the render intractable.
 *  - The grain layer is STATIC. Its DOM is identical on every frame, so the
 *    compositor rasterises it once and reuses the tile. Nothing animates it.
 *  - Everything that does move is a transform or an opacity on a small
 *    number of elements — cheap, compositor-friendly properties.
 *  - The press misregistration is applied to the CONTENT, not to the paper,
 *    which is both physically correct and keeps the expensive layer static.
 */

export const PLATE = {
  /** The inked block. Warm near-black — never pure black, which reads as a
   *  hole in the page rather than as ink. */
  blockDark: '#0a0806',
  blockMid: '#151009',
  blockWarm: '#20160d',
  /** A cut line: what the burin removes and the paper shows through as. */
  cut: '#cfc3b0',
  cutDim: '#6d6257',
  cutFaint: '#3f382f',
  /** Warm accents — gilding, lamplight, fire. */
  gold: '#d9b872',
  goldBright: '#f0d38f',
  ember: '#c4621f',
  /** For inset printed plates: cream laid paper and its dark ink. */
  paper: '#d6c8ac',
  paperShade: '#b9a888',
  paperInk: '#1a130d',
} as const;

// ---------------------------------------------------------------------------
// Static grain
// ---------------------------------------------------------------------------

/**
 * The speckle of laid paper and the bite of the block.
 *
 * Built once at module scope: the geometry never changes, never animates,
 * and is shared by every scene in the film, so the browser rasterises this
 * exactly once for the whole render.
 */
const GRAIN = (() => {
  const rand = rngFor(0.6180339887, 'plate-grain');
  const specks: string[] = [];
  for (let i = 0; i < 1100; i++) {
    const x = rand() * WIDTH;
    const y = rand() * HEIGHT;
    const r = lerp(0.4, 1.5, rand() * rand());
    const o = lerp(0.02, 0.09, rand());
    specks.push(
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="#e8dcc4" opacity="${o.toFixed(3)}"/>`
    );
  }
  // A few dozen darker pits — where the block did not take ink evenly.
  for (let i = 0; i < 260; i++) {
    const x = rand() * WIDTH;
    const y = rand() * HEIGHT;
    const r = lerp(0.6, 2.6, rand() * rand());
    specks.push(
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="#000000" opacity="${lerp(0.05, 0.16, rand()).toFixed(3)}"/>`
    );
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">${specks.join('')}</svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
})();

/**
 * Laid paper: the regular chain lines and closely-spaced laid lines left by
 * the mould's wire. Pure CSS gradients — effectively free, and the real
 * thing genuinely is this regular.
 */
const LAID_LINES =
  'repeating-linear-gradient(90deg, rgba(232,220,196,0.030) 0px, rgba(232,220,196,0.030) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 7px), ' +
  'repeating-linear-gradient(0deg, rgba(0,0,0,0.055) 0px, rgba(0,0,0,0.055) 1.5px, rgba(0,0,0,0) 1.5px, rgba(0,0,0,0) 34px)';

// ---------------------------------------------------------------------------

export type PlateProps = {
  seed: number;
  frame: number;
  fps: number;
  /** Overall tone of the block for this scene. */
  tone?: 'cold' | 'neutral' | 'warm' | 'fire';
  /** Seconds for the raking light to cross the plate once. Long. */
  lightPeriodSec?: number;
  /** Angle the raking light travels along, degrees. */
  lightAngle?: number;
  /** Strength of the raking light, 0..1. */
  lightStrength?: number;
  /** Draw the plate mark (the impression of the block's edge). */
  plateMark?: boolean;
  /** Disable press misregistration (for scenes that own their own transform). */
  steady?: boolean;
  children?: React.ReactNode;
};

const TONES: Record<string, { a: string; b: string; c: string }> = {
  cold: { a: '#0a0a0c', b: '#12131a', c: '#1a1b22' },
  neutral: { a: '#0a0806', b: '#151009', c: '#1e1710' },
  warm: { a: '#0d0805', b: '#1c1108', c: '#2a1a0d' },
  fire: { a: '#0f0704', b: '#241106', c: '#3a1a08' },
};

export const Plate: React.FC<PlateProps> = ({
  seed,
  frame,
  fps,
  tone = 'neutral',
  lightPeriodSec = 26,
  lightAngle = 24,
  lightStrength = 1,
  plateMark = true,
  steady = false,
  children,
}) => {
  const t = TONES[tone] ?? TONES.neutral;

  /**
   * Press misregistration.
   *
   * A hand-pulled impression never lands twice in exactly the same place.
   * The critical detail is that this is QUANTISED to blocks of frames — a
   * continuous sub-pixel drift reads as video noise or a soft focus problem,
   * whereas a held offset that changes every seventh frame reads as
   * successive impressions. Seeded, so it is identical on every worker.
   */
  const reg = useMemo(() => {
    const rand = rngFor(seed, 'registration');
    const steps = 420;
    const xs = new Float32Array(steps);
    const ys = new Float32Array(steps);
    const rs = new Float32Array(steps);
    for (let i = 0; i < steps; i++) {
      xs[i] = (rand() - 0.5) * 0.9;
      ys[i] = (rand() - 0.5) * 0.9;
      rs[i] = (rand() - 0.5) * 0.075;
    }
    return { xs, ys, rs, steps };
  }, [seed]);

  const regIdx = Math.floor(onNs(frame, 7) / 7) % reg.steps;
  const rx = steady ? 0 : reg.xs[regIdx];
  const ry = steady ? 0 : reg.ys[regIdx];
  const rr = steady ? 0 : reg.rs[regIdx];

  // The raking light: a broad soft warm band that crosses the plate. It is
  // never in the same place two shots running, and never sits still.
  const lp = rakingLight(frame, fps, lightPeriodSec, seed);
  const lightX = lerp(-25, 125, lp);
  const lightY = lerp(20, 70, rakingLight(frame, fps, lightPeriodSec * 1.7, seed * 0.5));

  return (
    <AbsoluteFill style={{ backgroundColor: t.a, overflow: 'hidden' }}>
      {/* The inked block: warm, uneven, darker at the edges. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 120% 90% at 46% 40%, ${t.c} 0%, ${t.b} 45%, ${t.a} 100%)`,
        }}
      />

      {/* Laid paper structure. Static, gradient-only, essentially free. */}
      <AbsoluteFill style={{ background: LAID_LINES, opacity: 0.55 }} />

      {/* Grain speckle. STATIC — identical DOM every frame, rasterised once. */}
      <AbsoluteFill
        style={{
          backgroundImage: GRAIN,
          backgroundSize: `${WIDTH}px ${HEIGHT}px`,
          opacity: 0.85,
        }}
      />

      {/* The scene's own ink, carrying the press misregistration. */}
      <AbsoluteFill
        style={{
          transform: `translate(${rx.toFixed(3)}px, ${ry.toFixed(3)}px) rotate(${rr.toFixed(4)}deg)`,
          transformOrigin: '50% 50%',
        }}
      >
        {children}
      </AbsoluteFill>

      {/* Raking light travelling across the surface, above the ink — this is
          light falling ON the printed page, so it lifts the ink too. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 120% at ${lightX.toFixed(2)}% ${lightY.toFixed(2)}%, rgba(255,226,170,${(0.085 * lightStrength).toFixed(4)}) 0%, rgba(255,210,150,${(0.035 * lightStrength).toFixed(4)}) 38%, rgba(0,0,0,0) 70%)`,
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />
      <AbsoluteFill
        style={{
          background: `linear-gradient(${lightAngle}deg, rgba(0,0,0,${(0.20 * lightStrength).toFixed(3)}) 0%, rgba(0,0,0,0) 34%, rgba(0,0,0,0) 62%, rgba(0,0,0,${(0.26 * lightStrength).toFixed(3)}) 100%)`,
          pointerEvents: 'none',
        }}
      />

      {/* The plate mark: the debossed edge the block presses into the sheet. */}
      {plateMark ? (
        <AbsoluteFill style={{ pointerEvents: 'none' }}>
          <div
            style={{
              position: 'absolute',
              left: 46,
              top: 30,
              right: 46,
              bottom: 30,
              border: '1px solid rgba(207,195,176,0.10)',
              boxShadow:
                'inset 0 0 0 1px rgba(0,0,0,0.30), inset 0 0 42px rgba(0,0,0,0.42), 0 0 0 1px rgba(0,0,0,0.22)',
              borderRadius: 2,
            }}
          />
        </AbsoluteFill>
      ) : null}

      {/* Ink settling toward the foot of the plate — also the calm band the
          burned-in subtitles sit on. */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0) 62%, rgba(6,4,3,0.34) 84%, rgba(6,4,3,0.58) 100%)',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * An inset printed plate: cream laid paper tipped into the dark page, with
 * dark ink on it. The counter-register to the white-line block, used for
 * ledgers, cards and documents where a *printed* artefact is the subject.
 *
 * Deliberately kept clear of the bottom subtitle band by the caller.
 */
export const PaperPanel: React.FC<{
  x: number; y: number; w: number; h: number;
  seed: number;
  /** 0..1 — how far the sheet has been laid down. */
  reveal?: number;
  rotate?: number;
  children?: React.ReactNode;
}> = ({ x, y, w, h, seed, reveal = 1, rotate = 0, children }) => {
  const rand = useMemo(() => rngFor(seed, 'panel'), [seed]);
  const tilt = useMemo(() => (rand() - 0.5) * 0.5 + rotate, [rand, rotate]);

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        transform: `rotate(${tilt.toFixed(3)}deg) scale(${(0.985 + 0.015 * clamp01(reveal)).toFixed(4)})`,
        opacity: clamp01(reveal),
        background: `linear-gradient(158deg, ${PLATE.paper} 0%, #cbbc9e 46%, ${PLATE.paperShade} 100%)`,
        boxShadow:
          '0 18px 48px rgba(0,0,0,0.62), 0 2px 0 rgba(255,248,232,0.16) inset, 0 -2px 0 rgba(90,72,46,0.22) inset',
      }}
    >
      {/* Laid lines on the sheet itself. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'repeating-linear-gradient(90deg, rgba(90,72,46,0.055) 0px, rgba(90,72,46,0.055) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 7px), ' +
            'repeating-linear-gradient(0deg, rgba(90,72,46,0.07) 0px, rgba(90,72,46,0.07) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 32px)',
        }}
      />
      {/* Foxing and age at the edges. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse 88% 82% at 48% 44%, rgba(0,0,0,0) 52%, rgba(112,84,44,0.20) 82%, rgba(84,60,30,0.36) 100%)',
        }}
      />
      {children}
    </div>
  );
};
