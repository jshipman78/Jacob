import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import '@fontsource/inter/500.css';
import '@fontsource/cinzel/500.css';
import type { SceneProps } from './types';
import { PALETTE } from './types';

// ---------------------------------------------------------------------------
// ArtifactPlate — museum-plate treatment of the physical objects in the
// story: a gold diadem, a two-handled cup, a heap of small ornaments, a
// potsherd. Engraved-style line/fill work on a dark plate with a faint
// catalogue label, lit warmly. Shapes are kept simple, symmetrical and
// archaic — plausible Bronze Age Aegean forms, not invented fantasy
// jewellery.
//
// Motion model: the artifact's reveal, hatch build-up and label draw-in are
// driven by `progress` (a clear one-time arc). Once on screen it stays
// present and lit: a slow rotation/bob, a travelling specular highlight and
// a few dust motes crossing in front are driven off `frame/fps` (elapsed
// seconds) so the plate is never a frozen photograph, at a rate that reads
// the same whether the shot is 5s or 55s.
// ---------------------------------------------------------------------------

export type ArtifactKind = 'diadem' | 'cup' | 'hoard' | 'sherd';

export interface ArtifactPlateOptions {
  artifact?: ArtifactKind;
  label?: string;
}

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
const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const TAU = Math.PI * 2;

const DEFAULT_LABELS: Record<ArtifactKind, string> = {
  diadem: 'GOLD DIADEM — TROY II HOARD',
  cup: 'TWO-HANDLED CUP · DEPAS AMPHIKYPELLON',
  hoard: 'GOLD ORNAMENTS, ASSORTED',
  sherd: 'PAINTED POTSHERD, EARLY BRONZE AGE',
};

const GOLD_ID_GRAD = 'artifactGoldGrad';
const GOLD_ID_GRAD_SOFT = 'artifactGoldGradSoft';

// A per-item build-in used across artifacts: index i of n reveals across
// the [start, end] fraction of `progress`, staggered evenly.
function buildIn(progress: number, i: number, n: number, start: number, end: number, span = 0.16) {
  const t = n <= 1 ? start : lerp(start, end, i / Math.max(1, n - 1));
  return easeOutCubic((progress - t) / span);
}

// ---------------------------------------------------------------------------
// Individual artifact drawings, in a local -300..300 / -300..300 viewBox
// centered on the object.
// ---------------------------------------------------------------------------

const Diadem: React.FC<{ rng: () => number; progress: number }> = ({ rng, progress }) => {
  const bandPath = 'M -230 -18 Q 0 46 230 -18';
  const fringeCount = 17;
  const fringe = Array.from({ length: fringeCount }, (_, i) => {
    const t = i / (fringeCount - 1);
    const x = lerp(-222, 222, t);
    const bandY = -18 + (46 - -18) * (4 * t * (1 - t));
    const len = 26 + 10 * Math.sin(t * Math.PI) + rng() * 6;
    return { x, y: bandY, len };
  });
  const endChain = (side: number) =>
    Array.from({ length: 6 }, (_, i) => ({
      x: side * (230 + i * 3),
      y: -12 + i * 44,
    }));

  const bandDraw = easeOutCubic((progress - 0.02) / 0.24);

  return (
    <g>
      <path
        d={bandPath}
        fill="none"
        stroke={`url(#${GOLD_ID_GRAD})`}
        strokeWidth={14}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - bandDraw}
      />
      <path d={bandPath} fill="none" stroke="rgba(20,12,4,0.35)" strokeWidth={2} strokeDasharray="1 13" opacity={bandDraw} />
      {Array.from({ length: 13 }, (_, i) => {
        const tt = i / 12;
        const x = lerp(-222, 222, tt);
        const bandY = -18 + (46 - -18) * (4 * tt * (1 - tt));
        return <circle key={i} cx={x} cy={bandY} r={4.4} fill="#3a2a12" opacity={0.5 * bandDraw} />;
      })}
      {fringe.map((f, i) => {
        const a = buildIn(progress, i, fringe.length, 0.22, 0.55);
        return (
          <g key={i} opacity={a}>
            <line
              x1={f.x}
              y1={f.y}
              x2={f.x}
              y2={f.y + f.len * a}
              stroke={`url(#${GOLD_ID_GRAD})`}
              strokeWidth={2.4}
              strokeLinecap="round"
            />
            <circle cx={f.x} cy={f.y + f.len * a + 3} r={3.6} fill={`url(#${GOLD_ID_GRAD})`} />
          </g>
        );
      })}
      {[-1, 1].map((side, si) => {
        const a = buildIn(progress, si, 2, 0.5, 0.6);
        return (
          <g key={side} opacity={a}>
            {endChain(side).map((c, i) => (
              <circle
                key={i}
                cx={c.x}
                cy={c.y}
                r={5}
                fill="none"
                stroke={`url(#${GOLD_ID_GRAD})`}
                strokeWidth={2.4}
              />
            ))}
            <path
              d={`M ${side * 230} 250 q ${side * 14} 18 0 34 q ${side * -14} -16 0 -34 Z`}
              fill={`url(#${GOLD_ID_GRAD})`}
            />
          </g>
        );
      })}
    </g>
  );
};

const Cup: React.FC<{ rng: () => number; progress: number }> = ({ rng, progress }) => {
  const bodyPath =
    'M -70 -230 C -92 -190 -96 -120 -80 -40 C -66 26 -70 90 -96 150 C -104 172 -70 190 0 190 C 70 190 104 172 96 150 C 70 90 66 26 80 -40 C 96 -120 92 -190 70 -230 Z';
  const rimPath = 'M -70 -230 C -30 -244 30 -244 70 -230';
  const handle = (side: number) =>
    `M ${side * 78} -160 C ${side * 168} -150 ${side * 168} -20 ${side * 82} 10`;

  const bodyIn = easeOutCubic((progress - 0.02) / 0.3);
  const hatchLines = 9;

  return (
    <g>
      <path d={bodyPath} fill={`url(#${GOLD_ID_GRAD})`} stroke="#2a1c0c" strokeWidth={2.5} opacity={bodyIn} />
      <path d={rimPath} fill="none" stroke="#3a2712" strokeWidth={3} opacity={0.6 * bodyIn} />
      {[-1, 1].map((side, si) => {
        const a = buildIn(progress, si, 2, 0.24, 0.4);
        return (
          <path
            key={side}
            d={handle(side)}
            fill="none"
            stroke={`url(#${GOLD_ID_GRAD})`}
            strokeWidth={13}
            strokeLinecap="round"
            opacity={a}
          />
        );
      })}
      <path d="M -50 188 Q 0 210 50 188 L 40 200 Q 0 216 -40 200 Z" fill={`url(#${GOLD_ID_GRAD_SOFT})`} opacity={bodyIn} />
      {/* Engraved shading hatch, built up in sequence like a plate print. */}
      {Array.from({ length: hatchLines }, (_, i) => {
        const y = -190 + i * 42 + rng() * 6;
        const a = buildIn(progress, i, hatchLines, 0.38, 0.7, 0.12);
        return (
          <line
            key={i}
            x1={12}
            y1={y}
            x2={12 + (70 - i * 2 - 12) * a}
            y2={y + 14 * a}
            stroke="#241708"
            strokeWidth={1.4}
            opacity={0.35 * a}
          />
        );
      })}
    </g>
  );
};

const Hoard: React.FC<{ rng: () => number; progress: number }> = ({ rng, progress }) => {
  type Bit = { x: number; y: number; s: number; kind: number };
  const bits: Bit[] = useMemo(() => {
    const list: Bit[] = [];
    const n = 46;
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2;
      const rad = Math.pow(rng(), 0.55) * 210;
      const x = Math.cos(a) * rad;
      const y = Math.sin(a) * rad * 0.55 - 20;
      list.push({ x, y, s: 6 + rng() * 15, kind: Math.floor(rng() * 4) });
    }
    return list.sort((p, q) => p.y - q.y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <g>
      {bits.map((b, i) => {
        const a = buildIn(progress, i, bits.length, 0.03, 0.55, 0.1);
        const s = 0.85 + 0.15 * a;
        const shapeProps = { opacity: a, transform: `translate(${b.x} ${b.y}) scale(${s})` };
        if (b.kind === 0) {
          return (
            <circle key={i} cx={0} cy={0} r={b.s * 0.5} fill={`url(#${GOLD_ID_GRAD})`} {...shapeProps} />
          );
        }
        if (b.kind === 1) {
          return (
            <circle
              key={i}
              cx={0}
              cy={0}
              r={b.s * 0.5}
              fill="none"
              stroke={`url(#${GOLD_ID_GRAD})`}
              strokeWidth={Math.max(1.6, b.s * 0.16)}
              {...shapeProps}
            />
          );
        }
        if (b.kind === 2) {
          return (
            <ellipse
              key={i}
              cx={0}
              cy={0}
              rx={b.s * 0.55}
              ry={b.s * 0.32}
              fill={`url(#${GOLD_ID_GRAD_SOFT})`}
              {...shapeProps}
            />
          );
        }
        return (
          <path
            key={i}
            d={`M ${-b.s * 0.5} 0 q ${b.s * 0.25} ${-b.s * 0.6} ${b.s * 0.5} 0 q ${b.s * 0.25} ${
              b.s * 0.6
            } -${b.s * 0.5} 0 Z`}
            fill={`url(#${GOLD_ID_GRAD})`}
            {...shapeProps}
          />
        );
      })}
    </g>
  );
};

const Sherd: React.FC<{ rng: () => number; progress: number }> = ({ rng, progress }) => {
  const outline =
    'M -170 40 C -140 90 -60 120 10 118 C 90 116 150 84 176 30 L 150 -18 L 168 -60 L 118 -84 L 132 -128 L 70 -150 L 40 -196 L -10 -166 L -54 -190 L -78 -140 L -132 -150 L -110 -96 L -160 -70 L -128 -20 Z';
  const arcs = [50, 90, 132];
  const bodyIn = easeOutCubic((progress - 0.02) / 0.3);
  const hatch = 8;

  return (
    <g>
      <path d={outline} fill={`url(#${GOLD_ID_GRAD_SOFT})`} stroke="#241a10" strokeWidth={2.5} opacity={bodyIn} />
      {arcs.map((r, i) => {
        const a = buildIn(progress, i, arcs.length, 0.3, 0.55, 0.14);
        return (
          <path
            key={i}
            d={`M ${-r} 10 A ${r} ${r} 0 0 1 ${r} 10`}
            fill="none"
            stroke="#2c1d0e"
            strokeWidth={3.2}
            opacity={(0.55 - i * 0.1) * a}
            transform="translate(0 -30)"
          />
        );
      })}
      {Array.from({ length: hatch }, (_, i) => {
        const x = -140 + i * 36 + rng() * 8;
        const a = buildIn(progress, i, hatch, 0.42, 0.68, 0.12);
        return (
          <line key={i} x1={x} y1={-160} x2={x + 6} y2={-160 + 260 * a} stroke="#1c130a" strokeWidth={1} opacity={0.18 * a} />
        );
      })}
    </g>
  );
};

export const ArtifactPlate: React.FC<SceneProps> = ({ progress, frame, fps, seed, options }) => {
  const opts = (options ?? {}) as ArtifactPlateOptions;
  const artifact: ArtifactKind = opts.artifact ?? 'diadem';
  const label = opts.label ?? DEFAULT_LABELS[artifact];
  const t = frame / Math.max(1, fps);

  const seedInt = Math.floor(clamp(seed, 0, 0.999999) * 1_000_000_007) + 53;
  const rng = useMemo(() => mulberry32(seedInt), [seedInt]);
  const phase = useMemo(() => rng() * TAU, [rng]);
  const phase2 = useMemo(() => rng() * TAU, [rng]);
  const plateJitter = useMemo(() => ({ dx: (rng() - 0.5) * 6, dy: (rng() - 0.5) * 6 }), [rng]);

  const dustMotes = useMemo(() => {
    const n = 12;
    return Array.from({ length: n }, () => ({
      x: rng() * 640 - 320,
      y: rng() * 640 - 320,
      r: 1 + rng() * 2.2,
      speed: lerp(8, 22, rng()),
      angle: rng() * TAU,
      phase: rng() * TAU,
    }));
  }, [rng]);

  const revealIn = easeOutCubic(progress / 0.18);
  const scale = lerp(0.94, 1, revealIn);
  const opacity = revealIn;

  // Slow, continuous pendulum rotation + bob — always alive, independent of
  // shot length.
  const rotate = Math.sin((t * TAU) / 17 + phase) * 1.5;
  const bob = Math.sin((t * TAU) / 12 + phase * 0.7) * 5;
  const microScale = 1 + 0.006 * Math.sin((t * TAU) / 9 + phase2);

  // Travelling specular highlight across the metal.
  const sweepT = (Math.sin((t * TAU) / 13 + phase2) + 1) / 2; // 0..1, oscillates slowly

  const plateCX = 960 + plateJitter.dx;
  const plateCY = 478 + plateJitter.dy;
  const plateR = 320;

  const labelDraw = easeOutCubic((progress - 0.55) / 0.22);

  return (
    <AbsoluteFill style={{ backgroundColor: PALETTE.ink }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${plateCX}px ${plateCY}px, #1c130a 0%, #0c0805 55%, ${PALETTE.ink} 100%)`,
        }}
      />
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <linearGradient id={GOLD_ID_GRAD} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={PALETTE.goldBright} />
            <stop offset="55%" stopColor={PALETTE.gold} />
            <stop offset="100%" stopColor={PALETTE.bronze} />
          </linearGradient>
          <linearGradient id={GOLD_ID_GRAD_SOFT} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={PALETTE.gold} />
            <stop offset="100%" stopColor="#6b4d24" />
          </linearGradient>
          <radialGradient id="plateRim" cx="50%" cy="42%" r="60%">
            <stop offset="0%" stopColor="rgba(255,224,170,0.09)" />
            <stop offset="80%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <clipPath id="plateClip">
            <circle cx={plateCX} cy={plateCY} r={plateR} />
          </clipPath>
        </defs>

        {/* Plate rim rings. */}
        <circle cx={plateCX} cy={plateCY} r={plateR} fill="url(#plateRim)" />
        <circle cx={plateCX} cy={plateCY} r={plateR} fill="none" stroke="#3a2a16" strokeWidth={2} opacity={0.5} />
        <circle cx={plateCX} cy={plateCY} r={plateR - 14} fill="none" stroke="#2a1c0e" strokeWidth={1} opacity={0.35} />

        {/* Artifact group: gentle continuous drift + progress-driven build-in. */}
        <g
          transform={`translate(${plateCX} ${plateCY + bob}) rotate(${rotate}) scale(${scale * microScale * 0.62})`}
          opacity={opacity}
        >
          {artifact === 'diadem' && <Diadem rng={rng} progress={progress} />}
          {artifact === 'cup' && <Cup rng={rng} progress={progress} />}
          {artifact === 'hoard' && <Hoard rng={rng} progress={progress} />}
          {artifact === 'sherd' && <Sherd rng={rng} progress={progress} />}
        </g>

        {/* Travelling specular highlight, clipped to the plate. */}
        <g clipPath="url(#plateClip)" opacity={0.3 * revealIn}>
          <rect
            x={plateCX - plateR + (plateR * 2.6) * sweepT - plateR * 1.3}
            y={plateCY - plateR}
            width={plateR * 0.7}
            height={plateR * 2}
            fill="url(#plateRim)"
            style={{ mixBlendMode: 'screen' }}
            transform={`skewX(-18)`}
          />
        </g>

        {/* Dust motes drifting across, in front of the artifact. */}
        <g clipPath="url(#plateClip)">
          {dustMotes.map((m, i) => {
            const travel = t * m.speed;
            const x = plateCX + m.x + Math.cos(m.angle) * travel * 0.15 + Math.sin(t * TAU / 6 + m.phase) * 14;
            const y = plateCY + m.y + Math.sin(m.angle) * travel * 0.15 + Math.cos(t * TAU / 7 + m.phase) * 10;
            const op = 0.22 + 0.15 * Math.sin(t * TAU / 4 + m.phase);
            return <circle key={i} cx={x} cy={y} r={m.r} fill={PALETTE.bone} opacity={Math.max(0, op) * revealIn} />;
          })}
        </g>

        {/* Catalogue label, drawing in after the artifact settles. */}
        <g opacity={0.55 * clamp(labelDraw, 0, 1)}>
          <line
            x1={plateCX - 90}
            y1={plateCY + plateR - 46}
            x2={plateCX - 90 + 180 * clamp(labelDraw, 0, 1)}
            y2={plateCY + plateR - 46}
            stroke={PALETTE.ash}
            strokeWidth={1}
          />
          <text
            x={plateCX}
            y={plateCY + plateR - 20}
            textAnchor="middle"
            fill={PALETTE.bone}
            fontFamily='"Inter", sans-serif'
            fontWeight={500}
            fontSize={18}
            letterSpacing={2.4}
          >
            {label.toUpperCase()}
          </text>
        </g>
      </svg>

      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse 65% 60% at 50% 46%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.78) 100%)',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};

export default ArtifactPlate;
