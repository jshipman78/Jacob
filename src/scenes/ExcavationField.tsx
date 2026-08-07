import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import type { SceneProps } from './types';
import { SAFE_AREA } from './types';

// ---------------------------------------------------------------------------
// ExcavationField — the atmospheric workhorse. A composed, textural field
// evoking excavated ground: raking light, drifting dust/embers, faint strata
// banding, a soft horizon, deep vignette. Carries the most shots in the
// film, so it supports real variation via `mood` (palette + lighting logic)
// and `seed` (composition: horizon height, light position, drift, density).
// ---------------------------------------------------------------------------

export type ExcavationMood = 'fire' | 'candle' | 'dust' | 'night' | 'gold' | 'dusk';

export interface ExcavationFieldOptions {
  mood?: ExcavationMood;
  /** 0–1, default 0.5. Scales glow strength, mote density/opacity, contrast. */
  intensity?: number;
}

// Deterministic PRNG (mulberry32) — never Math.random(), frames render out
// of order across parallel workers so all variation must be seeded.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}
function rgbToStr([r, g, b]: [number, number, number], a = 1): string {
  return `rgba(${r},${g},${b},${a})`;
}
function lerpColor(c1: string, c2: string, t: number): [number, number, number] {
  const a = hexToRgb(c1);
  const b = hexToRgb(c2);
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

type MoodPreset = {
  skyTop: string;
  skyHorizon: string;
  groundTop: string;
  groundBottom: string;
  lightColor: string;
  moteColor: string;
  moteColorAlt: string;
  strataA: string;
  strataB: string;
  baseMotes: number;
  moteSize: [number, number];
  lightStrength: number; // 0-1 relative
  driftAngleDeg: [number, number]; // range motes drift toward (0 = right, -90 = up)
  driftDistance: [number, number]; // px over full shot
  horizonRange: [number, number]; // fraction of height
  contrastLift: number; // extra brightness on strata highlights
};

const MOOD_PRESETS: Record<ExcavationMood, MoodPreset> = {
  fire: {
    skyTop: '#1c0805',
    skyHorizon: '#a8390f',
    groundTop: '#2a0f07',
    groundBottom: '#0c0503',
    lightColor: '#ff7a3d',
    moteColor: '#ffb066',
    moteColorAlt: '#ff5a2b',
    strataA: '#3c140a',
    strataB: '#1a0805',
    baseMotes: 70,
    moteSize: [1.4, 4.2],
    lightStrength: 0.95,
    driftAngleDeg: [-100, -80],
    driftDistance: [140, 320],
    horizonRange: [0.58, 0.72],
    contrastLift: 0.22,
  },
  candle: {
    skyTop: '#0a0806',
    skyHorizon: '#171009',
    groundTop: '#120c08',
    groundBottom: '#050403',
    lightColor: '#f0b96a',
    moteColor: '#e7b66a',
    moteColorAlt: '#caa25a',
    strataA: '#1c140b',
    strataB: '#0c0906',
    baseMotes: 16,
    moteSize: [0.8, 2.2],
    lightStrength: 0.55,
    driftAngleDeg: [-95, -85],
    driftDistance: [30, 70],
    horizonRange: [0.7, 0.86],
    contrastLift: 0.1,
  },
  dust: {
    skyTop: '#332a1e',
    skyHorizon: '#8a6f45',
    groundTop: '#4a3a26',
    groundBottom: '#170f09',
    lightColor: '#e8c98a',
    moteColor: '#d8c39a',
    moteColorAlt: '#c9b483',
    strataA: '#5a4830',
    strataB: '#2c2013',
    baseMotes: 110,
    moteSize: [1, 3],
    lightStrength: 0.6,
    driftAngleDeg: [-70, -30],
    driftDistance: [90, 220],
    horizonRange: [0.5, 0.62],
    contrastLift: 0.16,
  },
  night: {
    skyTop: '#040810',
    skyHorizon: '#0f1f30',
    groundTop: '#0c141c',
    groundBottom: '#04070a',
    lightColor: '#bcd8ea',
    moteColor: '#a9c4d8',
    moteColorAlt: '#7d97ab',
    strataA: '#101c26',
    strataB: '#060b0f',
    baseMotes: 34,
    moteSize: [0.8, 2.4],
    lightStrength: 0.4,
    driftAngleDeg: [-30, 10],
    driftDistance: [60, 160],
    horizonRange: [0.6, 0.74],
    contrastLift: 0.08,
  },
  gold: {
    skyTop: '#3a2a10',
    skyHorizon: '#caa04a',
    groundTop: '#4a3413',
    groundBottom: '#160f06',
    lightColor: '#f6da8f',
    moteColor: '#f0d38f',
    moteColorAlt: '#d9b872',
    strataA: '#6b4e1e',
    strataB: '#2c1f0c',
    baseMotes: 60,
    moteSize: [1, 3.4],
    lightStrength: 0.85,
    driftAngleDeg: [-100, -70],
    driftDistance: [60, 150],
    horizonRange: [0.62, 0.78],
    contrastLift: 0.24,
  },
  dusk: {
    skyTop: '#2a2038',
    skyHorizon: '#c98a4b',
    groundTop: '#231a12',
    groundBottom: '#08060a',
    lightColor: '#e7ab6a',
    moteColor: '#cbb98e',
    moteColorAlt: '#9a8570',
    strataA: '#2e2214',
    strataB: '#120d09',
    baseMotes: 22,
    moteSize: [1, 2.6],
    lightStrength: 0.5,
    driftAngleDeg: [-60, -20],
    driftDistance: [40, 100],
    horizonRange: [0.34, 0.42],
    contrastLift: 0.1,
  },
};

type Mote = {
  x: number;
  y: number;
  r: number;
  driftAngle: number;
  driftDist: number;
  phase: number;
  swayAmp: number;
  colorAlt: boolean;
  opacityBase: number;
};

export const ExcavationField: React.FC<SceneProps> = ({ progress, seed, options }) => {
  const opts = (options ?? {}) as ExcavationFieldOptions;
  const mood: ExcavationMood = opts.mood ?? 'dust';
  const intensity = clamp(opts.intensity ?? 0.5, 0, 1);
  const preset = MOOD_PRESETS[mood];

  const seedInt = Math.floor(clamp(seed, 0, 0.999999) * 1_000_000_007) + 17;

  // Composition variation, seeded once per shot.
  const comp = useMemo(() => {
    const rng = mulberry32(seedInt);
    const horizonY = lerp(preset.horizonRange[0], preset.horizonRange[1], rng()) * 1080;
    const lightX = lerp(0.14, 0.86, rng()) * 1920;
    const lightY = lerp(0.08, 0.42, rng()) * 1080;
    const rakeAngle = lerp(96, 132, rng()); // deg, raking light sweep
    const bandCount = 6 + Math.floor(rng() * 3); // 6-8 strata bands
    return { horizonY, lightX, lightY, rakeAngle, bandCount };
  }, [seedInt, preset]);

  const motes: Mote[] = useMemo(() => {
    const rng = mulberry32(seedInt + 91);
    const count = Math.round(preset.baseMotes * lerp(0.45, 1.15, intensity));
    const list: Mote[] = [];
    for (let i = 0; i < count; i++) {
      const angleDeg = lerp(preset.driftAngleDeg[0], preset.driftAngleDeg[1], rng());
      list.push({
        x: rng() * 1920,
        y: rng() * 1080,
        r: lerp(preset.moteSize[0], preset.moteSize[1], rng()),
        driftAngle: (angleDeg * Math.PI) / 180,
        driftDist: lerp(preset.driftDistance[0], preset.driftDistance[1], rng()),
        phase: rng() * Math.PI * 2,
        swayAmp: lerp(4, 22, rng()),
        colorAlt: rng() > 0.6,
        opacityBase: lerp(0.25, 0.9, rng()),
      });
    }
    return list;
  }, [seedInt, preset, intensity]);

  const strataBands = useMemo(() => {
    const rng = mulberry32(seedInt + 233);
    const bands = [];
    const top = comp.horizonY;
    const bottom = 1080;
    const total = bottom - top;
    let cursor = top;
    for (let i = 0; i < comp.bandCount; i++) {
      const remaining = comp.bandCount - i;
      const h = Math.max(18, (total - (cursor - top)) / remaining) * lerp(0.75, 1.25, rng());
      const t = rng();
      bands.push({
        top: cursor,
        height: h,
        colorMix: t,
        opacity: lerp(0.35, 0.85, rng()),
      });
      cursor += h;
    }
    return bands;
  }, [seedInt, comp]);

  // Slow, monotonic reveal — no loop, holds after settling.
  const revealIn = clamp(progress / 0.16, 0, 1);
  const settle = 1 - Math.pow(1 - revealIn, 3);
  const drift = progress; // 0..1 linear across the whole shot, no wrap

  const lightOpacity = preset.lightStrength * lerp(0.5, 1, intensity) * settle;

  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: PALETTE_INK }}>
      {/* Sky */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${preset.skyTop} 0%, ${preset.skyHorizon} ${
            (comp.horizonY / 1080) * 100
          }%, ${preset.groundTop} ${(comp.horizonY / 1080) * 100 + 0.1}%)`,
        }}
      />

      {/* Ground base gradient, subtly scaling for a near-imperceptible parallax. */}
      <AbsoluteFill
        style={{
          top: comp.horizonY,
          height: 1080 - comp.horizonY,
          background: `linear-gradient(180deg, ${preset.groundTop} 0%, ${preset.groundBottom} 100%)`,
          transform: `scale(${1 + 0.012 * drift})`,
          transformOrigin: '50% 0%',
        }}
      />

      {/* Strata banding. */}
      {strataBands.map((b, i) => {
        const [r, g, bl] = lerpColor(preset.strataA, preset.strataB, b.colorMix);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: b.top,
              height: b.height,
              background: rgbToStr(
                [r, g, bl],
                b.opacity * (0.55 + 0.45 * settle) * (1 - 0.35 * inSafeAreaFade(b.top))
              ),
              borderTop: `1px solid rgba(255,235,200,${0.05 + preset.contrastLift * 0.3})`,
            }}
          />
        );
      })}

      {/* Raking light beam. */}
      <div
        style={{
          position: 'absolute',
          left: comp.lightX - 900,
          top: comp.lightY - 900,
          width: 1800,
          height: 1800,
          background: `radial-gradient(circle at 50% 50%, ${preset.lightColor} 0%, rgba(0,0,0,0) 60%)`,
          opacity: lightOpacity * 0.5,
          mixBlendMode: 'screen',
          transform: `translateX(${drift * 26 - 13}px)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '-20%',
          top: '-20%',
          width: '140%',
          height: '140%',
          background: `linear-gradient(${comp.rakeAngle}deg, rgba(0,0,0,0) 38%, ${preset.lightColor}22 50%, rgba(0,0,0,0) 62%)`,
          opacity: lightOpacity,
          mixBlendMode: 'screen',
        }}
      />

      {/* Dust / ember motes. */}
      <svg
        width={1920}
        height={1080}
        viewBox="0 0 1920 1080"
        style={{ position: 'absolute', inset: 0 }}
      >
        {motes.map((m, i) => {
          const sway = Math.sin(drift * Math.PI * 1.4 + m.phase) * m.swayAmp;
          const travel = drift * m.driftDist;
          const x = m.x + Math.cos(m.driftAngle) * travel + sway;
          const y = m.y + Math.sin(m.driftAngle) * travel;
          if (x < -20 || x > 1940 || y < -20 || y > 1100) return null;
          const fade = inSafeAreaFade(y);
          const op = m.opacityBase * intensityMoteScale(intensity) * settle * (1 - 0.55 * fade);
          const color = m.colorAlt ? preset.moteColorAlt : preset.moteColor;
          return <circle key={i} cx={x} cy={y} r={m.r} fill={color} opacity={op} />;
        })}
      </svg>

      {/* Safe-area calm: dim the subtitle band and the title band so text
          stays legible over whatever mood is active. */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, rgba(4,3,2,0) 0%, rgba(4,3,2,0) 70%, rgba(4,3,2,0.55) 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 1080 - SAFE_AREA.bottom,
          height: SAFE_AREA.bottom,
          background: 'linear-gradient(180deg, rgba(3,2,2,0) 0%, rgba(3,2,2,0.62) 55%, rgba(3,2,2,0.78) 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: SAFE_AREA.titleBandTop,
          height: SAFE_AREA.titleBandBottom - SAFE_AREA.titleBandTop,
          background: 'rgba(3,2,2,0.18)',
        }}
      />

      {/* Deep vignette. */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse 62% 58% at 50% 46%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.72) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

const PALETTE_INK = '#08060a';

function intensityMoteScale(intensity: number) {
  return lerp(0.55, 1.15, intensity);
}

// Softens motes/bands as they approach the subtitle safe area (near bottom).
function inSafeAreaFade(y: number) {
  const start = 1080 - SAFE_AREA.bottom - 60;
  if (y < start) return 0;
  return clamp((y - start) / (1080 - start), 0, 1);
}

export default ExcavationField;
