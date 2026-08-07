import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import type { SceneProps } from '../types';
import { SAFE_AREA } from '../types';

// ---------------------------------------------------------------------------
// ExcavationField — the atmospheric workhorse. A composed, textural field
// evoking excavated ground: raking light, drifting dust/embers, faint strata
// banding, a soft horizon, deep vignette. Carries the most shots in the
// film, so it supports real variation via `mood` (palette + lighting *and*
// motion behaviour) and `seed` (composition: horizon height, light
// position, drift direction, mote density).
//
// Motion model: `progress` (0→1 across the shot) drives the one-time reveal
// and a slow net drift/sweep so the scene always has a clear arc regardless
// of shot length. Continuous "alive" motion (sway, flicker, breathing,
// travelling glints) is driven off `frame/fps` (elapsed seconds) so it reads
// at a consistent, physically-plausible rate whether the shot is 5s or 55s,
// and is fully deterministic (both are ordinary numeric props). Nothing
// wraps or resets abruptly — oscillators use generous periods and mote net
// drift is bounded, so no visible pop or loop within any real shot length.
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
const TAU = Math.PI * 2;

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
  lightStrength: number;
  coreStrength: number;
  driftAngleDeg: [number, number];
  driftDistance: [number, number];
  horizonRange: [number, number];
  grainOpacity: number;
  // Motion character.
  flicker: number; // 0-1, fire/candle: light + glow pulses
  wander: number; // 0-1, candle: light source wanders in a small loop
  sweepPeriodSec: number; // rake light sweep period
  sweepAmpPx: number; // rake light sweep amplitude
  glintTravel: boolean; // gold: an extra travelling specular streak
  hazeBreathe: number; // 0-1, dust/night: ambient haze pulsing
  swayPeriodRange: [number, number]; // per-mote sway period (sec)
  ambientRadius: number; // px, soft glow radius — small+tight for candle, wide for others
  skyline: boolean; // fire/dusk: a jagged ruined skyline silhouette at the horizon
  moon: boolean; // night: a crisp small disc, distinct from the ambient glow
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
    driftDistance: [160, 340],
    horizonRange: [0.58, 0.72],
    grainOpacity: 0.05,
    flicker: 0.85,
    wander: 0.15,
    sweepPeriodSec: 11,
    sweepAmpPx: 90,
    glintTravel: false,
    hazeBreathe: 0.2,
    swayPeriodRange: [1.2, 2.4],
    ambientRadius: 1200,
    skyline: true,
    moon: false,
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
    lightStrength: 0.42,
    coreStrength: 0.55,
    driftAngleDeg: [-95, -85],
    driftDistance: [30, 70],
    horizonRange: [0.72, 0.88],
    grainOpacity: 0.04,
    flicker: 0.6,
    wander: 0.9,
    sweepPeriodSec: 26,
    sweepAmpPx: 24,
    glintTravel: false,
    hazeBreathe: 0.1,
    swayPeriodRange: [2, 3.6],
    ambientRadius: 560,
    skyline: false,
    moon: false,
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
    lightStrength: 0.44,
    coreStrength: 0.26,
    driftAngleDeg: [-70, -30],
    driftDistance: [120, 260],
    horizonRange: [0.5, 0.62],
    grainOpacity: 0.07,
    flicker: 0.08,
    wander: 0,
    sweepPeriodSec: 7,
    sweepAmpPx: 160,
    glintTravel: false,
    hazeBreathe: 0.55,
    swayPeriodRange: [0.9, 1.8],
    ambientRadius: 1300,
    skyline: false,
    moon: false,
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
    lightStrength: 0.3,
    coreStrength: 0.6,
    driftAngleDeg: [-20, 20],
    driftDistance: [90, 210],
    horizonRange: [0.6, 0.74],
    grainOpacity: 0.03,
    flicker: 0.04,
    wander: 0,
    sweepPeriodSec: 34,
    sweepAmpPx: 70,
    glintTravel: false,
    hazeBreathe: 0.45,
    swayPeriodRange: [2.4, 4.2],
    ambientRadius: 900,
    skyline: false,
    moon: true,
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
    lightStrength: 0.5,
    coreStrength: 0.55,
    driftAngleDeg: [-100, -70],
    driftDistance: [70, 160],
    horizonRange: [0.62, 0.78],
    grainOpacity: 0.05,
    flicker: 0.18,
    wander: 0.1,
    sweepPeriodSec: 15,
    sweepAmpPx: 180,
    glintTravel: true,
    hazeBreathe: 0.15,
    swayPeriodRange: [1.6, 2.8],
    ambientRadius: 1100,
    skyline: false,
    moon: false,
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
    coreStrength: 0.32,
    driftAngleDeg: [-60, -20],
    driftDistance: [40, 100],
    horizonRange: [0.34, 0.42],
    grainOpacity: 0.04,
    flicker: 0.03,
    wander: 0,
    sweepPeriodSec: 48,
    sweepAmpPx: 60,
    glintTravel: false,
    hazeBreathe: 0.12,
    swayPeriodRange: [3, 5],
    ambientRadius: 1600,
    skyline: true,
    moon: false,
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
  swayPeriod: number;
  colorAlt: boolean;
  opacityBase: number;
  layer: 0 | 1; // 0 = far (slow, small), 1 = near (fast, larger)
};

export const ArchivalField: React.FC<SceneProps> = ({ progress, frame, fps, seed, options }) => {
  const opts = (options ?? {}) as ExcavationFieldOptions;
  const mood: ExcavationMood = opts.mood ?? 'dust';
  const intensity = clamp(opts.intensity ?? 0.5, 0, 1);
  const preset = MOOD_PRESETS[mood];

  const seedInt = Math.floor(clamp(seed, 0, 0.999999) * 1_000_000_007) + 17;
  const t = frame / Math.max(1, fps); // elapsed seconds within this shot

  // Composition variation, seeded once per shot.
  const comp = useMemo(() => {
    const rng = mulberry32(seedInt);
    const horizonY = lerp(preset.horizonRange[0], preset.horizonRange[1], rng()) * 1080;
    const lightX = lerp(0.12, 0.88, rng()) * 1920;
    const lightY = lerp(0.06, 0.4, rng()) * 1080;
    const rakeAngle = lerp(20, 55, rng());
    const bandCount = 6 + Math.floor(rng() * 3);
    const phaseA = rng() * TAU;
    const phaseB = rng() * TAU;
    const phaseC = rng() * TAU;
    const phaseD = rng() * TAU;
    // A jagged ruined-skyline silhouette along the horizon (fire/dusk only).
    const skylinePts: number[] = [];
    if (preset.skyline) {
      const segs = 22;
      for (let i = 0; i <= segs; i++) {
        const base = i === 0 || i === segs ? 0 : lerp(10, 95, rng());
        skylinePts.push(base);
      }
    }
    return { horizonY, lightX, lightY, rakeAngle, bandCount, phaseA, phaseB, phaseC, phaseD, skylinePts };
  }, [seedInt, preset]);

  const motes: Mote[] = useMemo(() => {
    const rng = mulberry32(seedInt + 91);
    const count = Math.round(preset.baseMotes * lerp(0.45, 1.15, intensity));
    const list: Mote[] = [];
    for (let i = 0; i < count; i++) {
      const angleDeg = lerp(preset.driftAngleDeg[0], preset.driftAngleDeg[1], rng());
      const layer: 0 | 1 = rng() < 0.4 ? 1 : 0;
      const sizeMul = layer === 1 ? lerp(1.15, 1.6, rng()) : lerp(0.6, 1, rng());
      list.push({
        x: rng() * 1920,
        y: rng() * 1080,
        r: lerp(preset.moteSize[0], preset.moteSize[1], rng()) * sizeMul,
        driftAngle: (angleDeg * Math.PI) / 180,
        driftDist: lerp(preset.driftDistance[0], preset.driftDistance[1], rng()) * (layer === 1 ? 1.25 : 0.7),
        phase: rng() * TAU,
        swayAmp: lerp(6, 26, rng()) * (layer === 1 ? 1.3 : 0.8),
        swayPeriod: lerp(preset.swayPeriodRange[0], preset.swayPeriodRange[1], rng()),
        colorAlt: rng() > 0.6,
        opacityBase: lerp(0.35, 1, rng()) * (layer === 1 ? 1 : 0.65),
        layer,
      });
    }
    // Far layer first so near motes draw on top (simple depth ordering).
    return list.sort((a, b) => a.layer - b.layer);
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
      const cTop = rng();
      const shadeAmt = lerp(-0.13, 0.13, rng());
      bands.push({
        top: cursor - top, // relative to the ground wrapper
        height: h,
        colorMix: cTop,
        shadeAmt,
        opacity: lerp(0.55, 1, rng()),
      });
      cursor += h;
    }
    return bands;
  }, [seedInt, comp]);

  // One-time reveal envelope — always progress-driven so the shot has a
  // clear arc regardless of duration.
  const revealIn = clamp(progress / 0.12, 0, 1);
  const settle = 1 - Math.pow(1 - revealIn, 3);

  // Net directional drift over the whole shot (progress-driven, monotonic,
  // never wraps) plus continuous fine motion (seconds-driven, always alive).
  const netDrift = progress;

  // Flicker: layered slow oscillators, deterministic, never a hard strobe.
  const flickerMul =
    1 +
    preset.flicker *
      (0.5 * Math.sin((t * TAU) / 1.9 + comp.phaseA) + 0.5 * Math.sin((t * TAU) / 0.7 + comp.phaseB)) *
      0.3;

  const hazeMul = 1 + preset.hazeBreathe * 0.5 * (1 + Math.sin((t * TAU) / 8.5 + comp.phaseC));

  const lightOpacity = preset.lightStrength * lerp(0.55, 1, intensity) * settle * flickerMul;
  const coreOpacity = preset.coreStrength * lerp(0.5, 1, intensity) * settle * flickerMul;

  // Light source wander (candle) + gentle continuous position drift for all.
  const wanderX = preset.wander * (Math.sin((t * TAU) / 3.4 + comp.phaseA) * 16);
  const wanderY = preset.wander * (Math.cos((t * TAU) / 2.6 + comp.phaseB) * 10);
  const lightX = comp.lightX + wanderX + Math.sin((t * TAU) / (preset.sweepPeriodSec * 1.6) + comp.phaseD) * 12;
  const lightY = comp.lightY + wanderY;

  // Raking light sweep across the ground — continuous back-and-forth via a
  // long, slow period so it never snaps or wraps.
  const sweepPx = Math.sin((t * TAU) / preset.sweepPeriodSec + comp.phaseC) * preset.sweepAmpPx;
  // Gold gets an additional, longer-period travelling specular streak.
  const glintPx = preset.glintTravel
    ? Math.sin((t * TAU) / 42 + comp.phaseD) * 640
    : 0;

  // Horizon breathes a few pixels — present, never enough to read as a cut.
  const horizonWobble = Math.sin((t * TAU) / 37 + comp.phaseB) * 5;

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

      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translateY(${horizonWobble}px)`,
        }}
      >
        {/* Ground base gradient, subtly scaling for a near-imperceptible parallax. */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: groundTopPx,
            height: groundH,
            background: `linear-gradient(180deg, ${preset.groundTop} 0%, ${preset.groundBottom} 100%)`,
            transform: `scale(${1 + 0.014 * netDrift})`,
            transformOrigin: '50% 0%',
          }}
        />

        {/* Strata banding — distinct sediment layers, each independently
            shaded off the two mood base tones. */}
        <div style={{ position: 'absolute', left: 0, right: 0, top: groundTopPx, height: groundH }}>
          {strataBands.map((b, i) => {
            const base = lerpColor(preset.strataA, preset.strataB, b.colorMix);
            const [r, g, bl] = shade(base, b.shadeAmt);
            const [r2, g2, bl2] = shade(base, b.shadeAmt - 0.09);
            const op = b.opacity * (0.6 + 0.4 * settle);
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: b.top,
                  height: b.height,
                  // A gentle internal gradient rather than a flat fill, so a
                  // band never reads as a solid highlighted bar.
                  background: `linear-gradient(180deg, ${rgbToStr([r, g, bl], op)} 0%, ${rgbToStr(
                    [r2, g2, bl2],
                    op
                  )} 100%)`,
                  borderTop: '1px solid rgba(255,235,200,0.05)',
                }}
              />
            );
          })}
        </div>

        {/* Fine soil grain — a static repeating gradient (no per-frame
            filter), gently translating for texture that isn't inert. */}
        <div
          style={{
            position: 'absolute',
            left: -60,
            right: -60,
            top: groundTopPx,
            height: groundH,
            opacity: preset.grainOpacity * hazeMul,
            mixBlendMode: 'overlay',
            transform: `translateX(${Math.sin((t * TAU) / 21 + comp.phaseA) * 22}px)`,
            background:
              'repeating-linear-gradient(115deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 1px, rgba(0,0,0,0.4) 1px, rgba(0,0,0,0.4) 3px)',
          }}
        />

        {/* Raking light across the ground — continuously sweeps, clipped to
            the ground so it reads as light grazing earth, not a full wash. */}
        <div
          style={{
            position: 'absolute',
            left: -400,
            right: -400,
            top: groundTopPx,
            height: groundH,
            background: `linear-gradient(${comp.rakeAngle}deg, rgba(0,0,0,0) 40%, ${preset.lightColor} 50%, rgba(0,0,0,0) 60%)`,
            opacity: lightOpacity * 1.2,
            mixBlendMode: 'screen',
            transform: `translateX(${netDrift * 70 - 35 + sweepPx}px)`,
          }}
        />
        {preset.glintTravel && (
          <div
            style={{
              position: 'absolute',
              left: -500,
              right: -500,
              top: groundTopPx,
              height: groundH,
              background: `linear-gradient(${comp.rakeAngle + 30}deg, rgba(0,0,0,0) 46%, ${preset.lightCore} 50%, rgba(0,0,0,0) 54%)`,
              opacity: coreOpacity * 0.35,
              mixBlendMode: 'screen',
              transform: `translateX(${glintPx}px)`,
            }}
          />
        )}
      </div>

      {/* Soft ambient glow around the light source — breathes and wanders. */}
      <div
        style={{
          position: 'absolute',
          left: lightX - preset.ambientRadius / 2,
          top: lightY - preset.ambientRadius / 2,
          width: preset.ambientRadius,
          height: preset.ambientRadius,
          background: `radial-gradient(circle at 50% 50%, ${preset.lightColor} 0%, rgba(0,0,0,0) 58%)`,
          opacity: lightOpacity * 0.5 * hazeMul,
          mixBlendMode: 'screen',
        }}
      />
      {/* Tighter bright core for a believable point-source glint. */}
      <div
        style={{
          position: 'absolute',
          left: lightX - 140,
          top: lightY - 140,
          width: 280,
          height: 280,
          background: `radial-gradient(circle at 50% 50%, ${preset.lightCore} 0%, rgba(0,0,0,0) 70%)`,
          opacity: coreOpacity * 0.7,
          mixBlendMode: 'screen',
        }}
      />

      {/* Ruined skyline silhouette at the horizon (fire / dusk). */}
      {preset.skyline && comp.skylinePts.length > 0 && (
        <svg
          width={1920}
          height={1080}
          viewBox="0 0 1920 1080"
          style={{ position: 'absolute', inset: 0, transform: `translateY(${horizonWobble}px)` }}
        >
          <polygon
            points={
              comp.skylinePts
                .map((h, i) => {
                  const x = (i / (comp.skylinePts.length - 1)) * 1920;
                  return `${x},${comp.horizonY - h}`;
                })
                .join(' ') + ` 1920,${comp.horizonY} 0,${comp.horizonY}`
            }
            fill={preset.groundBottom}
            opacity={0.85 * settle}
          />
        </svg>
      )}

      {/* Crisp moon disc, distinct from the ambient light glow (night). */}
      {preset.moon && (
        <div
          style={{
            position: 'absolute',
            left: lightX - 46,
            top: lightY - 46,
            width: 92,
            height: 92,
            borderRadius: '50%',
            background: `radial-gradient(circle at 38% 34%, ${preset.lightCore} 0%, ${preset.lightColor} 62%, rgba(0,0,0,0) 100%)`,
            opacity: 0.8 * settle * flickerMul,
            boxShadow: `0 0 60px 18px ${preset.lightColor}33`,
          }}
        />
      )}

      {/* Dust / ember motes: two depth layers with independent net drift
          (progress) and continuous sway (seconds) for real parallax. */}
      <svg
        width={1920}
        height={1080}
        viewBox="0 0 1920 1080"
        style={{ position: 'absolute', inset: 0 }}
      >
        {motes.map((m, i) => {
          const sway = Math.sin((t * TAU) / m.swayPeriod + m.phase) * m.swayAmp;
          const travel = netDrift * m.driftDist;
          const x = m.x + Math.cos(m.driftAngle) * travel + sway * (m.layer === 1 ? 1 : 0.6);
          const y = m.y + Math.sin(m.driftAngle) * travel + (m.layer === 0 ? Math.cos((t * TAU) / (m.swayPeriod * 1.7) + m.phase) * m.swayAmp * 0.4 : 0);
          if (x < -20 || x > 1940 || y < -20 || y > 1100) return null;
          const fade = inSafeAreaFade(y);
          const flick =
            preset.flicker > 0.3 ? 0.82 + 0.18 * Math.sin((t * TAU) / (m.swayPeriod * 0.6) + m.phase * 1.7) : 1;
          const op =
            m.opacityBase * intensityMoteScale(intensity) * settle * (1 - 0.6 * fade) * flick;
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
          background: 'linear-gradient(180deg, rgba(2,1,1,0) 0%, rgba(2,1,1,0.62) 60%, rgba(2,1,1,0.82) 100%)',
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 62% 20% at 50% ${
            (((SAFE_AREA.titleBandTop + SAFE_AREA.titleBandBottom) / 2) / 1080) * 100
          }%, rgba(2,1,1,0.16) 0%, rgba(2,1,1,0) 100%)`,
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

export default ArchivalField;
