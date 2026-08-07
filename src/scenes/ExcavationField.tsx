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
function shade(c: [number, number, number], amt: number): [number, number, number] {
  // amt > 0 lightens toward 255, amt < 0 darkens toward 0.
  return c.map((ch) => clamp(amt >= 0 ? lerp(ch, 255, amt) : lerp(ch, 0, -amt), 0, 255)) as [
    number,
    number,
    number
  ];
}

type MoodPreset = {
  skyTop: string;
  skyHorizon: string;
  groundTop: string;
  groundBottom: string;
  lightColor: string;
  lightCore: string;
  moteColor: string;
  moteColorAlt: string;
  strataA: string;
  strataB: string;
  baseMotes: number;
  moteSize: [number, number];
  lightStrength: number; // 0-1 relative
  coreStrength: number; // 0-1, bright point-glint strength
  driftAngleDeg: [number, number]; // range motes drift toward (0 = right, -90 = up)
  driftDistance: [number, number]; // px over full shot
  horizonRange: [number, number]; // fraction of height
  grainOpacity: number;
};

const MOOD_PRESETS: Record<ExcavationMood, MoodPreset> = {
  fire: {
    skyTop: '#0c0402',
    skyHorizon: '#230a05',
    groundTop: '#190905',
    groundBottom: '#050201',
    lightColor: '#e35a1f',
    lightCore: '#ffb066',
    moteColor: '#ffb066',
    moteColorAlt: '#ff5a2b',
    strataA: '#341409',
    strataB: '#130703',
    baseMotes: 64,
    moteSize: [1.4, 4],
    lightStrength: 0.55,
    coreStrength: 0.55,
    driftAngleDeg: [-100, -80],
    driftDistance: [140, 320],
    horizonRange: [0.58, 0.72],
    grainOpacity: 0.05,
  },
  candle: {
    skyTop: '#050403',
    skyHorizon: '#0a0705',
    groundTop: '#0a0705',
    groundBottom: '#020201',
    lightColor: '#b8823a',
    lightCore: '#f4cf8e',
    moteColor: '#e7b66a',
    moteColorAlt: '#caa25a',
    strataA: '#170f08',
    strataB: '#080502',
    baseMotes: 14,
    moteSize: [0.8, 2],
    lightStrength: 0.4,
    coreStrength: 0.5,
    driftAngleDeg: [-95, -85],
    driftDistance: [26, 60],
    horizonRange: [0.72, 0.88],
    grainOpacity: 0.04,
  },
  dust: {
    skyTop: '#110c07',
    skyHorizon: '#241a0f',
    groundTop: '#241a0f',
    groundBottom: '#0a0704',
    lightColor: '#b89a5e',
    lightCore: '#e8c98a',
    moteColor: '#d8c39a',
    moteColorAlt: '#a68f61',
    strataA: '#3a2c19',
    strataB: '#140e08',
    baseMotes: 92,
    moteSize: [1, 2.8],
    lightStrength: 0.42,
    coreStrength: 0.28,
    driftAngleDeg: [-70, -30],
    driftDistance: [90, 220],
    horizonRange: [0.5, 0.62],
    grainOpacity: 0.07,
  },
  night: {
    skyTop: '#020408',
    skyHorizon: '#071120',
    groundTop: '#070d15',
    groundBottom: '#020304',
    lightColor: '#5f7f9c',
    lightCore: '#d8ecf7',
    moteColor: '#a9c4d8',
    moteColorAlt: '#7d97ab',
    strataA: '#0c1721',
    strataB: '#03060a',
    baseMotes: 30,
    moteSize: [0.8, 2.2],
    lightStrength: 0.32,
    coreStrength: 0.6,
    driftAngleDeg: [-30, 10],
    driftDistance: [60, 160],
    horizonRange: [0.6, 0.74],
    grainOpacity: 0.03,
  },
  gold: {
    skyTop: '#130c04',
    skyHorizon: '#33220a',
    groundTop: '#2e1e09',
    groundBottom: '#0a0602',
    lightColor: '#c99a3f',
    lightCore: '#f6da8f',
    moteColor: '#f0d38f',
    moteColorAlt: '#d9b872',
    strataA: '#523810',
    strataB: '#1c1204',
    baseMotes: 54,
    moteSize: [1, 3.2],
    lightStrength: 0.55,
    coreStrength: 0.6,
    driftAngleDeg: [-100, -70],
    driftDistance: [60, 150],
    horizonRange: [0.62, 0.78],
    grainOpacity: 0.05,
  },
  dusk: {
    skyTop: '#130e1c',
    skyHorizon: '#3a2313',
    groundTop: '#160f0a',
    groundBottom: '#040305',
    lightColor: '#c67a3f',
    lightCore: '#eab06a',
    moteColor: '#cbb98e',
    moteColorAlt: '#8f7a68',
    strataA: '#22170c',
    strataB: '#0c0807',
    baseMotes: 18,
    moteSize: [1, 2.4],
    lightStrength: 0.4,
    coreStrength: 0.35,
    driftAngleDeg: [-60, -20],
    driftDistance: [40, 100],
    horizonRange: [0.34, 0.42],
    grainOpacity: 0.04,
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
    const lightX = lerp(0.12, 0.88, rng()) * 1920;
    const lightY = lerp(0.06, 0.4, rng()) * 1080;
    const rakeAngle = lerp(20, 55, rng()); // deg, raking light sweep across ground
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
        opacityBase: lerp(0.35, 1, rng()),
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
      const shadeAmt = lerp(-0.12, 0.14, rng());
      bands.push({
        top: cursor,
        height: h,
        colorMix: t,
        shadeAmt,
        opacity: lerp(0.55, 1, rng()),
      });
      cursor += h;
    }
    return bands;
  }, [seedInt, comp]);

  // Slow, monotonic reveal — no loop, holds after settling.
  const revealIn = clamp(progress / 0.16, 0, 1);
  const settle = 1 - Math.pow(1 - revealIn, 3);
  const drift = progress; // 0..1 linear across the whole shot, no wrap

  const lightOpacity = preset.lightStrength * lerp(0.55, 1, intensity) * settle;
  const coreOpacity = preset.coreStrength * lerp(0.5, 1, intensity) * settle;

  const groundTopPx = comp.horizonY;
  const groundH = 1080 - groundTopPx;

  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: '#030202' }}>
      {/* Sky: deep and mostly flat, just a whisper of warmth near the
          horizon. The mood's real color comes from the light glow below. */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${preset.skyTop} 0%, ${preset.skyTop} 55%, ${preset.skyHorizon} 100%)`,
        }}
      />

      {/* Ground base gradient, subtly scaling for a near-imperceptible parallax. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: groundTopPx,
          height: groundH,
          background: `linear-gradient(180deg, ${preset.groundTop} 0%, ${preset.groundBottom} 100%)`,
          transform: `scale(${1 + 0.012 * drift})`,
          transformOrigin: '50% 0%',
        }}
      />

      {/* Strata banding — distinct sediment layers, each independently
          shaded off the two mood base tones. */}
      {strataBands.map((b, i) => {
        const base = lerpColor(preset.strataA, preset.strataB, b.colorMix);
        const [r, g, bl] = shade(base, b.shadeAmt);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: b.top,
              height: b.height,
              background: rgbToStr([r, g, bl], b.opacity * (0.6 + 0.4 * settle)),
              borderTop: `1px solid rgba(255,235,200,0.06)`,
              boxShadow: 'inset 0 6px 10px -6px rgba(0,0,0,0.5)',
            }}
          />
        );
      })}

      {/* Fine soil grain — a cheap static repeating gradient, not a
          per-frame filter, kept subtle and multiply-blended. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: groundTopPx,
          height: groundH,
          opacity: preset.grainOpacity,
          mixBlendMode: 'overlay',
          background:
            'repeating-linear-gradient(115deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 1px, rgba(0,0,0,0.4) 1px, rgba(0,0,0,0.4) 3px)',
        }}
      />

      {/* Raking light across the ground — a tight angled highlight band,
          clipped to the ground so it reads as light grazing the earth
          rather than a wash over the whole frame. */}
      <div
        style={{
          position: 'absolute',
          left: -400,
          right: -400,
          top: groundTopPx,
          height: groundH,
          background: `linear-gradient(${comp.rakeAngle}deg, rgba(0,0,0,0) 42%, ${preset.lightColor} 50%, rgba(0,0,0,0) 58%)`,
          opacity: lightOpacity * 0.6,
          mixBlendMode: 'screen',
          transform: `translateX(${drift * 40 - 20}px)`,
        }}
      />

      {/* Soft ambient glow around the light source. */}
      <div
        style={{
          position: 'absolute',
          left: comp.lightX - 560,
          top: comp.lightY - 560,
          width: 1120,
          height: 1120,
          background: `radial-gradient(circle at 50% 50%, ${preset.lightColor} 0%, rgba(0,0,0,0) 58%)`,
          opacity: lightOpacity * 0.45,
          mixBlendMode: 'screen',
        }}
      />
      {/* Tighter bright core for a believable point-source glint. */}
      <div
        style={{
          position: 'absolute',
          left: comp.lightX - 140,
          top: comp.lightY - 140,
          width: 280,
          height: 280,
          background: `radial-gradient(circle at 50% 50%, ${preset.lightCore} 0%, rgba(0,0,0,0) 70%)`,
          opacity: coreOpacity * 0.7,
          mixBlendMode: 'screen',
        }}
      />

      {/* Dust / ember motes, each with a soft low-opacity halo behind a
          brighter core — a cheap stand-in for a blur filter. */}
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
          const op = m.opacityBase * intensityMoteScale(intensity) * settle * (1 - 0.6 * fade);
          const color = m.colorAlt ? preset.moteColorAlt : preset.moteColor;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={m.r * 2.6} fill={color} opacity={op * 0.16} />
              <circle cx={x} cy={y} r={m.r} fill={color} opacity={op} />
            </g>
          );
        })}
      </svg>

      {/* Safe-area calm: dim the subtitle band and the title band so text
          stays legible over whatever mood is active. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 1080 - SAFE_AREA.bottom,
          height: SAFE_AREA.bottom,
          background: 'linear-gradient(180deg, rgba(2,1,1,0) 0%, rgba(2,1,1,0.68) 55%, rgba(2,1,1,0.85) 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: SAFE_AREA.titleBandTop,
          height: SAFE_AREA.titleBandBottom - SAFE_AREA.titleBandTop,
          background: 'rgba(2,1,1,0.22)',
        }}
      />

      {/* Deep vignette. */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse 60% 56% at 50% 44%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.82) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

function intensityMoteScale(intensity: number) {
  return lerp(0.6, 1.2, intensity);
}

// Softens motes/bands as they approach the subtitle safe area (near bottom).
function inSafeAreaFade(y: number) {
  const start = 1080 - SAFE_AREA.bottom - 60;
  if (y < start) return 0;
  return clamp((y - start) / (1080 - start), 0, 1);
}

export default ExcavationField;
