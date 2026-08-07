import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import type { SceneProps } from '../types';
import {
  rngFor, makeFbm1D, lerp, clamp01,
  ramp, stagger, settle, pulse, onNs,
  easeInOutCubic, easeOutCubic, easeOutQuint,
} from '../engraving';

/**
 * GraphicScene — comparison style: BOLD MOTION GRAPHICS.
 *
 * Flat colour fields, a hard editorial grid, oversized type used as image, and
 * everything cut on the beat. No texture, no illustration, no atmosphere —
 * shapes and words moving with confidence.
 *
 * The trade-off this style makes is the opposite of the cinematic one: it is
 * unbeatable at stating a fact — a number can be 400px tall and land like a
 * hammer — and it has no way at all to evoke a place or a period. Nothing here
 * looks like 1873.
 *
 * Built for the comparison reel only — it covers the three shots in the
 * one-minute window, not the whole film.
 *
 * options: subject: 'field' | 'trench' | 'strata'
 */

const W = 1920;
const H = 1080;

const INK = '#0d0d0f';
const PAPER = '#ece4d6';
const RED = '#c8341e';
const GOLD = '#e0a92c';
const BLUE = '#1c3f5c';

type Subject = 'field' | 'trench' | 'strata';
type Options = { subject?: Subject };

const CITIES = [
  { id: 'IX', years: '85 BCE–500 CE' },
  { id: 'VIII', years: '950–85 BCE' },
  { id: 'VIIb', years: '1180–950 BCE' },
  { id: 'VIIa', years: '1300–1180 BCE' },
  { id: 'VI', years: '1700–1300 BCE' },
  { id: 'V', years: '1900–1700 BCE' },
  { id: 'IV', years: '2200–1900 BCE' },
  { id: 'III', years: '2350–2200 BCE' },
  { id: 'II', years: '2600–2350 BCE' },
  { id: 'I', years: '3000–2550 BCE' },
];

export const GraphicScene: React.FC<SceneProps> = ({
  progress, frame, fps, seed, options,
}) => {
  const subject = ((options ?? {}) as Options).subject ?? 'field';
  const p = clamp01(progress);

  const geo = useMemo(() => {
    const rand = rngFor(seed, `gfx-${subject}`);
    // Editorial grid: 12 columns, 8 rows.
    const cols = Array.from({ length: 13 }, (_, i) => (i * W) / 12);
    const rows = Array.from({ length: 9 }, (_, i) => (i * H) / 8);
    const blocks = Array.from({ length: 14 }, () => ({
      c: Math.floor(rand() * 12),
      r: Math.floor(rand() * 8),
      cw: 1 + Math.floor(rand() * 3),
      rh: 1 + Math.floor(rand() * 2),
      color: [RED, GOLD, BLUE, INK][Math.floor(rand() * 4)],
      k: rand(),
    }));
    return { cols, rows, blocks };
  }, [seed, subject]);

  // Everything is cut on a beat: a 0.9s pulse grid, so shapes snap rather
  // than drift. This is the style's whole signature.
  const beat = Math.floor((p * 1000) / 62);
  const beatPhase = ((p * 1000) / 62) % 1;
  const kick = Math.exp(-beatPhase * 6);

  const tGrid = ramp(p, 0.0, 0.06);
  const tBlocks = ramp(p, 0.02, 0.22);

  return (
    <AbsoluteFill style={{ backgroundColor: PAPER, overflow: 'hidden' }}>
      {/* Grid. */}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute' }}>
        {geo.cols.map((x, i) => (
          <line
            key={`c${i}`}
            x1={x} y1={0} x2={x} y2={H * easeOutQuint(clamp01(tGrid * 2 - i * 0.04))}
            stroke={INK} strokeWidth={1} opacity={0.10}
          />
        ))}
        {geo.rows.map((y, i) => (
          <line
            key={`r${i}`}
            x1={0} y1={y} x2={W * easeOutQuint(clamp01(tGrid * 2 - i * 0.05))} y2={y}
            stroke={INK} strokeWidth={1} opacity={0.10}
          />
        ))}
      </svg>

      {/* Colour blocks, snapping in on the beat. */}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute' }}>
        {geo.blocks.map((b, i) => {
          const bt = stagger(tBlocks, i, geo.blocks.length, 0.05, 0.16);
          if (bt <= 0.02) return null;
          const s = easeOutQuint(bt);
          const x = (b.c * W) / 12;
          const y = (b.r * H) / 8;
          const w = ((b.cw * W) / 12) * s;
          const h = (b.rh * H) / 8;
          return (
            <rect
              key={i}
              x={x} y={y} width={w} height={h}
              fill={b.color}
              opacity={0.10 + b.k * 0.10}
            />
          );
        })}
      </svg>

      {subject === 'field' ? (
        <>
          {/* A single enormous silhouette bar, and a headline used as image. */}
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute' }}>
            <rect
              x={0} y={620}
              width={W} height={200 * easeOutQuint(ramp(p, 0.06, 0.24))}
              fill={INK}
            />
            <rect
              x={0} y={620 - 90 * easeOutQuint(ramp(p, 0.2, 0.38))}
              width={W * 0.62} height={90 * easeOutQuint(ramp(p, 0.2, 0.38))}
              fill={RED}
            />
          </svg>
          <Headline
            top={150}
            lines={['150', 'WORKMEN']}
            t={ramp(p, 0.12, 0.34)}
            size={190}
            colors={[RED, INK]}
          />
          <Kicker top={420} text="HISARLIK · 1871" t={ramp(p, 0.3, 0.44)} />
        </>
      ) : null}

      {subject === 'trench' ? (
        <>
          {/* The cut, as a hard graphic wipe straight down the frame. */}
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute' }}>
            <rect x={0} y={280} width={W} height={520} fill={INK} opacity={0.92} />
            {/* The trench itself: a paper-coloured void punched through. */}
            <rect
              x={700} y={280}
              width={480}
              height={520 * easeOutQuint(ramp(p, 0.12, 0.42))}
              fill={PAPER}
            />
            <rect
              x={700} y={280}
              width={480}
              height={12}
              fill={RED}
              opacity={easeOutQuint(ramp(p, 0.1, 0.2))}
            />
            {/* Depth ruler. */}
            <rect
              x={620} y={280}
              width={5}
              height={520 * easeOutQuint(ramp(p, 0.16, 0.5))}
              fill={RED}
            />
          </svg>
          <Headline
            top={116}
            lines={['16 METRES', 'STRAIGHT DOWN']}
            t={ramp(p, 0.2, 0.42)}
            size={104}
            colors={[INK, RED]}
          />
          <div
            style={{
              position: 'absolute', left: 700, top: 812, width: 480,
              textAlign: 'center',
              opacity: ramp(p, 0.5, 0.64),
              fontFamily: "'Inter', sans-serif", fontWeight: 700,
              fontSize: 27, letterSpacing: 3, color: INK,
            }}
          >
            NINE CITIES, MOSTLY UNRECORDED
          </div>
        </>
      ) : null}

      {subject === 'strata' ? (
        <>
          {/* The stack, as ten flat bars that snap in from the bottom up. */}
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute' }}>
            {CITIES.slice().reverse().map((c, i) => {
              const bt = stagger(ramp(p, 0.01, 0.26), i, CITIES.length, 0.055, 0.2);
              if (bt <= 0.02) return null;
              const s = easeOutQuint(bt);
              const y = 810 - i * 64;
              const isHot = c.id === 'VIIa' || c.id === 'II';
              return (
                <g key={c.id}>
                  <rect
                    x={520} y={y}
                    width={1040 * s} height={54}
                    fill={c.id === 'II' ? GOLD : c.id === 'VIIa' ? RED : INK}
                    opacity={isHot ? 1 : 0.14 + (i % 3) * 0.05}
                  />
                  <text
                    x={490} y={y + 39}
                    textAnchor="end"
                    fill={INK}
                    opacity={clamp01((bt - 0.4) / 0.6)}
                    style={{ fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: 34, letterSpacing: 1 }}
                  >
                    {c.id}
                  </text>
                  <text
                    x={1580} y={y + 36}
                    fill={INK}
                    opacity={clamp01((bt - 0.5) / 0.5) * 0.55}
                    style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 20, letterSpacing: 1 }}
                  >
                    {c.years}
                  </text>
                </g>
              );
            })}
          </svg>
          <Headline
            top={126}
            lines={['NINE', 'CITIES']}
            t={ramp(p, 0.0, 0.08)}
            size={122}
            colors={[INK, RED]}
          />
        </>
      ) : null}

      {/* A hard accent rule that snaps across on every beat — the metronome. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: W,
          height: 8,
          background: beat % 2 === 0 ? RED : GOLD,
          transform: `scaleX(${(0.2 + 0.8 * (1 - beatPhase)).toFixed(3)})`,
          transformOrigin: beat % 2 === 0 ? 'left' : 'right',
          opacity: 0.9,
        }}
      />

      {/* Keep the caption band clean — this style is bright, and the burned-in
          subtitles are light type, so the foot of the frame is knocked back to
          ink here rather than left as paper. */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, rgba(13,13,15,0) 68%, rgba(13,13,15,0.86) 82%, rgba(13,13,15,0.97) 100%)`,
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};

const Headline: React.FC<{
  top: number; lines: string[]; t: number; size: number; colors: string[];
}> = ({ top, lines, t, size, colors }) => (
  <div style={{ position: 'absolute', left: 96, top, pointerEvents: 'none' }}>
    {lines.map((l, i) => {
      const lt = stagger(t, i, lines.length, 0.3, 0.4);
      if (lt <= 0.01) return null;
      const s = easeOutQuint(lt);
      return (
        <div
          key={i}
          style={{
            overflow: 'hidden',
            height: size * 1.02,
          }}
        >
          <div
            style={{
              transform: `translateY(${((1 - s) * size).toFixed(1)}px)`,
              fontFamily: "'Inter', sans-serif",
              fontWeight: 800,
              fontSize: size,
              lineHeight: 1.0,
              letterSpacing: -size * 0.035,
              color: colors[i % colors.length],
            }}
          >
            {l}
          </div>
        </div>
      );
    })}
  </div>
);

const Kicker: React.FC<{ top: number; text: string; t: number }> = ({ top, text, t }) => (
  <div
    style={{
      position: 'absolute', left: 100, top,
      opacity: clamp01(t),
      transform: `translateX(${((1 - easeOutQuint(clamp01(t))) * -24).toFixed(1)}px)`,
      fontFamily: "'Inter', sans-serif", fontWeight: 700,
      fontSize: 26, letterSpacing: 6, color: INK,
      pointerEvents: 'none',
    }}
  >
    {text}
  </div>
);
