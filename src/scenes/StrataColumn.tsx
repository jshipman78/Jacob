import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import type { SceneProps } from './types';
import { SAFE_AREA, PALETTE } from './types';

/**
 * StrataColumn — the central fact of the dig: Hisarlik is not one city but
 * at least nine, stacked across roughly four thousand years. A cross-section
 * earth column, oldest city at the bottom, most recent at the top, each
 * band with its own texture and colour temperature.
 *
 * The column stays alive for the whole shot: a slow continuous camera sink
 * through the stack, fine sediment sifting down through the section, a
 * highlighted layer breathing with warm light, and leader-lines that draw
 * themselves in rather than pop.
 *
 * options:
 *   highlight?: string | string[]  — layer id(s) ('I'..'IX', plus 'VIIa' /
 *     'VIIb') to bring forward with a warm glow while others recede.
 *   mode?: 'intact' | 'destroyed'  — in 'destroyed', the upper layers are
 *     actively gouged and crumble away over the shot, with the removed
 *     material left as faint ghost outlines, illustrating what Schliemann's
 *     dig destroyed.
 */

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32) — seeded from the scene's `seed` prop so
// texture placement is stable across out-of-order frame rendering.
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  let a = (seed >>> 0) || 1;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const easeInCubic = (t: number) => Math.pow(clamp01(t), 3);

// A bump function that is 0 at u=0 and u=1 and peaks at 1 in the middle —
// used so looping particle motion fades out before it wraps, so the wrap
// itself is never visible.
const edgeFadeBump = (u: number, fadeFrac = 0.18) => {
  if (u < fadeFrac) return u / fadeFrac;
  if (u > 1 - fadeFrac) return (1 - u) / fadeFrac;
  return 1;
};

type Texture = 'earth' | 'clay' | 'stone' | 'ash' | 'gold';

type LayerDef = {
  id: string;
  roman: string;
  years: string;
  weight: number;
  top: string;
  bottom: string;
  texture: Texture;
  note?: string;
};

// Bottom (oldest) to top (most recent).
const LAYERS: LayerDef[] = [
  { id: 'I', roman: 'I', years: '3000–2550 BCE', weight: 1.22, top: '#3c2619', bottom: '#22130a', texture: 'earth' },
  { id: 'II', roman: 'II', years: '2600–2350 BCE', weight: 1.0, top: '#4d3018', bottom: '#2c1a0c', texture: 'gold', note: 'the treasure' },
  { id: 'III', roman: 'III', years: '2350–2200 BCE', weight: 0.62, top: '#3d2b1b', bottom: '#261a10', texture: 'earth' },
  { id: 'IV', roman: 'IV', years: '2200–1900 BCE', weight: 0.74, top: '#41321f', bottom: '#291d10', texture: 'earth' },
  { id: 'V', roman: 'V', years: '1900–1700 BCE', weight: 0.62, top: '#3b2f1f', bottom: '#241b10', texture: 'clay' },
  { id: 'VI', roman: 'VI', years: '1700–1300 BCE', weight: 1.3, top: '#544c3a', bottom: '#332e22', texture: 'stone' },
  { id: 'VIIa', roman: 'VIIa', years: '1300–1180 BCE', weight: 0.32, top: '#2a1c16', bottom: '#160f0a', texture: 'ash', note: 'war-era candidate' },
  { id: 'VIIb', roman: 'VIIb', years: '1180–950 BCE', weight: 0.4, top: '#3a301e', bottom: '#241d10', texture: 'earth' },
  { id: 'VIII', roman: 'VIII', years: '950–85 BCE', weight: 0.82, top: '#4a4232', bottom: '#2d281c', texture: 'stone' },
  { id: 'IX', roman: 'IX', years: '85 BCE–500 CE', weight: 0.88, top: '#584f3c', bottom: '#372f21', texture: 'stone' },
];

const TOTAL_WEIGHT = LAYERS.reduce((s, l) => s + l.weight, 0);

// Column geometry (composition px, 1920x1080).
const COL_X = 700;
const COL_W = 700;
const COL_TOP = 108;
const COL_BOTTOM = 792;
const COL_H = COL_BOTTOM - COL_TOP;
const COL_CX = COL_X + COL_W / 2;
const COL_CY = (COL_TOP + COL_BOTTOM) / 2;
const LABEL_X = 640; // right-aligned numerals
const TICK_X0 = 650;

type StrataColumnOptions = {
  highlight?: string | string[];
  mode?: 'intact' | 'destroyed';
};

export const StrataColumn: React.FC<SceneProps> = ({ progress, seed, options }) => {
  const opts = (options ?? {}) as StrataColumnOptions;
  const mode = opts.mode ?? 'intact';
  const highlightSet = useMemo(() => {
    const h = opts.highlight;
    if (!h) return new Set<string>();
    return new Set(Array.isArray(h) ? h : [h]);
  }, [opts.highlight]);
  const hasHighlight = highlightSet.size > 0;

  const seedInt = Math.floor(seed * 1e9) + 1;

  // Precompute band vertical extents (bottom-up) and per-band texture, once
  // per seed — not per frame.
  // Note: `topY`/`bottomY` (not `top`/`bottom`) so these pixel positions
  // don't collide with LayerDef's `top`/`bottom` colour-gradient stops.
  const bands = useMemo(() => {
    let cursor = COL_BOTTOM;
    return LAYERS.map((layer, i) => {
      const h = (layer.weight / TOTAL_WEIGHT) * COL_H;
      const bottomY = cursor;
      const topY = cursor - h;
      cursor = topY;
      const rand = mulberry32(seedInt + i * 977);
      return { ...layer, index: i, topY, bottomY, h, rand };
    });
  }, [seedInt]);

  // Boundary wave paths (jitter) — one per internal boundary, deterministic.
  const boundaries = useMemo(() => {
    return bands.slice(0, -1).map((b, i) => {
      const rand = mulberry32(seedInt + 5000 + i * 131);
      const amp = 3 + rand() * 4;
      const points = 6;
      const pts: [number, number][] = [];
      for (let p = 0; p <= points; p++) {
        const x = COL_X + (COL_W * p) / points;
        const y = b.topY + (rand() - 0.5) * amp * 2;
        pts.push([x, y]);
      }
      let d = `M ${pts[0][0]},${pts[0][1]}`;
      for (let p = 1; p < pts.length; p++) {
        const [px, py] = pts[p - 1];
        const [cx, cy] = pts[p];
        d += ` Q ${(px + cx) / 2},${py} ${cx},${cy}`;
      }
      return d;
    });
  }, [bands, seedInt]);

  // Texture speckles per band, memoized on seed.
  const speckleData = useMemo(() => {
    return bands.map((b) => {
      const rand = b.rand;
      const count =
        b.texture === 'stone'
          ? Math.round(4 + b.weight * 5)
          : Math.round(6 + b.weight * 9);
      const items: { x: number; y: number; w: number; h: number; c: string; op: number; kind: string }[] = [];
      for (let k = 0; k < count; k++) {
        const x = COL_X + 14 + rand() * (COL_W - 28);
        const y = b.topY + 6 + rand() * Math.max(4, b.h - 12);
        if (b.texture === 'stone') {
          const w = 34 + rand() * 70;
          const h = Math.min(b.h - 8, 14 + rand() * 20);
          items.push({ x, y, w, h, c: rand() > 0.5 ? '#00000030' : '#ffffff14', op: 0.5 + rand() * 0.4, kind: 'rect' });
        } else if (b.texture === 'ash') {
          const isEmber = rand() < 0.16;
          const r = isEmber ? 2 + rand() * 2 : 1 + rand() * 2;
          items.push({ x, y, w: r, h: r, c: isEmber ? PALETTE.ember : '#00000055', op: isEmber ? 0.85 : 0.5, kind: 'dot' });
        } else if (b.texture === 'gold') {
          const isFleck = rand() < 0.22;
          const r = isFleck ? 2.2 + rand() * 2.4 : 1 + rand() * 1.6;
          items.push({ x, y, w: r, h: r, c: isFleck ? PALETTE.gold : '#00000040', op: isFleck ? 0.9 : 0.45, kind: 'dot' });
        } else {
          const r = 1 + rand() * 2.2;
          items.push({ x, y, w: r, h: r, c: rand() > 0.5 ? '#00000045' : '#ffffff10', op: 0.4 + rand() * 0.35, kind: 'dot' });
        }
      }
      return items;
    });
  }, [bands]);

  // Fine sediment sifting down through the whole section, continuously, for
  // the entire shot. Each particle loops through the column height but
  // fades to zero opacity before it wraps, so the wrap is never seen.
  const sediment = useMemo(() => {
    const rand = mulberry32(seedInt + 20000);
    return Array.from({ length: 46 }).map(() => ({
      x: COL_X + 10 + rand() * (COL_W - 20),
      phase: rand(),
      speed: 0.35 + rand() * 0.5, // fall cycles per full progress span
      r: 0.6 + rand() * 1.4,
      drift: (rand() - 0.5) * 10,
    }));
  }, [seedInt]);

  // Reveal: bands materialize bottom (oldest) to top across the first ~55%
  // of the shot's progress, then hold — a slow, one-directional build with
  // no loop.
  const revealFor = (index: number) => {
    const n = LAYERS.length;
    const start = (index / n) * 0.5;
    const end = start + 0.22;
    return easeOutCubic((progress - start) / (end - start));
  };

  // Highlight emphasis ramps in gently after the structure has settled,
  // then breathes with a slow, tiny-amplitude pulse for the rest of the
  // shot — present throughout, never distracting.
  const glowBase = easeOutCubic((progress - 0.4) / 0.35);
  const glowPulse = 1 + 0.09 * Math.sin(progress * Math.PI * 2 * 2.6);
  const glowT = glowBase * glowPulse;

  // Slow continuous camera sink through the stack, plus an almost
  // imperceptible breathing scale — alive for the whole shot, not just
  // during the initial reveal.
  const camDriftY = -30 * progress;
  const camScale = 1 + 0.03 * progress + 0.006 * Math.sin(progress * Math.PI * 2 * 1.8);
  const sceneTransform = `translateY(${camDriftY}px) scale(${camScale})`;
  const sceneTransformOrigin = `${COL_CX}px ${COL_CY}px`;

  // Destroyed-mode: upper bands are gone; the boundary just below them is
  // actively being quarried away, crumbling in staggered chunks across
  // most of the shot rather than settling once into a finished ruin.
  const ghostT = easeOutCubic((progress - 0.08) / 0.75);
  const removedIds = new Set(['VIII', 'IX']);
  const goutedPartialId = 'VIIb'; // shown partially quarried, not fully gone

  const removedBandsForChunks = useMemo(
    () => bands.filter((b) => removedIds.has(b.id) || b.id === goutedPartialId),
    [bands]
  );

  const crumbleChunks = useMemo(() => {
    if (mode !== 'destroyed') return [];
    const rand = mulberry32(seedInt + 33000);
    const n = 22;
    return Array.from({ length: n }).map(() => {
      const band = removedBandsForChunks[Math.floor(rand() * removedBandsForChunks.length)];
      const originX = COL_X + 20 + rand() * (COL_W - 40);
      const originY = band.topY + rand() * band.h;
      const startP = 0.06 + rand() * 0.78;
      const fallDur = 0.14 + rand() * 0.16;
      const w = 8 + rand() * 18;
      const h = 6 + rand() * 12;
      const rot = (rand() - 0.5) * 70;
      const drift = (rand() - 0.5) * 90;
      const fallDist = 260 + rand() * 260;
      return { originX, originY, startP, fallDur, w, h, rot, drift, fallDist, color: band.bottom };
    });
  }, [mode, removedBandsForChunks, seedInt]);

  return (
    <AbsoluteFill style={{ backgroundColor: PALETTE.ink, overflow: 'hidden' }}>
      {/* Ambient depth glow behind the column */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 900px 700px at ${COL_CX}px 500px, ${PALETTE.soilWarm}55 0%, transparent 70%)`,
        }}
      />

      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          {bands.map((b) => (
            <linearGradient key={`grad-${b.id}`} id={`grad-${b.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={b.top} />
              <stop offset="100%" stopColor={b.bottom} />
            </linearGradient>
          ))}
          <filter id="strataGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="16" />
          </filter>
          <clipPath id="colClip">
            <rect x={COL_X} y={COL_TOP} width={COL_W} height={COL_H} rx={3} />
          </clipPath>
          <linearGradient id="bedrockFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PALETTE.ink} stopOpacity={0} />
            <stop offset="100%" stopColor={PALETTE.ink} stopOpacity={1} />
          </linearGradient>
        </defs>

        <g style={{ transform: sceneTransform, transformOrigin: sceneTransformOrigin }}>
          {/* Column frame */}
          <rect
            x={COL_X - 1}
            y={COL_TOP - 1}
            width={COL_W + 2}
            height={COL_H + 2}
            fill="none"
            stroke={PALETTE.ash}
            strokeOpacity={0.35}
            strokeWidth={1}
          />

          {bands.map((b) => {
            const isHi = highlightSet.has(b.id);
            const dim = hasHighlight && !isHi;
            const reveal = revealFor(b.index);
            const isRemovedInDestroyed = mode === 'destroyed' && removedIds.has(b.id);
            const isPartialQuarry = mode === 'destroyed' && b.id === goutedPartialId;

            // In destroyed mode, removed bands render only as faint ghost
            // outlines (no solid fill); the partial-quarry band keeps a
            // shrinking solid remnant at its base as it's actively cut away.
            const fillOpacity = isRemovedInDestroyed
              ? 0
              : reveal * (dim ? 0.38 : 1) * (isPartialQuarry ? lerp(1, 0.42, ghostT) : 1);

            const bandHeight = isPartialQuarry ? b.h * lerp(1, 0.4, ghostT) : b.h;
            const bandTop = isPartialQuarry ? b.bottomY - bandHeight : b.topY;

            return (
              <g key={b.id} clipPath="url(#colClip)">
                <g
                  style={{
                    opacity: fillOpacity,
                    transform: `translateY(${(1 - reveal) * 10}px)`,
                    transformOrigin: `${COL_X + COL_W / 2}px ${b.bottomY}px`,
                  }}
                >
                  <rect x={COL_X} y={bandTop} width={COL_W} height={bandHeight} fill={`url(#grad-${b.id})`} />
                  {speckleData[b.index].map((s, si) =>
                    s.kind === 'rect' ? (
                      <rect key={si} x={s.x} y={s.y} width={s.w} height={s.h} fill={s.c} opacity={s.op} rx={2} />
                    ) : (
                      <circle key={si} cx={s.x} cy={s.y} r={s.w} fill={s.c} opacity={s.op} />
                    )
                  )}
                </g>
                {isHi && (
                  <rect
                    x={COL_X}
                    y={bandTop}
                    width={COL_W}
                    height={bandHeight}
                    fill={PALETTE.gold}
                    opacity={0.16 * glowT}
                    filter="url(#strataGlow)"
                  />
                )}
              </g>
            );
          })}

          {/* Fine sediment sifting down through the section, continuously */}
          <g clipPath="url(#colClip)">
            {sediment.map((p, i) => {
              const u = (p.phase + progress * p.speed) % 1;
              const y = COL_TOP + u * COL_H;
              const op = 0.28 * edgeFadeBump(u);
              if (op <= 0.01) return null;
              return <circle key={i} cx={p.x + p.drift * u} cy={y} r={p.r} fill={PALETTE.bone} opacity={op} />;
            })}
          </g>

          {/* Ghost outlines for destroyed-mode removed bands, and dashed
              excavation rim. */}
          {mode === 'destroyed' &&
            bands
              .filter((b) => removedIds.has(b.id))
              .map((b) => (
                <rect
                  key={`ghost-${b.id}`}
                  x={COL_X}
                  y={b.topY}
                  width={COL_W}
                  height={b.h}
                  fill="none"
                  stroke={PALETTE.bone}
                  strokeOpacity={0.22 * ghostT}
                  strokeWidth={1.2}
                  strokeDasharray="7 8"
                />
              ))}
          {mode === 'destroyed' && (
            <line
              x1={COL_X - 6}
              y1={COL_TOP + bands.find((b) => b.id === goutedPartialId)!.h * lerp(1, 0.4, ghostT)}
              x2={COL_X + COL_W + 6}
              y2={COL_TOP + bands.find((b) => b.id === goutedPartialId)!.h * lerp(1, 0.4, ghostT)}
              stroke={PALETTE.ember}
              strokeOpacity={0.32 * ghostT}
              strokeWidth={1.5}
              strokeDasharray="2 5"
            />
          )}

          {/* Actively crumbling / falling debris, staggered across most of
              the shot rather than resolving early. */}
          {mode === 'destroyed' &&
            crumbleChunks.map((c, i) => {
              const age = clamp01((progress - c.startP) / c.fallDur);
              if (age <= 0) return null;
              const fall = easeInCubic(age);
              const y = c.originY + fall * c.fallDist;
              if (y > COL_BOTTOM + 60) return null;
              const x = c.originX + c.drift * fall;
              const opacity = age > 0.7 ? lerp(0.85, 0, (age - 0.7) / 0.3) : 0.85;
              return (
                <rect
                  key={i}
                  x={x - c.w / 2}
                  y={y - c.h / 2}
                  width={c.w}
                  height={c.h}
                  fill={c.color}
                  opacity={opacity}
                  transform={`rotate(${c.rot * age} ${x} ${y})`}
                  rx={1.5}
                />
              );
            })}

          {/* Layer boundaries */}
          {boundaries.map((d, i) => {
            const reveal = Math.min(revealFor(bands[i].index), revealFor(bands[i + 1].index));
            return (
              <path
                key={i}
                d={d}
                fill="none"
                stroke={PALETTE.bone}
                strokeOpacity={0.14 * reveal}
                strokeWidth={1}
              />
            );
          })}

          {/* Highlight outline strokes, drawn above boundaries */}
          {bands
            .filter((b) => highlightSet.has(b.id))
            .map((b) => (
              <rect
                key={`hi-outline-${b.id}`}
                x={COL_X + 1}
                y={b.topY + 1}
                width={COL_W - 2}
                height={b.h - 2}
                fill="none"
                stroke={PALETTE.goldBright}
                strokeOpacity={0.7 * glowT}
                strokeWidth={1.5}
              />
            ))}

          {/* Bedrock fade below the column */}
          <rect x={0} y={COL_BOTTOM - 60} width={1920} height={160} fill="url(#bedrockFade)" />

          {/* Tick lines connecting labels to their band — drawn in, not
              popped: they grow outward from the column edge. */}
          {bands.map((b) => {
            const isHi = highlightSet.has(b.id);
            const dim = hasHighlight && !isHi;
            const reveal = revealFor(b.index);
            const cy = (b.topY + b.bottomY) / 2;
            const inTitleBand = cy > SAFE_AREA.titleBandTop - 20 && cy < SAFE_AREA.titleBandBottom + 20;
            const bandFade = inTitleBand ? 0.45 : 1;
            const drawT = easeOutCubic((reveal - 0.15) / 0.5);
            const x2 = lerp(COL_X, TICK_X0, clamp01(drawT));
            return (
              <line
                key={`tick-${b.id}`}
                x1={COL_X}
                y1={cy}
                x2={x2}
                y2={cy}
                stroke={isHi ? PALETTE.goldBright : PALETTE.ash}
                strokeOpacity={reveal * bandFade * (dim ? 0.2 : isHi ? 0.85 : 0.4)}
                strokeWidth={isHi ? 1.4 : 1}
              />
            );
          })}
        </g>

        {/* Contrast relief across the section-title safe band */}
        <rect
          x={0}
          y={SAFE_AREA.titleBandTop}
          width={1920}
          height={SAFE_AREA.titleBandBottom - SAFE_AREA.titleBandTop}
          fill={PALETTE.ink}
          opacity={0.3}
        />
        {/* Contrast relief across the subtitle safe band */}
        <rect
          x={0}
          y={1080 - SAFE_AREA.bottom}
          width={1920}
          height={SAFE_AREA.bottom}
          fill={PALETTE.ink}
          opacity={0.55}
        />
      </svg>

      {/* Labels — HTML for crisp Inter type, sharing the same camera drift */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', transform: sceneTransform, transformOrigin: sceneTransformOrigin }}>
        {bands.map((b) => {
          const isHi = highlightSet.has(b.id);
          const dim = hasHighlight && !isHi;
          const reveal = revealFor(b.index);
          const cy = (b.topY + b.bottomY) / 2;
          const inTitleBand = cy > SAFE_AREA.titleBandTop - 20 && cy < SAFE_AREA.titleBandBottom + 20;
          const bandFade = inTitleBand ? 0.45 : 1;
          const baseOpacity = reveal * bandFade * (dim ? 0.28 : isHi ? 1 : 0.62);
          return (
            <div
              key={`label-${b.id}`}
              style={{
                position: 'absolute',
                left: 0,
                top: cy,
                width: LABEL_X,
                transform: 'translateY(-50%)',
                textAlign: 'right',
                paddingRight: 14,
                opacity: baseOpacity,
              }}
            >
              <div
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: isHi ? 700 : 600,
                  fontSize: isHi ? 26 : 19,
                  letterSpacing: 2,
                  color: isHi ? PALETTE.goldBright : PALETTE.bone,
                  lineHeight: 1.1,
                }}
              >
                {b.roman}
              </div>
              <div
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 500,
                  fontSize: 12.5,
                  letterSpacing: 1,
                  color: isHi ? PALETTE.gold : PALETTE.ash,
                  marginTop: 2,
                }}
              >
                {b.years}
              </div>
              {isHi && b.note && (
                <div
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 500,
                    fontSize: 12.5,
                    letterSpacing: 0.6,
                    color: PALETTE.goldBright,
                    marginTop: 2,
                    fontStyle: 'italic',
                    opacity: 0.9,
                  }}
                >
                  {b.note}
                </div>
              )}
            </div>
          );
        })}

        {/* Surface / bedrock orientation labels */}
        <div
          style={{
            position: 'absolute',
            left: COL_X,
            top: COL_TOP - 34,
            fontFamily: 'Inter, sans-serif',
            fontWeight: 600,
            fontSize: 13,
            letterSpacing: 3,
            color: PALETTE.ash,
            opacity: 0.55 * easeOutCubic(progress / 0.15),
            textTransform: 'uppercase',
          }}
        >
          Surface
        </div>
        <div
          style={{
            position: 'absolute',
            left: COL_X,
            top: COL_BOTTOM + 10,
            fontFamily: 'Inter, sans-serif',
            fontWeight: 500,
            fontSize: 12,
            letterSpacing: 2.5,
            color: PALETTE.ash,
            opacity: 0.4 * easeOutCubic((progress - 0.4) / 0.3),
            textTransform: 'uppercase',
          }}
        >
          Bedrock
        </div>

        {mode === 'destroyed' && (
          <div
            style={{
              position: 'absolute',
              left: COL_X + COL_W + 30,
              top: bands.find((b) => b.id === 'VIII')!.topY + 6,
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500,
              fontSize: 13,
              letterSpacing: 1,
              color: PALETTE.bone,
              opacity: 0.45 * ghostT,
              maxWidth: 260,
              lineHeight: 1.4,
            }}
          >
            removed by the 1873 excavation — unrecorded
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

export default StrataColumn;
