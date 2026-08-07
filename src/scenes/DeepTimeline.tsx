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
 * separation — so the gold could not have belonged to Priam.
 *
 * A single honest, linear deep-time axis. The whole shot is one continuous
 * move: a scan line travels left-to-right across the axis at a pace tied
 * directly to `progress` (progress literally *is* position on the axis),
 * drawing the line as it goes and waking each marker as it arrives. While
 * the scanner crosses the gap between Troy II and the war date, a
 * measuring bracket extends and a year-counter accumulates in step with
 * it — the gap is measured out in front of the viewer, not just labelled.
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
// Smooth 0->1->0 rise-and-hold-and-fall isn't needed here; this is a plain
// smoothstep used to soften marker "arrival" as the scanner passes them.
const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
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

  // A faint scatter of "deep time" dust — static positions, drifting very
  // slowly with the scan so the field never feels frozen.
  const dust = useMemo(() => {
    const rand = mulberry32(seedInt + 4);
    return Array.from({ length: 40 }).map(() => ({
      x: rand() * 1920,
      y: rand() * 260,
      r: 0.6 + rand() * 1.2,
      op: 0.05 + rand() * 0.12,
      driftSpeed: 4 + rand() * 10,
    }));
  }, [seedInt]);

  // --- The scan: progress *is* position on the axis. The whole shot is a
  // single continuous, eased traversal from the deep past to the present.
  const scanT = easeInOutCubic(progress);
  const scanX = lerp(AXIS_X0, AXIS_X1, scanT);

  // The gap "measures itself out" as the scanner crosses it.
  const gapCrossT = clamp01((scanX - gapX0) / Math.max(1, gapX1 - gapX0));
  const displayedYears = Math.round(gapYears * gapCrossT);
  // Once the measurement is complete, the display word fades in as the
  // scanner continues past it — driven by scan position (always monotonic
  // and continuous with `progress`), never by inverting the eased curve,
  // so there is no snap when the measurement finishes.
  const pastGapPx = Math.max(0, scanX - gapX1);
  const wordT = easeOutCubic(pastGapPx / 200);

  return (
    <AbsoluteFill style={{ backgroundColor: PALETTE.ink, overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 900px 480px at ${scanX}px 260px, ${PALETTE.soilWarm}3a 0%, transparent 75%)`,
        }}
      />

      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <linearGradient id="eraBandFade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PALETTE.gold} stopOpacity={0.32} />
            <stop offset="100%" stopColor={PALETTE.gold} stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="scanGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PALETTE.goldBright} stopOpacity={0} />
            <stop offset="45%" stopColor={PALETTE.goldBright} stopOpacity={0.85} />
            <stop offset="100%" stopColor={PALETTE.goldBright} stopOpacity={0} />
          </linearGradient>
        </defs>

        {dust.map((d, i) => {
          const x = ((d.x + progress * d.driftSpeed * 8) % 1920 + 1920) % 1920;
          return <circle key={i} cx={x} cy={d.y} r={d.r} fill={PALETTE.bone} opacity={d.op} />;
        })}

        {/* Axis line — grows with the scanner, a continuous draw for the
            whole shot. */}
        <line x1={AXIS_X0} y1={AXIS_Y} x2={scanX} y2={AXIS_Y} stroke={PALETTE.bone} strokeOpacity={0.55} strokeWidth={1.5} />
        {/* Faint full-length guide so the destination reads immediately. */}
        <line x1={scanX} y1={AXIS_Y} x2={AXIS_X1} y2={AXIS_Y} stroke={PALETTE.ash} strokeOpacity={0.14} strokeWidth={1} />

        {/* Minor ruler ticks, revealed as the scanner passes */}
        {minorTicks.map((y) => {
          const x = mapX(y);
          const t = smoothstep(x - 30, x + 6, scanX);
          if (t <= 0.01) return null;
          return <line key={`minor-${y}`} x1={x} y1={AXIS_Y - 5} x2={x} y2={AXIS_Y + 5} stroke={PALETTE.ash} strokeOpacity={0.22 * t} strokeWidth={1} />;
        })}
        {majorTicks.map((y) => {
          const x = mapX(y);
          const t = smoothstep(x - 30, x + 6, scanX);
          if (t <= 0.01) return null;
          return <line key={`major-${y}`} x1={x} y1={AXIS_Y - 10} x2={x} y2={AXIS_Y + 10} stroke={PALETTE.ash} strokeOpacity={0.5 * t} strokeWidth={1.2} />;
        })}

        {/* Markers: era bands and point ticks — wake as the scanner
            reaches them. */}
        {markers.map((m, i) => {
          if (m.kind === 'era') {
            const span = m.span ?? [m.year - 125, m.year + 125];
            const x0 = mapX(Math.min(span[0], span[1]));
            const x1 = mapX(Math.max(span[0], span[1]));
            const fillT = clamp01((scanX - x0) / Math.max(1, x1 - x0));
            const w = (x1 - x0) * fillT;
            const arrive = smoothstep(x0 - 20, x0 + 10, scanX);
            if (arrive <= 0.01) return null;
            const pulse = 1 + 0.08 * Math.sin(progress * Math.PI * 2 * 2.2);
            return (
              <g key={i} opacity={arrive}>
                <rect x={x0} y={MARKER_TOP_Y} width={w} height={AXIS_Y - MARKER_TOP_Y} fill="url(#eraBandFade)" opacity={pulse} />
                <line x1={x0} y1={MARKER_TOP_Y} x2={x0} y2={AXIS_Y} stroke={PALETTE.goldBright} strokeOpacity={0.5} strokeWidth={1.3} />
                {fillT > 0.97 && <line x1={x1} y1={MARKER_TOP_Y} x2={x1} y2={AXIS_Y} stroke={PALETTE.goldBright} strokeOpacity={0.5} strokeWidth={1.3} />}
              </g>
            );
          }
          const x = mapX(m.year);
          const topY = m.year > 1000 ? 380 : MARKER_TOP_Y; // shorter line for the far-right 1873 marker
          const arrive = smoothstep(x - 10, x + 10, scanX);
          if (arrive <= 0.01) return null;
          const flash = Math.max(0, 1 - Math.abs(scanX - x) / 26);
          return (
            <g key={i} opacity={arrive}>
              <line x1={x} y1={topY} x2={x} y2={AXIS_Y} stroke={PALETTE.gold} strokeOpacity={0.55} strokeWidth={1.3} strokeDasharray={m.year > 1000 ? '3 5' : undefined} />
              <circle cx={x} cy={AXIS_Y} r={4 + flash * 3} fill={PALETTE.gold} opacity={0.9} />
              {flash > 0.05 && <circle cx={x} cy={AXIS_Y} r={10 + flash * 10} fill="none" stroke={PALETTE.goldBright} strokeOpacity={flash * 0.5} strokeWidth={1.2} />}
            </g>
          );
        })}

        {/* The gap bracket — actively measures itself out as the scanner
            crosses it, the shot's whole reason for being. */}
        {scanX > gapX0 - 4 && (
          <g opacity={smoothstep(gapX0 - 20, gapX0 + 10, scanX)}>
            <line x1={gapX0} y1={220} x2={Math.min(scanX, gapX1)} y2={220} stroke={PALETTE.goldBright} strokeWidth={2} />
            <line x1={gapX0} y1={210} x2={gapX0} y2={230} stroke={PALETTE.goldBright} strokeWidth={2} />
            {gapCrossT > 0.98 && <line x1={gapX1} y1={210} x2={gapX1} y2={230} stroke={PALETTE.goldBright} strokeWidth={2} />}
            <line x1={gapX0} y1={230} x2={gapX0} y2={MARKER_TOP_Y} stroke={PALETTE.goldBright} strokeOpacity={0.35} strokeWidth={1} strokeDasharray="2 5" />
            {gapCrossT > 0.98 && <line x1={gapX1} y1={230} x2={gapX1} y2={MARKER_TOP_Y} stroke={PALETTE.goldBright} strokeOpacity={0.35} strokeWidth={1} strokeDasharray="2 5" />}
            {/* Hatch marks accumulate along the bracket as it extends, so the
                span reads as measured, not just drawn. */}
            {Array.from({ length: Math.floor(gapCrossT * 24) }).map((_, hi) => {
              const hx = lerp(gapX0, gapX1, hi / 24);
              if (hx > scanX) return null;
              return <line key={hi} x1={hx} y1={216} x2={hx} y2={224} stroke={PALETTE.goldBright} strokeOpacity={0.5} strokeWidth={1} />;
            })}
            {/* The scan cursor itself, while actively measuring */}
            {gapCrossT > 0.02 && gapCrossT < 0.999 && (
              <circle cx={Math.min(scanX, gapX1)} cy={220} r={3.5} fill={PALETTE.goldBright} />
            )}
          </g>
        )}

        {/* The scan line — the primary continuous motion of the shot */}
        <rect x={scanX - 1.5} y={40} width={3} height={AXIS_Y - 40} fill="url(#scanGlow)" opacity={progress < 0.985 ? 0.9 : 0.9 * (1 - (progress - 0.985) / 0.015)} />

        {/* Contrast relief across the section-title safe band */}
        <rect x={0} y={SAFE_AREA.titleBandTop} width={1920} height={SAFE_AREA.titleBandBottom - SAFE_AREA.titleBandTop} fill={PALETTE.ink} opacity={0.32} />
        {/* Contrast relief across the subtitle safe band */}
        <rect x={0} y={1080 - SAFE_AREA.bottom} width={1920} height={SAFE_AREA.bottom} fill={PALETTE.ink} opacity={0.6} />
      </svg>

      {/* HTML labels */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {/* Marker labels */}
        {markers.map((m, i) => {
          const isEra = m.kind === 'era';
          const span = m.span ?? [m.year - 125, m.year + 125];
          const cx = isEra ? (mapX(span[0]) + mapX(span[1])) / 2 : mapX(m.year);
          const isFar = m.year > 1000;
          const labelY = isFar ? 350 : 246;
          const arrive = smoothstep(cx - 30, cx + 10, scanX);
          if (arrive <= 0.02) return null;
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: cx,
                top: labelY,
                transform: 'translateX(-50%)',
                textAlign: 'center',
                opacity: arrive,
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
        {majorTicks.map((y) => {
          const x = mapX(y);
          const t = smoothstep(x - 30, x + 6, scanX);
          if (t <= 0.02) return null;
          return (
            <div
              key={`lbl-${y}`}
              style={{
                position: 'absolute',
                left: x,
                top: AXIS_Y + 16,
                transform: 'translateX(-50%)',
                fontFamily: 'Inter, sans-serif',
                fontWeight: 500,
                fontSize: 12,
                letterSpacing: 0.5,
                color: PALETTE.ash,
                opacity: 0.55 * t,
              }}
            >
              {formatYear(y)}
            </div>
          );
        })}

        {/* The hero: gap size ticking up live as the scanner measures it,
            then the single earned display word once it's complete. */}
        {gapCrossT > 0.01 && (
          <div
            style={{
              position: 'absolute',
              left: (gapX0 + gapX1) / 2,
              top: 70,
              transform: 'translateX(-50%)',
              textAlign: 'center',
              opacity: Math.min(1, gapCrossT * 6),
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
                fontVariantNumeric: 'tabular-nums',
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
            opacity: 0.6 * easeOutCubic(progress / 0.1),
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
