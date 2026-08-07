import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import type { SceneProps } from './types';
import { SAFE_AREA, PALETTE } from './types';

/**
 * GreatTrench — Schliemann's Great Trench: a hard vertical gash cut straight
 * down through the mound at Hisarlik, slicing through the strata with
 * almost no record of what was destroyed. A mound cross-section is drawn
 * intact, then a trench opens through its centre over the shot's duration,
 * throwing rubble outward and leaving severed layer edges exposed on both
 * cut walls. Irreversible, not chaotic — the ruin stays legible.
 */

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
const easeOutQuad = (t: number) => 1 - (1 - clamp01(t)) * (1 - clamp01(t));

// Mound geometry (composition px, 1920x1080).
const BASE_Y = 924;
const TOP_Y = 236;
const BASE_L = 190;
const BASE_R = 1730;
const TOP_L = 560;
const TOP_R = 1360;
const CX = (TOP_L + TOP_R) / 2; // trench centre x

const TRENCH_MAX_W = 168;
const TRENCH_OPEN_START = 0.1;
const TRENCH_OPEN_END = 0.58;

type StratumDef = { top: number; bottom: number; colorTop: string; colorBottom: string; texture: 'earth' | 'stone' | 'ash' };

// Six generic strata bands, oldest (bottom) to most recent (top) — this
// scene isn't about labelling every city, just showing depth being cut.
const STRATA: StratumDef[] = [
  { top: 0, bottom: 0, colorTop: '#3c2619', colorBottom: '#22130a', texture: 'earth' }, // filled below
  { top: 0, bottom: 0, colorTop: '#4d3018', colorBottom: '#2c1a0c', texture: 'earth' },
  { top: 0, bottom: 0, colorTop: '#3d2b1b', colorBottom: '#28190f', texture: 'earth' },
  { top: 0, bottom: 0, colorTop: '#524a38', colorBottom: '#332e22', texture: 'stone' },
  { top: 0, bottom: 0, colorTop: '#2a1c16', colorBottom: '#160f0a', texture: 'ash' },
  { top: 0, bottom: 0, colorTop: '#564d3a', colorBottom: '#352f21', texture: 'stone' },
];
const WEIGHTS = [1.2, 1.0, 0.7, 1.3, 0.35, 1.0];
const TOTAL_W = WEIGHTS.reduce((s, w) => s + w, 0);

function widthAt(y: number) {
  // Linear interpolation of mound half-width between base and top.
  const t = clamp01((BASE_Y - y) / (BASE_Y - TOP_Y));
  const halfBase = (BASE_R - BASE_L) / 2;
  const halfTop = (TOP_R - TOP_L) / 2;
  return lerp(halfBase, halfTop, t);
}

type GreatTrenchOptions = {
  caption?: boolean;
};

export const GreatTrench: React.FC<SceneProps> = ({ progress, seed, options }) => {
  const opts = (options ?? {}) as GreatTrenchOptions;
  const showCaption = opts.caption !== false;
  const seedInt = Math.floor(seed * 1e9) + 1;

  // Precompute strata band extents.
  const bands = useMemo(() => {
    let cursor = BASE_Y;
    return STRATA.map((s, i) => {
      const h = (WEIGHTS[i] / TOTAL_W) * (BASE_Y - TOP_Y);
      const bottom = cursor;
      const top = cursor - h;
      cursor = top;
      return { ...s, top, bottom, h };
    });
  }, []);

  const boundaryYs = useMemo(() => bands.slice(1).map((b) => b.top), [bands]);

  // Mound sides drawn as gently organic (not perfectly straight) via a
  // handful of seeded control points.
  const moundPath = useMemo(() => {
    const rand = mulberry32(seedInt + 11);
    const jig = () => (rand() - 0.5) * 10;
    return `M ${BASE_L},${BASE_Y}
      C ${BASE_L + 40 + jig()},${lerp(BASE_Y, TOP_Y, 0.4) + jig()} ${TOP_L - 90 + jig()},${TOP_Y + 60 + jig()} ${TOP_L},${TOP_Y}
      L ${TOP_R},${TOP_Y}
      C ${TOP_R + 90 + jig()},${TOP_Y + 60 + jig()} ${BASE_R - 40 + jig()},${lerp(BASE_Y, TOP_Y, 0.4) + jig()} ${BASE_R},${BASE_Y}
      Z`;
  }, [seedInt]);

  const speckles = useMemo(() => {
    return bands.map((b, i) => {
      const rand = mulberry32(seedInt + 300 + i * 61);
      const count = Math.round(10 + WEIGHTS[i] * 12);
      const items: { x: number; y: number; r: number; c: string; op: number }[] = [];
      for (let k = 0; k < count; k++) {
        const y = b.top + rand() * b.h;
        const hw = widthAt(y);
        const x = CX + (rand() - 0.5) * 2 * (hw - 20);
        const isEmber = b.texture === 'ash' && rand() < 0.2;
        items.push({
          x,
          y,
          r: isEmber ? 2 + rand() * 2 : 1 + rand() * 2.2,
          c: isEmber ? PALETTE.ember : rand() > 0.5 ? '#00000040' : '#ffffff12',
          op: isEmber ? 0.85 : 0.35 + rand() * 0.35,
        });
      }
      return items;
    });
  }, [bands, seedInt]);

  // --- Trench opening ---------------------------------------------------
  const openT = easeOutCubic((progress - TRENCH_OPEN_START) / (TRENCH_OPEN_END - TRENCH_OPEN_START));
  const trenchW = TRENCH_MAX_W * openT;
  const trenchL = CX - trenchW / 2;
  const trenchR = CX + trenchW / 2;

  // Guide line before the cut begins.
  const guideOpacity = 0.5 * (1 - easeOutCubic(progress / TRENCH_OPEN_START));

  // --- Falling rubble ------------------------------------------------
  const chunks = useMemo(() => {
    const rand = mulberry32(seedInt + 7000);
    const n = 16;
    return Array.from({ length: n }).map(() => {
      const startP = TRENCH_OPEN_START + rand() * 0.42;
      const bandIdx = Math.floor(rand() * bands.length);
      const band = bands[bandIdx];
      const originY = clamp01(rand()) * (band.h) + band.top;
      const side = rand() > 0.5 ? 1 : -1;
      const w = 10 + rand() * 22;
      const h = 8 + rand() * 16;
      const spread = 40 + rand() * 260;
      const fallDist = 380 + rand() * 420;
      const rot = (rand() - 0.5) * 90;
      const fallDur = 0.22 + rand() * 0.2;
      return { startP, originY, side, w, h, spread, fallDist, rot, fallDur, color: band.colorTop };
    });
  }, [bands, seedInt]);

  // --- Spoil heaps (accumulated rubble at the base, either side) -----
  const spoilChunks = useMemo(() => {
    const rand = mulberry32(seedInt + 9000);
    const makeHeap = (cx: number, dir: number) =>
      Array.from({ length: 20 }).map(() => {
        const spread = rand();
        const x = cx + dir * spread * 170;
        const heightAtX = 70 * (1 - spread * 0.7);
        const y = BASE_Y + 8 - rand() * heightAtX;
        const w = 12 + rand() * 26;
        const h = 8 + rand() * 14;
        const shade = rand() > 0.5 ? '#3c2619' : '#2c1a0c';
        return { x, y, w, h, shade };
      });
    return [...makeHeap(BASE_L - 30, -1), ...makeHeap(BASE_R + 30, 1)];
  }, [seedInt]);
  const spoilT = easeOutCubic((progress - 0.2) / 0.55);

  // --- Small figures for scale, standing at the trench floor ---------
  const figures = useMemo(() => {
    const rand = mulberry32(seedInt + 12000);
    return Array.from({ length: 2 }).map(() => ({
      x: CX + (rand() - 0.5) * (trenchWFinal() - 40),
      lean: (rand() - 0.5) * 6,
    }));
    function trenchWFinal() {
      return TRENCH_MAX_W;
    }
  }, [seedInt]);
  const figuresOpacity = easeOutCubic((progress - 0.62) / 0.3) * 0.55;

  return (
    <AbsoluteFill style={{ backgroundColor: PALETTE.ink, overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 1100px 700px at ${CX}px 560px, ${PALETTE.soilWarm}44 0%, transparent 72%)`,
        }}
      />

      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <clipPath id="moundClip">
            <path d={moundPath} />
          </clipPath>
          <linearGradient id="trenchShadow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#000000" stopOpacity={0.55} />
            <stop offset="55%" stopColor="#000000" stopOpacity={0.85} />
            <stop offset="100%" stopColor="#000000" stopOpacity={0.98} />
          </linearGradient>
          <linearGradient id="trenchWallL" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor="#000000" stopOpacity={0} />
            <stop offset="100%" stopColor="#000000" stopOpacity={0.5} />
          </linearGradient>
          <linearGradient id="trenchWallR" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#000000" stopOpacity={0} />
            <stop offset="100%" stopColor="#000000" stopOpacity={0.5} />
          </linearGradient>
          <linearGradient id="groundFadeTrench" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PALETTE.ink} stopOpacity={0} />
            <stop offset="100%" stopColor={PALETTE.ink} stopOpacity={1} />
          </linearGradient>
        </defs>

        {/* Mound body */}
        <g clipPath="url(#moundClip)">
          {bands.map((b, i) => (
            <rect key={i} x={0} y={b.top} width={1920} height={b.h + 1} fill={b.colorTop} />
          ))}
          {bands.map((b, i) => (
            <rect
              key={`shade-${i}`}
              x={0}
              y={b.top}
              width={1920}
              height={b.h + 1}
              fill={b.colorBottom}
              opacity={0.35}
            />
          ))}
          {speckles.map((arr, i) =>
            arr.map((s, si) => <circle key={`${i}-${si}`} cx={s.x} cy={s.y} r={s.r} fill={s.c} opacity={s.op} />)
          )}
          {boundaryYs.map((y, i) => (
            <line key={i} x1={CX - widthAt(y)} y1={y} x2={CX + widthAt(y)} y2={y} stroke={PALETTE.bone} strokeOpacity={0.12} strokeWidth={1} />
          ))}

          {/* The cut itself, clipped to the mound silhouette */}
          {trenchW > 0.5 && (
            <>
              <rect x={trenchL} y={TOP_Y - 20} width={trenchW} height={BASE_Y - TOP_Y + 260} fill="url(#trenchShadow)" />
              <rect x={trenchL} y={TOP_Y - 20} width={Math.min(24, trenchW / 2)} height={BASE_Y - TOP_Y + 260} fill="url(#trenchWallL)" />
              <rect x={trenchR - Math.min(24, trenchW / 2)} y={TOP_Y - 20} width={Math.min(24, trenchW / 2)} height={BASE_Y - TOP_Y + 260} fill="url(#trenchWallR)" />
            </>
          )}
        </g>

        {/* Mound outline */}
        <path d={moundPath} fill="none" stroke={PALETTE.ash} strokeOpacity={0.3} strokeWidth={1.2} />

        {/* Severed layer edges on both trench walls */}
        {trenchW > 4 &&
          boundaryYs.map((y, i) => {
            if (y < TOP_Y || y > BASE_Y) return null;
            return (
              <g key={`sever-${i}`}>
                <line x1={trenchL - 12} y1={y} x2={trenchL} y2={y} stroke={PALETTE.goldBright} strokeOpacity={0.4} strokeWidth={1.5} />
                <line x1={trenchR} y1={y} x2={trenchR + 12} y2={y} stroke={PALETTE.goldBright} strokeOpacity={0.4} strokeWidth={1.5} />
              </g>
            );
          })}

        {/* Guide line before the cut opens */}
        {guideOpacity > 0.01 && (
          <line x1={CX} y1={TOP_Y - 10} x2={CX} y2={BASE_Y + 10} stroke={PALETTE.gold} strokeOpacity={guideOpacity} strokeWidth={1.5} strokeDasharray="4 8" />
        )}

        {/* Falling rubble */}
        {chunks.map((c, i) => {
          const age = clamp01((progress - c.startP) / c.fallDur);
          if (age <= 0) return null;
          const fall = easeInCubic(age);
          const y = c.originY + fall * c.fallDist;
          const x = CX + c.side * c.spread * easeOutQuad(age) * 0.6 + c.side * 20;
          if (y > BASE_Y + 40) return null;
          const opacity = age > 0.72 ? lerp(0.8, 0, (age - 0.72) / 0.28) : 0.8;
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

        {/* Spoil heaps settling at the base */}
        <g opacity={spoilT}>
          {spoilChunks.map((s, i) => (
            <rect key={i} x={s.x - s.w / 2} y={s.y - s.h / 2} width={s.w} height={s.h} fill={s.shade} opacity={0.75} rx={2} />
          ))}
        </g>

        {/* Tiny figures at the trench floor, for scale */}
        <g opacity={figuresOpacity}>
          {figures.map((f, i) => (
            <g key={i} transform={`translate(${f.x} ${BASE_Y - 4}) rotate(${f.lean})`}>
              <rect x={-2.5} y={-22} width={5} height={18} fill={PALETTE.ink} stroke={PALETTE.ash} strokeOpacity={0.7} strokeWidth={0.8} rx={2} />
              <circle cx={0} cy={-26} r={4} fill={PALETTE.ink} stroke={PALETTE.ash} strokeOpacity={0.7} strokeWidth={0.8} />
            </g>
          ))}
        </g>

        {/* Ground fade beneath the mound base */}
        <rect x={0} y={BASE_Y - 40} width={1920} height={200} fill="url(#groundFadeTrench)" />

        {/* Contrast relief across the section-title safe band */}
        <rect x={0} y={SAFE_AREA.titleBandTop} width={1920} height={SAFE_AREA.titleBandBottom - SAFE_AREA.titleBandTop} fill={PALETTE.ink} opacity={0.28} />
        {/* Contrast relief across the subtitle safe band */}
        <rect x={0} y={1080 - SAFE_AREA.bottom} width={1920} height={SAFE_AREA.bottom} fill={PALETTE.ink} opacity={0.55} />
      </svg>

      {showCaption && (
        <div style={{ position: 'absolute', left: SAFE_AREA.edge, top: 120, opacity: 0.7 * easeOutCubic(progress / 0.18) }}>
          <div
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: 15,
              letterSpacing: 4,
              color: PALETTE.gold,
              textTransform: 'uppercase',
            }}
          >
            The Great Trench
          </div>
          <div
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500,
              fontSize: 13,
              letterSpacing: 1.5,
              color: PALETTE.ash,
              marginTop: 4,
            }}
          >
            1871–1873 · cut straight through the strata
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

export default GreatTrench;
