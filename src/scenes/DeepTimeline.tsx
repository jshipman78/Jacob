import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/cinzel/600.css';
import type { SceneProps } from './types';
import { SAFE_AREA, PALETTE } from './types';

/**
 * DeepTimeline — the gap that undoes "Priam's Treasure". The narration:
 * the gold came from Troy II, ~2600–2350 BCE. The Trojan War, if it
 * happened, was around 1200 BCE. That is well over a thousand years of
 * separation — so the gold could not have belonged to Priam. A single
 * honest, linear deep-time axis, with that gap rendered as the subject of
 * the shot rather than as empty space.
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
const easeInOutCubic = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

const formatWithCommas = (n: number) => {
  const s = Math.round(Math.abs(n)).toString();
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};
const formatYear = (y: number) => (y < 0 ? `${formatWithCommas(-y)} BCE` : y === 0 ? '0' : `${formatWithCommas(y)} CE`);

// A purely linear deep-time axis, honestly labelled — no log scale, so the
// gap between Troy II and the war reads at its true relative size.
const DOMAIN_MIN = -3000;
const DOMAIN_MAX = 2000;
const AXIS_X0 = 200;
const AXIS_X1 = 1720;
const AXIS_Y = 470;
const MARKER_TOP_Y = 300;

const mapX = (year: number) =>
  lerp(AXIS_X0, AXIS_X1, (year - DOMAIN_MIN) / (DOMAIN_MAX - DOMAIN_MIN));

type Marker = {
  label: string;
  year: number;
  kind?: 'era' | 'point';
  /** Internal-only: explicit span for an 'era' marker; falls back to a
   * default width around `year` when omitted. Extends the public contract
   * (label/year/kind) with an optional field, so caller-supplied markers
   * that only set label/year/kind remain fully valid input. */
  span?: [number, number];
};

const DEFAULT_MARKERS: Marker[] = [
  { label: 'Troy II — the gold', year: -2475, kind: 'era', span: [-2600, -2350] },
  { label: 'Trojan War, if real', year: -1180, kind: 'point' },
  { label: 'Schliemann digs', year: 1873, kind: 'point' },
];

const DEFAULT_GAP: [number, number] = [-2475, -1180];

type DeepTimelineOptions = {
  markers?: Marker[];
  emphasizeGap?: [number, number];
};

export const DeepTimeline: React.FC<SceneProps> = ({ progress, seed, options }) => {
  const opts = (options ?? {}) as DeepTimelineOptions;
  const markers = opts.markers && opts.markers.length > 0 ? opts.markers : DEFAULT_MARKERS;
  const gap = opts.emphasizeGap ?? DEFAULT_GAP;
  const gapYears = Math.abs(gap[0] - gap[1]);
  const gapX0 = mapX(Math.min(gap[0], gap[1]));
  const gapX1 = mapX(Math.max(gap[0], gap[1]));

  const seedInt = Math.floor(seed * 1e9) + 1;

  // Minor ruler ticks every 100 years, deterministic and static (no
  // per-frame randomness — purely a function of the fixed domain).
  const minorTicks = useMemo(() => {
    const arr: number[] = [];
    for (let y = DOMAIN_MIN; y <= DOMAIN_MAX; y += 100) arr.push(y);
    return arr;
  }, []);
  const majorTicks = useMemo(() => {
    const arr: number[] = [];
    for (let y = DOMAIN_MIN; y <= DOMAIN_MAX; y += 500) arr.push(y);
    return arr;
  }, []);

  // A faint scatter of "deep time" dust across the upper field — static,
  // seeded, never animated per-frame (cheap, non-distracting).
  const dust = useMemo(() => {
    const rand = mulberry32(seedInt + 4);
    return Array.from({ length: 40 }).map(() => ({
      x: rand() * 1920,
      y: rand() * 260,
      r: 0.6 + rand() * 1.2,
      op: 0.05 + rand() * 0.12,
    }));
  }, [seedInt]);

  // --- Reveal choreography, all driven by `progress` -------------------
  const axisT = easeOutCubic(progress / 0.18);
  const ticksT = easeOutCubic((progress - 0.05) / 0.25);
  const bracketT = easeInOutCubic((progress - 0.52) / 0.22);
  const numberT = easeOutCubic((progress - 0.6) / 0.24);
  const wordT = easeOutCubic((progress - 0.86) / 0.14);
  const displayedYears = Math.round(gapYears * numberT);

  return (
    <AbsoluteFill style={{ backgroundColor: PALETTE.ink, overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 1300px 500px at ${(gapX0 + gapX1) / 2}px 200px, ${PALETTE.soilWarm}3a 0%, transparent 75%)`,
        }}
      />

      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <linearGradient id="eraBandFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PALETTE.gold} stopOpacity={0.32} />
            <stop offset="100%" stopColor={PALETTE.gold} stopOpacity={0.05} />
          </linearGradient>
        </defs>

        {dust.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={PALETTE.bone} opacity={d.op} />
        ))}

        {/* Axis line */}
        <line
          x1={AXIS_X0}
          y1={AXIS_Y}
          x2={lerp(AXIS_X0, AXIS_X1, axisT)}
          y2={AXIS_Y}
          stroke={PALETTE.bone}
          strokeOpacity={0.55}
          strokeWidth={1.5}
        />

        {/* Minor ruler ticks */}
        {minorTicks.map((y) => (
          <line
            key={`minor-${y}`}
            x1={mapX(y)}
            y1={AXIS_Y - 5}
            x2={mapX(y)}
            y2={AXIS_Y + 5}
            stroke={PALETTE.ash}
            strokeOpacity={0.22 * ticksT}
            strokeWidth={1}
          />
        ))}

        {/* Major ticks + year labels */}
        {majorTicks.map((y) => (
          <g key={`major-${y}`} opacity={ticksT}>
            <line x1={mapX(y)} y1={AXIS_Y - 10} x2={mapX(y)} y2={AXIS_Y + 10} stroke={PALETTE.ash} strokeOpacity={0.5} strokeWidth={1.2} />
          </g>
        ))}

        {/* Markers: era bands and point ticks */}
        {markers.map((m, i) => {
          const start = 0.14 + i * 0.07;
          const t = easeOutCubic((progress - start) / 0.22);
          if (t <= 0) return null;

          if (m.kind === 'era') {
            const span = m.span ?? [m.year - 125, m.year + 125];
            const x0 = mapX(Math.min(span[0], span[1]));
            const x1 = mapX(Math.max(span[0], span[1]));
            const w = (x1 - x0) * t;
            return (
              <g key={i} opacity={t}>
                <rect x={x0} y={MARKER_TOP_Y} width={w} height={AXIS_Y - MARKER_TOP_Y} fill="url(#eraBandFade)" />
                <line x1={x0} y1={MARKER_TOP_Y} x2={x0} y2={AXIS_Y} stroke={PALETTE.goldBright} strokeOpacity={0.5} strokeWidth={1.3} />
                <line x1={x1} y1={MARKER_TOP_Y} x2={x1} y2={AXIS_Y} stroke={PALETTE.goldBright} strokeOpacity={0.5} strokeWidth={1.3} />
              </g>
            );
          }
          const x = mapX(m.year);
          const topY = m.year > 1000 ? 380 : MARKER_TOP_Y; // shorter line for the far-right 1873 marker
          return (
            <g key={i} opacity={t}>
              <line x1={x} y1={topY} x2={x} y2={AXIS_Y} stroke={PALETTE.gold} strokeOpacity={0.55} strokeWidth={1.3} strokeDasharray={m.year > 1000 ? '3 5' : undefined} />
              <circle cx={x} cy={AXIS_Y} r={4} fill={PALETTE.gold} opacity={0.9} />
            </g>
          );
        })}

        {/* The gap bracket — the subject of the shot */}
        {bracketT > 0.01 && (
          <g opacity={Math.min(1, bracketT * 1.4)}>
            <line
              x1={gapX0}
              y1={220}
              x2={lerp(gapX0, gapX1, bracketT)}
              y2={220}
              stroke={PALETTE.goldBright}
              strokeWidth={2}
            />
            <line x1={gapX0} y1={210} x2={gapX0} y2={230} stroke={PALETTE.goldBright} strokeWidth={2} />
            {bracketT > 0.94 && (
              <line x1={gapX1} y1={210} x2={gapX1} y2={230} stroke={PALETTE.goldBright} strokeWidth={2} />
            )}
            <line x1={gapX0} y1={230} x2={gapX0} y2={MARKER_TOP_Y} stroke={PALETTE.goldBright} strokeOpacity={0.35} strokeWidth={1} strokeDasharray="2 5" />
            <line x1={gapX1} y1={230} x2={gapX1} y2={MARKER_TOP_Y} stroke={PALETTE.goldBright} strokeOpacity={0.35 * (bracketT > 0.94 ? 1 : 0)} strokeWidth={1} strokeDasharray="2 5" />
          </g>
        )}

        {/* Contrast relief across the section-title safe band */}
        <rect x={0} y={SAFE_AREA.titleBandTop} width={1920} height={SAFE_AREA.titleBandBottom - SAFE_AREA.titleBandTop} fill={PALETTE.ink} opacity={0.32} />
        {/* Contrast relief across the subtitle safe band */}
        <rect x={0} y={1080 - SAFE_AREA.bottom} width={1920} height={SAFE_AREA.bottom} fill={PALETTE.ink} opacity={0.6} />
      </svg>

      {/* HTML labels */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {/* Marker labels */}
        {markers.map((m, i) => {
          const start = 0.14 + i * 0.07;
          const t = easeOutCubic((progress - start) / 0.22);
          if (t <= 0.02) return null;
          const isEra = m.kind === 'era';
          const span = m.span ?? [m.year - 125, m.year + 125];
          const cx = isEra ? (mapX(span[0]) + mapX(span[1])) / 2 : mapX(m.year);
          const isFar = m.year > 1000;
          const labelY = isFar ? 350 : 246;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: cx,
                top: labelY,
                transform: 'translateX(-50%)',
                textAlign: 'center',
                opacity: t,
                whiteSpace: 'nowrap',
              }}
            >
              <div
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 600,
                  fontSize: isFar ? 14 : 17,
                  letterSpacing: 1.5,
                  color: isFar ? PALETTE.bone : PALETTE.goldBright,
                  textTransform: 'uppercase',
                }}
              >
                {m.label}
              </div>
              <div
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 500,
                  fontSize: 13,
                  letterSpacing: 0.6,
                  color: PALETTE.ash,
                  marginTop: 3,
                }}
              >
                {isEra ? `${formatYear(Math.min(span[0], span[1]))} – ${formatYear(Math.max(span[0], span[1]))}` : formatYear(m.year)}
              </div>
            </div>
          );
        })}

        {/* Axis year labels */}
        {majorTicks.map((y) => (
          <div
            key={`lbl-${y}`}
            style={{
              position: 'absolute',
              left: mapX(y),
              top: AXIS_Y + 16,
              transform: 'translateX(-50%)',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500,
              fontSize: 12,
              letterSpacing: 0.5,
              color: PALETTE.ash,
              opacity: 0.55 * ticksT,
            }}
          >
            {formatYear(y)}
          </div>
        ))}

        {/* The hero: gap size, then the single earned display word */}
        {numberT > 0.01 && (
          <div
            style={{
              position: 'absolute',
              left: (gapX0 + gapX1) / 2,
              top: 70,
              transform: 'translateX(-50%)',
              textAlign: 'center',
              opacity: Math.min(1, numberT * 1.3),
            }}
          >
            <div
              style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 700,
                fontSize: 46,
                letterSpacing: 1,
                color: PALETTE.goldBright,
                textShadow: '0 2px 24px rgba(0,0,0,0.7)',
              }}
            >
              {formatWithCommas(displayedYears)} years
            </div>
          </div>
        )}

        {wordT > 0.01 && (
          <div
            style={{
              position: 'absolute',
              left: (gapX0 + gapX1) / 2,
              top: 130,
              transform: 'translateX(-50%)',
              textAlign: 'center',
              opacity: wordT,
            }}
          >
            <div
              style={{
                fontFamily: "'Cinzel', serif",
                fontWeight: 600,
                fontSize: 22,
                letterSpacing: 7,
                color: PALETTE.ember,
                textTransform: 'uppercase',
              }}
            >
              Impossible
            </div>
          </div>
        )}

        {/* Orientation caption, top-left, always low-key */}
        <div
          style={{
            position: 'absolute',
            left: SAFE_AREA.edge,
            top: 88,
            opacity: 0.6 * easeOutCubic(progress / 0.15),
          }}
        >
          <div
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: 14,
              letterSpacing: 3.5,
              color: PALETTE.ash,
              textTransform: 'uppercase',
            }}
          >
            4,000 years, on one line
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

export default DeepTimeline;
