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
// catalogue label, lit warmly, drifting almost imperceptibly. Shapes are
// kept simple, symmetrical and archaic — plausible Bronze Age Aegean forms,
// not invented fantasy jewellery.
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

const DEFAULT_LABELS: Record<ArtifactKind, string> = {
  diadem: 'GOLD DIADEM — TROY II HOARD',
  cup: 'TWO-HANDLED CUP · DEPAS AMPHIKYPELLON',
  hoard: 'GOLD ORNAMENTS, ASSORTED',
  sherd: 'PAINTED POTSHERD, EARLY BRONZE AGE',
};

const GOLD_ID_GRAD = 'artifactGoldGrad';
const GOLD_ID_GRAD_SOFT = 'artifactGoldGradSoft';

// ---------------------------------------------------------------------------
// Individual artifact drawings, in a local -300..300 / -300..300 viewBox
// centered on the object. Kept as simple archaic silhouettes with a handful
// of engraving-style hatch lines for shading.
// ---------------------------------------------------------------------------

const Diadem: React.FC<{ rng: () => number }> = ({ rng }) => {
  // Shallow browband arc with a fine fringe, plus two longer end-chains —
  // matching the general form of Aegean Early Bronze Age gold headdresses.
  const bandPath = 'M -230 -18 Q 0 46 230 -18';
  const fringeCount = 17;
  const fringe = Array.from({ length: fringeCount }, (_, i) => {
    const t = i / (fringeCount - 1);
    const x = lerp(-222, 222, t);
    const y = -18 + 64 * (t - t * t) * 4 * 0.5 + 46 * Math.sin(t * Math.PI) * 0.0; // approx band y
    const bandY = -18 + (46 - -18) * (4 * t * (1 - t)); // quadratic approx of band curve
    const len = 26 + 10 * Math.sin(t * Math.PI) + rng() * 6;
    return { x, y: bandY, len };
  });
  const endChain = (side: number) =>
    Array.from({ length: 6 }, (_, i) => ({
      x: side * (230 + i * 3),
      y: -12 + i * 44,
    }));

  return (
    <g>
      {/* hanging fringe */}
      {fringe.map((f, i) => (
        <g key={i}>
          <line
            x1={f.x}
            y1={f.y}
            x2={f.x}
            y2={f.y + f.len}
            stroke={`url(#${GOLD_ID_GRAD})`}
            strokeWidth={2.4}
            strokeLinecap="round"
          />
          <circle cx={f.x} cy={f.y + f.len + 3} r={3.6} fill={`url(#${GOLD_ID_GRAD})`} />
        </g>
      ))}
      {/* two long end-chains */}
      {[-1, 1].map((side) =>
        endChain(side).map((c, i) => (
          <circle
            key={`${side}-${i}`}
            cx={c.x}
            cy={c.y}
            r={5}
            fill="none"
            stroke={`url(#${GOLD_ID_GRAD})`}
            strokeWidth={2.4}
          />
        ))
      )}
      {[-1, 1].map((side) => (
        <path
          key={`leaf-${side}`}
          d={`M ${side * 230} 250 q ${side * 14} 18 0 34 q ${side * -14} -16 0 -34 Z`}
          fill={`url(#${GOLD_ID_GRAD})`}
        />
      ))}
      {/* band with repoussé bosses */}
      <path d={bandPath} fill="none" stroke={`url(#${GOLD_ID_GRAD})`} strokeWidth={14} strokeLinecap="round" />
      <path d={bandPath} fill="none" stroke="rgba(20,12,4,0.35)" strokeWidth={2} strokeDasharray="1 13" />
      {Array.from({ length: 13 }, (_, i) => {
        const t = i / 12;
        const x = lerp(-222, 222, t);
        const bandY = -18 + (46 - -18) * (4 * t * (1 - t));
        return <circle key={i} cx={x} cy={bandY} r={4.4} fill="#3a2a12" opacity={0.5} />;
      })}
    </g>
  );
};

const Cup: React.FC<{ rng: () => number }> = ({ rng }) => {
  // "Depas amphikypellon" silhouette: tall two-handled beaker on a small
  // foot. Symmetric bezier profile mirrored left/right.
  const bodyPath =
    'M -70 -230 C -92 -190 -96 -120 -80 -40 C -66 26 -70 90 -96 150 C -104 172 -70 190 0 190 C 70 190 104 172 96 150 C 70 90 66 26 80 -40 C 96 -120 92 -190 70 -230 Z';
  const rimPath = 'M -70 -230 C -30 -244 30 -244 70 -230';
  const handle = (side: number) =>
    `M ${side * 78} -160 C ${side * 168} -150 ${side * 168} -20 ${side * 82} 10`;

  return (
    <g>
      <path d={bodyPath} fill={`url(#${GOLD_ID_GRAD})`} stroke="#2a1c0c" strokeWidth={2.5} />
      <path d={rimPath} fill="none" stroke="#3a2712" strokeWidth={3} opacity={0.6} />
      {[-1, 1].map((side) => (
        <path
          key={side}
          d={handle(side)}
          fill="none"
          stroke={`url(#${GOLD_ID_GRAD})`}
          strokeWidth={13}
          strokeLinecap="round"
        />
      ))}
      {/* foot */}
      <path d="M -50 188 Q 0 210 50 188 L 40 200 Q 0 216 -40 200 Z" fill={`url(#${GOLD_ID_GRAD_SOFT})`} />
      {/* engraved shading hatch on the shadowed (right) side */}
      {Array.from({ length: 9 }, (_, i) => {
        const y = -190 + i * 42 + rng() * 6;
        return (
          <line
            key={i}
            x1={12}
            y1={y}
            x2={70 - i * 2}
            y2={y + 14}
            stroke="#241708"
            strokeWidth={1.4}
            opacity={0.35}
          />
        );
      })}
    </g>
  );
};

const Hoard: React.FC<{ rng: () => number }> = ({ rng }) => {
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
        if (b.kind === 0) {
          return <circle key={i} cx={b.x} cy={b.y} r={b.s * 0.5} fill={`url(#${GOLD_ID_GRAD})`} />;
        }
        if (b.kind === 1) {
          return (
            <circle
              key={i}
              cx={b.x}
              cy={b.y}
              r={b.s * 0.5}
              fill="none"
              stroke={`url(#${GOLD_ID_GRAD})`}
              strokeWidth={Math.max(1.6, b.s * 0.16)}
            />
          );
        }
        if (b.kind === 2) {
          return (
            <ellipse
              key={i}
              cx={b.x}
              cy={b.y}
              rx={b.s * 0.55}
              ry={b.s * 0.32}
              fill={`url(#${GOLD_ID_GRAD_SOFT})`}
              transform={`rotate(${(b.x * 3) % 40} ${b.x} ${b.y})`}
            />
          );
        }
        return (
          <path
            key={i}
            d={`M ${b.x - b.s * 0.5} ${b.y} q ${b.s * 0.25} ${-b.s * 0.6} ${b.s * 0.5} 0 q ${
              b.s * 0.25
            } ${b.s * 0.6} -${b.s * 0.5} 0 Z`}
            fill={`url(#${GOLD_ID_GRAD})`}
          />
        );
      })}
    </g>
  );
};

const Sherd: React.FC<{ rng: () => number }> = ({ rng }) => {
  // Irregular broken fragment: one smooth original edge (bottom), two
  // jagged fracture edges (top/sides), with a painted arc motif.
  const outline =
    'M -170 40 C -140 90 -60 120 10 118 C 90 116 150 84 176 30 L 150 -18 L 168 -60 L 118 -84 L 132 -128 L 70 -150 L 40 -196 L -10 -166 L -54 -190 L -78 -140 L -132 -150 L -110 -96 L -160 -70 L -128 -20 Z';
  const arcs = [50, 90, 132];
  return (
    <g>
      <path d={outline} fill={`url(#${GOLD_ID_GRAD_SOFT})`} stroke="#241a10" strokeWidth={2.5} />
      {arcs.map((r, i) => (
        <path
          key={i}
          d={`M ${-r} 10 A ${r} ${r} 0 0 1 ${r} 10`}
          fill="none"
          stroke="#2c1d0e"
          strokeWidth={3.2}
          opacity={0.55 - i * 0.1}
          transform="translate(0 -30)"
        />
      ))}
      {Array.from({ length: 8 }, (_, i) => {
        const x = -140 + i * 36 + rng() * 8;
        return (
          <line key={i} x1={x} y1={-160} x2={x + 6} y2={100} stroke="#1c130a" strokeWidth={1} opacity={0.18} />
        );
      })}
    </g>
  );
};

export const ArtifactPlate: React.FC<SceneProps> = ({ progress, seed, options }) => {
  const opts = (options ?? {}) as ArtifactPlateOptions;
  const artifact: ArtifactKind = opts.artifact ?? 'diadem';
  const label = opts.label ?? DEFAULT_LABELS[artifact];

  const seedInt = Math.floor(clamp(seed, 0, 0.999999) * 1_000_000_007) + 53;
  const rng = useMemo(() => mulberry32(seedInt), [seedInt]);
  const phase = useMemo(() => rng() * Math.PI * 2, [rng]);
  const plateJitter = useMemo(() => ({ dx: (rng() - 0.5) * 6, dy: (rng() - 0.5) * 6 }), [rng]);

  const revealIn = easeOutCubic(progress / 0.22);
  const scale = lerp(0.94, 1, revealIn);
  const opacity = revealIn;

  const rotate = Math.sin(progress * Math.PI * 0.55 + phase) * 1.4;
  const bob = Math.sin(progress * Math.PI * 0.4 + phase * 0.7) * 5;

  const plateCX = 960 + plateJitter.dx;
  const plateCY = 478 + plateJitter.dy;
  const plateR = 320;

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
        </defs>

        {/* Plate rim rings. */}
        <circle cx={plateCX} cy={plateCY} r={plateR} fill="url(#plateRim)" />
        <circle cx={plateCX} cy={plateCY} r={plateR} fill="none" stroke="#3a2a16" strokeWidth={2} opacity={0.5} />
        <circle cx={plateCX} cy={plateCY} r={plateR - 14} fill="none" stroke="#2a1c0e" strokeWidth={1} opacity={0.35} />

        {/* Artifact group: gentle drift + slow reveal. */}
        <g
          transform={`translate(${plateCX} ${plateCY + bob}) rotate(${rotate}) scale(${scale * 0.62})`}
          opacity={opacity}
        >
          {artifact === 'diadem' && <Diadem rng={rng} />}
          {artifact === 'cup' && <Cup rng={rng} />}
          {artifact === 'hoard' && <Hoard rng={rng} />}
          {artifact === 'sherd' && <Sherd rng={rng} />}
        </g>

        {/* Catalogue label. */}
        <g opacity={0.55 * revealIn}>
          <line
            x1={plateCX - 90}
            y1={plateCY + plateR - 46}
            x2={plateCX + 90}
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
