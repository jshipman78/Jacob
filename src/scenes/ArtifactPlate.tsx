import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/cinzel/500.css';
import type { SceneProps } from './types';
import { PALETTE, SAFE_AREA } from './types';

// ---------------------------------------------------------------------------
// ArtifactPlate — museum-plate treatment of the physical objects in the
// story: a gold diadem, a two-handled cup, a heap of small ornaments, a
// potsherd. Engraved-style line/fill work on a dark plate with a faint
// catalogue label, lit warmly. Shapes are kept simple, symmetrical and
// archaic — plausible Bronze Age Aegean forms, not invented fantasy
// jewellery. Each artifact is drawn in its own local coordinate space and
// then fit to a large on-screen window (computed from its bounding box) so
// it reads as the subject of the frame, not a detail lost in it.
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

// Local-coordinate bounding boxes for each artifact drawing below — used to
// fit each shape to a large, consistent on-screen window regardless of its
// natural proportions (a tall cup vs. a wide heap).
type BBox = { left: number; right: number; top: number; bottom: number };
const ARTIFACT_BBOX: Record<ArtifactKind, BBox> = {
  diadem: { left: -250, right: 250, top: -26, bottom: 302 },
  cup: { left: -176, right: 176, top: -250, bottom: 224 },
  hoard: { left: -258, right: 258, top: -170, bottom: 130 },
  sherd: { left: -182, right: 188, top: -202, bottom: 106 },
};

// ---------------------------------------------------------------------------
// Individual artifact drawings, in a local coordinate space centered near
// the object's natural pivot (see ARTIFACT_BBOX above for their extents).
// ---------------------------------------------------------------------------

// Exact point on the diadem's quadratic band curve at parameter t (0..1).
function bandCurveY(t: number) {
  const p0 = -18;
  const p1 = 54; // control point — bows the band down gently in the middle
  const p2 = -18;
  const u = 1 - t;
  return u * u * p0 + 2 * u * t * p1 + t * t * p2;
}

const Diadem: React.FC<{ rng: () => number; progress: number }> = ({ rng, progress }) => {
  const bandPath = 'M -230 -18 Q 0 54 230 -18';
  const fringeCount = 21;
  const fringe = Array.from({ length: fringeCount }, (_, i) => {
    const t = i / (fringeCount - 1);
    const x = lerp(-222, 222, t);
    const bandY = bandCurveY(t);
    const len = 30 + 16 * Math.sin(t * Math.PI) + rng() * 8;
    return { x, y: bandY, len };
  });
  const bossCount = 15;
  const bosses = Array.from({ length: bossCount }, (_, i) => {
    const t = i / (bossCount - 1);
    return { x: lerp(-222, 222, t), y: bandCurveY(t) };
  });
  const endChain = (side: number) =>
    Array.from({ length: 7 }, (_, i) => ({
      x: side * (230 + i * 4),
      y: -10 + i * 42,
    }));

  const bandDraw = easeOutCubic((progress - 0.02) / 0.24);

  return (
    <g>
      {/* Under-shadow for a sense of thickness. */}
      <path
        d="M -230 -10 Q 0 64 230 -10"
        fill="none"
        stroke="#1c1206"
        strokeWidth={20}
        strokeLinecap="round"
        opacity={0.4 * bandDraw}
      />
      <path
        d={bandPath}
        fill="none"
        stroke={`url(#${GOLD_ID_GRAD})`}
        strokeWidth={22}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - bandDraw}
      />
      {/* Bright top edge, offset slightly up, for a beaten-metal highlight. */}
      <path
        d="M -230 -24 Q 0 40 230 -24"
        fill="none"
        stroke={PALETTE.goldBright}
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.55 * bandDraw}
      />
      {bosses.map((b, i) => (
        <circle key={i} cx={b.x} cy={b.y} r={6.5} fill="#3a2a12" opacity={0.55 * bandDraw} />
      ))}
      {bosses.map((b, i) => (
        <circle key={`hl-${i}`} cx={b.x - 1.4} cy={b.y - 1.4} r={2.2} fill={PALETTE.goldBright} opacity={0.4 * bandDraw} />
      ))}
      {fringe.map((f, i) => {
        const a = buildIn(progress, i, fringe.length, 0.2, 0.58);
        return (
          <g key={i} opacity={a}>
            <line
              x1={f.x}
              y1={f.y}
              x2={f.x}
              y2={f.y + f.len * a}
              stroke={`url(#${GOLD_ID_GRAD})`}
              strokeWidth={3.6}
              strokeLinecap="round"
            />
            <path
              d={`M ${f.x - 6} ${f.y + f.len * a} q 6 14 6 14 q 0 0 6 -14 q -6 -6 -6 -6 q 0 0 -6 6 Z`}
              fill={`url(#${GOLD_ID_GRAD})`}
            />
          </g>
        );
      })}
      {[-1, 1].map((side, si) => {
        const a = buildIn(progress, si, 2, 0.5, 0.62);
        return (
          <g key={side} opacity={a}>
            {endChain(side).map((c, i) => (
              <circle
                key={i}
                cx={c.x}
                cy={c.y}
                r={7}
                fill="none"
                stroke={`url(#${GOLD_ID_GRAD})`}
                strokeWidth={3.4}
              />
            ))}
            <path
              d={`M ${side * 230} 260 q ${side * 20} 24 0 46 q ${side * -20} -22 0 -46 Z`}
              fill={`url(#${GOLD_ID_GRAD})`}
              stroke="#2a1c0c"
              strokeWidth={1.5}
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
  const reliefY = [-110, 40];

  const bodyIn = easeOutCubic((progress - 0.02) / 0.3);
  const hatchLines = 12;

  return (
    <g>
      <path d={bodyPath} fill={`url(#${GOLD_ID_GRAD})`} stroke="#2a1c0c" strokeWidth={3} opacity={bodyIn} />
      <path d={rimPath} fill="none" stroke="#3a2712" strokeWidth={4} opacity={0.6 * bodyIn} />
      <path d={rimPath} fill="none" stroke={PALETTE.goldBright} strokeWidth={1.4} opacity={0.4 * bodyIn} transform="translate(0 -3)" />
      {/* Relief bands around the body for a made, decorated surface. */}
      {reliefY.map((ry, i) => (
        <path
          key={i}
          d={`M -90 ${ry} Q 0 ${ry + 14} 90 ${ry}`}
          fill="none"
          stroke="#2a1c0c"
          strokeWidth={2}
          opacity={0.3 * bodyIn}
        />
      ))}
      {[-1, 1].map((side, si) => {
        const a = buildIn(progress, si, 2, 0.24, 0.4);
        return (
          <g key={side} opacity={a}>
            <path
              d={handle(side)}
              fill="none"
              stroke={`url(#${GOLD_ID_GRAD})`}
              strokeWidth={20}
              strokeLinecap="round"
            />
            <path
              d={handle(side)}
              fill="none"
              stroke={PALETTE.goldBright}
              strokeWidth={2.4}
              strokeLinecap="round"
              opacity={0.4}
              transform={`translate(${side * -3} -3)`}
            />
          </g>
        );
      })}
      <path d="M -50 188 Q 0 214 50 188 L 40 202 Q 0 220 -40 202 Z" fill={`url(#${GOLD_ID_GRAD_SOFT})`} opacity={bodyIn} />
      {/* Engraved shading hatch, built up in sequence like a plate print. */}
      {Array.from({ length: hatchLines }, (_, i) => {
        const y = -200 + i * 34 + rng() * 6;
        const a = buildIn(progress, i, hatchLines, 0.38, 0.72, 0.12);
        return (
          <line
            key={i}
            x1={20}
            y1={y}
            x2={20 + (86 - i * 2 - 20) * a}
            y2={y + 16 * a}
            stroke="#241708"
            strokeWidth={2}
            opacity={0.32 * a}
          />
        );
      })}
    </g>
  );
};

const Hoard: React.FC<{ rng: () => number; progress: number }> = ({ rng, progress }) => {
  type Bit = { x: number; y: number; s: number; kind: number; rot: number };
  const bits: Bit[] = useMemo(() => {
    const list: Bit[] = [];
    const n = 104;
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2;
      const rad = Math.pow(rng(), 0.55) * 240;
      const x = Math.cos(a) * rad;
      const y = Math.sin(a) * rad * 0.55 - 22;
      list.push({ x, y, s: 8 + rng() * 22, kind: Math.floor(rng() * 4), rot: rng() * 360 });
    }
    return list.sort((p, q) => p.y - q.y);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <g>
      {bits.map((b, i) => {
        const a = buildIn(progress, i, bits.length, 0.02, 0.62, 0.09);
        const s = 0.85 + 0.15 * a;
        const shadow = (
          <ellipse cx={b.x + 3} cy={b.y + b.s * 0.32} rx={b.s * 0.5} ry={b.s * 0.16} fill="#000" opacity={0.28 * a} />
        );
        const shapeProps = {
          opacity: a,
          transform: `translate(${b.x} ${b.y}) rotate(${b.rot}) scale(${s})`,
        };
        if (b.kind === 0) {
          return (
            <g key={i}>
              {shadow}
              <circle cx={0} cy={0} r={b.s * 0.5} fill={`url(#${GOLD_ID_GRAD})`} {...shapeProps} />
            </g>
          );
        }
        if (b.kind === 1) {
          return (
            <g key={i}>
              {shadow}
              <circle
                cx={0}
                cy={0}
                r={b.s * 0.5}
                fill="none"
                stroke={`url(#${GOLD_ID_GRAD})`}
                strokeWidth={Math.max(2, b.s * 0.2)}
                {...shapeProps}
              />
            </g>
          );
        }
        if (b.kind === 2) {
          return (
            <g key={i}>
              {shadow}
              <ellipse cx={0} cy={0} rx={b.s * 0.55} ry={b.s * 0.32} fill={`url(#${GOLD_ID_GRAD_SOFT})`} {...shapeProps} />
            </g>
          );
        }
        return (
          <g key={i}>
            {shadow}
            <path
              d={`M ${-b.s * 0.5} 0 q ${b.s * 0.25} ${-b.s * 0.6} ${b.s * 0.5} 0 q ${b.s * 0.25} ${
                b.s * 0.6
              } -${b.s * 0.5} 0 Z`}
              fill={`url(#${GOLD_ID_GRAD})`}
              {...shapeProps}
            />
          </g>
        );
      })}
    </g>
  );
};

const Sherd: React.FC<{ rng: () => number; progress: number }> = ({ rng, progress }) => {
  // One long smooth curve (the surviving exterior surface of the vessel)
  // along the bottom, irregular angular fracture edges elsewhere — reading
  // as a broken fragment rather than a symmetric scalloped shape.
  const outline =
    'M -158 58 C -80 96 60 100 172 42 L 148 -6 L 184 -46 L 132 -84 L 158 -132 L 92 -146 L 44 -196 L -8 -150 L -66 -198 L -104 -146 L -74 -104 L -138 -76 L -96 -34 L -166 12 Z';
  const arcs = [48, 84, 122];
  const bodyIn = easeOutCubic((progress - 0.02) / 0.3);
  const hatch = 10;
  const rivets = [
    { x: -132, y: -8 },
    { x: 136, y: -18 },
  ];

  return (
    <g>
      <path d={outline} fill={`url(#${GOLD_ID_GRAD_SOFT})`} stroke="#241a10" strokeWidth={3} opacity={bodyIn} />
      {arcs.map((r, i) => {
        const a = buildIn(progress, i, arcs.length, 0.3, 0.55, 0.14);
        return (
          <path
            key={i}
            d={`M ${-r} 6 A ${r} ${r} 0 0 1 ${r} 6`}
            fill="none"
            stroke="#2c1d0e"
            strokeWidth={4}
            opacity={(0.55 - i * 0.1) * a}
            transform="translate(0 -38)"
          />
        );
      })}
      {Array.from({ length: hatch }, (_, i) => {
        const x = -150 + i * 32 + rng() * 8;
        const a = buildIn(progress, i, hatch, 0.42, 0.68, 0.12);
        return (
          <line key={i} x1={x} y1={-170} x2={x + 8} y2={-170 + 260 * a} stroke="#1c130a" strokeWidth={1.4} opacity={0.2 * a} />
        );
      })}
      {rivets.map((rv, i) => {
        const a = buildIn(progress, i, rivets.length, 0.55, 0.68, 0.12);
        return <circle key={i} cx={rv.x} cy={rv.y} r={5} fill="#0e0a06" opacity={0.6 * a} />;
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
  const plateJitter = useMemo(() => ({ dx: (rng() - 0.5) * 24 }), [rng]);

  // Fit the artifact's bounding box to a large window, then center it
  // within the usable area (roughly y=80..800, above the subtitle band)
  // rather than pinning it to the top — so every artifact, regardless of
  // its natural proportions, sits with a comfortable margin above and a
  // clear gap to the catalogue label below.
  const bbox = ARTIFACT_BBOX[artifact];
  const windowTop = 80;
  const windowBottom = 800;
  const minMargin = 100; // guaranteed clearance above the artifact's top
  const availH = windowBottom - windowTop - minMargin * 2;
  const leftMargin = 170;
  const rightMargin = 1920 - 170;
  const availW = rightMargin - leftMargin;
  const fitScale = Math.min(availH / (bbox.bottom - bbox.top), availW / (bbox.right - bbox.left));
  const originX = 960 + plateJitter.dx;
  const originY = (windowTop + windowBottom) / 2 - ((bbox.top + bbox.bottom) / 2) * fitScale;

  const ringCX = originX;
  const ringCY = originY + ((bbox.top + bbox.bottom) / 2) * fitScale; // == (windowTop+windowBottom)/2
  const halfSpan = Math.max(bbox.right - bbox.left, bbox.bottom - bbox.top) * fitScale * 0.5;
  const plateR = clamp(halfSpan * 1.14 + 64, 260, 380);

  const dustMotes = useMemo(() => {
    const n = 16;
    return Array.from({ length: n }, () => ({
      x: rng() * 900 - 450,
      y: rng() * 900 - 450,
      r: 1.2 + rng() * 2.6,
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
  const bob = Math.sin((t * TAU) / 12 + phase * 0.7) * 6;
  const microScale = 1 + 0.006 * Math.sin((t * TAU) / 9 + phase2);

  // Travelling specular highlight across the metal.
  const sweepT = (Math.sin((t * TAU) / 13 + phase2) + 1) / 2; // 0..1, oscillates slowly

  // Label sits at a fixed, safe position regardless of the artifact's own
  // geometry — always clear of the subtitle band, always findable.
  const labelY = 1080 - SAFE_AREA.bottom - 34;
  const labelDraw = easeOutCubic((progress - 0.16) / 0.24);

  return (
    <AbsoluteFill style={{ backgroundColor: PALETTE.ink }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${ringCX}px ${ringCY}px, #1c130a 0%, #0c0805 55%, ${PALETTE.ink} 100%)`,
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
            <circle cx={ringCX} cy={ringCY} r={plateR} />
          </clipPath>
        </defs>

        {/* Plate rim rings. */}
        <circle cx={ringCX} cy={ringCY} r={plateR} fill="url(#plateRim)" />
        <circle cx={ringCX} cy={ringCY} r={plateR} fill="none" stroke="#3a2a16" strokeWidth={2} opacity={0.5} />
        <circle cx={ringCX} cy={ringCY} r={plateR - 16} fill="none" stroke="#2a1c0e" strokeWidth={1} opacity={0.35} />

        {/* Artifact group: gentle continuous drift + progress-driven build-in. */}
        <g
          transform={`translate(${originX} ${originY + bob}) rotate(${rotate}) scale(${scale * microScale * fitScale})`}
          opacity={opacity}
        >
          {artifact === 'diadem' && <Diadem rng={rng} progress={progress} />}
          {artifact === 'cup' && <Cup rng={rng} progress={progress} />}
          {artifact === 'hoard' && <Hoard rng={rng} progress={progress} />}
          {artifact === 'sherd' && <Sherd rng={rng} progress={progress} />}
        </g>

        {/* Travelling specular highlight, clipped to the plate. */}
        <g clipPath="url(#plateClip)" opacity={0.28 * revealIn}>
          <rect
            x={ringCX - plateR + plateR * 2.6 * sweepT - plateR * 1.3}
            y={ringCY - plateR}
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
            const x = ringCX + m.x + Math.cos(m.angle) * travel * 0.15 + Math.sin((t * TAU) / 6 + m.phase) * 14;
            const y = ringCY + m.y + Math.sin(m.angle) * travel * 0.15 + Math.cos((t * TAU) / 7 + m.phase) * 10;
            const op = 0.22 + 0.15 * Math.sin((t * TAU) / 4 + m.phase);
            return <circle key={i} cx={x} cy={y} r={m.r} fill={PALETTE.bone} opacity={Math.max(0, op) * revealIn} />;
          })}
        </g>

        {/* Catalogue label — fixed, safe position, drawing in early so it
            reads on shots of any length. */}
        <g opacity={0.75 * clamp(labelDraw, 0, 1)}>
          <line
            x1={960 - 110}
            y1={labelY - 22}
            x2={960 - 110 + 220 * clamp(labelDraw, 0, 1)}
            y2={labelY - 22}
            stroke={PALETTE.ash}
            strokeWidth={1}
          />
          <text
            x={960}
            y={labelY}
            textAnchor="middle"
            fill={PALETTE.bone}
            fontFamily='"Inter", sans-serif'
            fontWeight={500}
            fontSize={22}
            letterSpacing={2.8}
          >
            {label.toUpperCase()}
          </text>
        </g>
      </svg>

      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse 68% 62% at 50% 42%, rgba(0,0,0,0) 48%, rgba(0,0,0,0.78) 100%)',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};

export default ArtifactPlate;
