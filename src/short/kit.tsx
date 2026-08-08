/**
 * Shared drawing and timing kit for the short.
 *
 * Same performance contract as the film's engraving layer: no SVG filter
 * primitive runs on any frame, static texture is built once at module scope,
 * and everything that moves is a transform, an opacity or a stroke-dashoffset.
 * A short is only 900 frames, but it is 1080x1920 and almost every frame has
 * something moving on it, so the discipline still pays.
 */

import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { rngFor, lerp, clamp01 } from '../scenes/engraving/rand';
import { easeOutCubic, easeOutExpo, easeOutQuint } from '../scenes/engraving/timing';
import { SHORT_W, SHORT_H, C } from './theme';

export { easeOutCubic, easeOutExpo, easeOutQuint };
export const easeInOut = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

/** Seconds since this Sequence began. Every scene is written in seconds. */
export const useT = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
};

/** 0→1 over [a,b], clamped. The workhorse. */
export const ramp = (t: number, a: number, b: number) => clamp01((t - a) / (b - a || 1));

/** 0→1→0 across [a,b,c,d]. */
export const band = (t: number, a: number, b: number, c: number, d: number) =>
  t < b ? ramp(t, a, b) : t < c ? 1 : 1 - ramp(t, c, d);

/** An overshoot that settles — the motion signature of the whole piece. */
export const springy = (t: number, damping = 7, freq = 11) => {
  if (t <= 0) return 0;
  return 1 - Math.exp(-damping * t) * Math.cos(freq * t);
};

/** A struck-once decay, for stamps, impacts and flashes. */
export const strike = (t: number, at: number, decay = 9) =>
  t < at ? 0 : Math.exp(-(t - at) * decay);

// ---------------------------------------------------------------------------
// Substrate
// ---------------------------------------------------------------------------

/** Paper speckle and plate pitting. Built once, never animated. */
const GRAIN = (() => {
  const rand = rngFor(0.30103, 'short-grain');
  const parts: string[] = [];
  for (let i = 0; i < 900; i++) {
    const x = rand() * SHORT_W;
    const y = rand() * SHORT_H;
    const r = lerp(0.4, 1.6, rand() * rand());
    parts.push(
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="#e8dcc4" opacity="${lerp(0.02, 0.08, rand()).toFixed(3)}"/>`
    );
  }
  for (let i = 0; i < 300; i++) {
    const x = rand() * SHORT_W;
    const y = rand() * SHORT_H;
    const r = lerp(0.6, 2.8, rand() * rand());
    parts.push(
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}" fill="#000" opacity="${lerp(0.05, 0.15, rand()).toFixed(3)}"/>`
    );
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SHORT_W}" height="${SHORT_H}">${parts.join('')}</svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
})();

/**
 * The block the whole short is printed on: warm near-black ground, laid-paper
 * ruling, static grain, and a vignette that keeps the eye centred on a phone.
 */
export const Plate: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: C.ink }}>
    <AbsoluteFill
      style={{
        background: `radial-gradient(120% 80% at 50% 34%, ${C.inkWarm} 0%, ${C.inkMid} 42%, ${C.ink} 78%)`,
      }}
    />
    {/* Laid lines — free, and the real thing is this regular. */}
    <AbsoluteFill
      style={{
        backgroundImage:
          'repeating-linear-gradient(0deg, rgba(232,220,196,0.030) 0px, rgba(232,220,196,0.030) 1px, transparent 1px, transparent 7px)',
        opacity: 0.5,
      }}
    />
    <AbsoluteFill style={{ backgroundImage: GRAIN, opacity: 0.9 }} />
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(78% 52% at 50% 44%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)',
      }}
    />
  </AbsoluteFill>
);

// ---------------------------------------------------------------------------
// Marks
// ---------------------------------------------------------------------------

/**
 * A stroke that draws itself on. `p` is 0→1 progress along the path; the dash
 * length is deliberately over-estimated rather than measured, which costs one
 * frame of nothing and avoids a layout read per path per frame.
 */
export const Draw: React.FC<{
  d: string;
  p: number;
  len: number;
  stroke?: string;
  width?: number;
  opacity?: number;
  dash?: string;
  cap?: 'round' | 'butt';
}> = ({ d, p, len, stroke = C.cut, width = 2, opacity = 1, dash, cap = 'round' }) => (
  <path
    d={d}
    fill="none"
    stroke={stroke}
    strokeWidth={width}
    strokeLinecap={cap}
    strokeLinejoin="round"
    opacity={opacity}
    strokeDasharray={dash ?? `${len} ${len}`}
    strokeDashoffset={dash ? undefined : len * (1 - clamp01(p))}
  />
);

/** Hatching: tone built from strokes, never a flat fill. */
export const Hatch: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  pitch?: number;
  angle?: number;
  stroke?: string;
  opacity?: number;
  p?: number;
  seed?: number;
}> = ({ x, y, w, h, pitch = 9, angle = -32, stroke = C.cut, opacity = 0.32, p = 1, seed = 3 }) => {
  const lines = useMemo(() => {
    const rand = rngFor(seed, 'hatch');
    const out: { d: string; k: number }[] = [];
    const rad = (angle * Math.PI) / 180;
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);
    const span = Math.hypot(w, h);
    const n = Math.ceil(span / pitch);
    for (let i = -n; i < n; i++) {
      const ox = x + w / 2 + -dy * i * pitch;
      const oy = y + h / 2 + dx * i * pitch;
      const jitter = (rand() - 0.5) * 2.2;
      out.push({
        d: `M ${(ox - dx * span) / 1} ${oy - dy * span} L ${ox + dx * span + jitter} ${oy + dy * span}`,
        k: rand(),
      });
    }
    return out;
  }, [x, y, w, h, pitch, angle, seed]);

  const clipId = `hatchclip-${seed}-${Math.round(x)}-${Math.round(y)}`;
  return (
    <g clipPath={`url(#${clipId})`}>
      <defs>
        <clipPath id={clipId}>
          <rect x={x} y={y} width={w} height={h} />
        </clipPath>
      </defs>
      {lines.map((l, i) => (
        <path
          key={i}
          d={l.d}
          stroke={stroke}
          strokeWidth={0.8 + l.k * 0.9}
          opacity={opacity * clamp01((p - (i / lines.length) * 0.35) * 3)}
          fill="none"
        />
      ))}
    </g>
  );
};

/**
 * A rule with a stop at each end — the engraved way to say "this measures
 * something". Draws from the centre out.
 */
export const Rule: React.FC<{
  x1: number;
  x2: number;
  y: number;
  p: number;
  stroke?: string;
  width?: number;
}> = ({ x1, x2, y, p, stroke = C.gold, width = 2 }) => {
  const mid = (x1 + x2) / 2;
  const half = ((x2 - x1) / 2) * clamp01(p);
  return (
    <g stroke={stroke} strokeWidth={width} opacity={clamp01(p * 3)}>
      <line x1={mid - half} x2={mid + half} y1={y} y2={y} />
      <line x1={mid - half} x2={mid - half} y1={y - 9} y2={y + 9} opacity={p > 0.9 ? 1 : 0} />
      <line x1={mid + half} x2={mid + half} y1={y - 9} y2={y + 9} opacity={p > 0.9 ? 1 : 0} />
    </g>
  );
};

/** Small caps label in the channel's display face. */
export const Label: React.FC<{
  children: React.ReactNode;
  size?: number;
  color?: string;
  track?: number;
  weight?: number;
  font?: string;
  style?: React.CSSProperties;
}> = ({ children, size = 26, color = C.cutDim, track = 6, weight = 600, font, style }) => (
  <div
    style={{
      fontFamily: font ?? '"Inter", system-ui, sans-serif',
      fontSize: size,
      letterSpacing: track,
      color,
      fontWeight: weight,
      textTransform: 'uppercase',
      ...style,
    }}
  >
    {children}
  </div>
);
