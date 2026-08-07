import React from 'react';
import { AbsoluteFill } from 'remotion';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import type { SceneProps } from './types';
import { SAFE_AREA, PALETTE } from './types';

/**
 * ExcavatorRelay — the argument that finding Troy was a relay across three
 * generations, not one man's triumph: Calvert identified the site and had
 * no money; Schliemann funded and dug it, fast and destructively, and took
 * the credit; Dörpfeld brought systematic method and proposed the war-era
 * layer was higher; Blegen's thorough dig pinned Troy VIIa, c. 1180 BCE.
 *
 * A time spine extends left to right across the WHOLE shot — driven
 * straight off `progress`, so the motion scales to any shot length — with a
 * bright travelling point (the "baton") running along it from Calvert
 * toward Blegen. Each station arrives as the baton reaches it. When
 * `highlight` names a station, that station comes forward (scale + full
 * contrast) once the baton has passed it, while the others settle back —
 * the emphasis itself ramping in smoothly, never a hard cut.
 *
 * options:
 *   highlight?: 'calvert' | 'schliemann' | 'dorpfeld' | 'blegen'
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
const remap01 = (p: number, a: number, b: number) => clamp01((p - a) / Math.max(1e-6, b - a));

type StationId = 'calvert' | 'schliemann' | 'dorpfeld' | 'blegen';

type ExcavatorRelayOptions = {
  highlight?: StationId;
};

type Station = {
  id: StationId;
  name: string;
  years: string;
  line: string;
};

const STATIONS: Station[] = [
  { id: 'calvert', name: 'FRANK CALVERT', years: '1865', line: 'Identified Hisarlik. No money. Written out.' },
  {
    id: 'schliemann',
    name: 'HEINRICH SCHLIEMANN',
    years: '1871–73',
    line: 'Funded the dig — fast, destructive, took the credit.',
  },
  { id: 'dorpfeld', name: 'WILHELM DÖRPFELD', years: '1893–94', line: 'Trained architect. Brought systematic method.' },
  { id: 'blegen', name: 'CARL BLEGEN', years: '1932–38', line: 'Thorough dig. Pinned Troy VIIa, c. 1180 BCE.' },
];

const SPINE_Y = 290;
const SPINE_X0 = 220;
const SPINE_X1 = 1700;
const STATION_X = STATIONS.map((_, i) => SPINE_X0 + ((i + 0.5) / STATIONS.length) * (SPINE_X1 - SPINE_X0));
const PLATE_Y = 166;
const PLATE_R = 32;
const ARRIVE_SOFTNESS = 85; // px window over which a station fades in as the baton nears it
const EMPHASIS_SPAN = 230; // px of further baton travel over which highlight emphasis settles in

// ---------------------------------------------------------------------------
// Abstract, restrained per-person marks — geometric devices, not attempted
// portraits (SVG cannot render a likeness, and a bad one would misrepresent
// a real person).
// ---------------------------------------------------------------------------

const CalvertMark: React.FC<{ color: string }> = ({ color }) => (
  // An incomplete, dashed compass ring — identified the site, but the work
  // (and the credit) was left unfinished.
  <g>
    <circle r={16} fill="none" stroke={color} strokeWidth={1.6} strokeDasharray="5 6" strokeOpacity={0.85} pathLength={100} strokeDashoffset={-8} />
    <circle cx={0} cy={-16} r={1.8} fill={color} opacity={0.9} />
  </g>
);

const SchliemannMark: React.FC<{ color: string }> = ({ color }) => (
  // A bold sunburst — money, speed, dazzle, and a name that eclipsed
  // everyone else's.
  <g>
    {Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return (
        <line
          key={i}
          x1={Math.cos(a) * 9}
          y1={Math.sin(a) * 9}
          x2={Math.cos(a) * 18}
          y2={Math.sin(a) * 18}
          stroke={color}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      );
    })}
    <circle r={8} fill={color} />
  </g>
);

const DorpfeldMark: React.FC<{ color: string }> = ({ color }) => (
  // A drafting square and a small grid — trained architect, systematic
  // method.
  <g>
    <path d="M-14,14 L-14,-12 L14,14 Z" fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    {[-6, 0, 6].map((gx) =>
      [-4, 2].map((gy) => <circle key={`${gx}-${gy}`} cx={gx} cy={gy} r={1.1} fill={color} opacity={0.8} />)
    )}
  </g>
);

const BlegenMark: React.FC<{ color: string; accent: string }> = ({ color, accent }) => (
  // A small stratigraphy — stacked layers with the war-era band picked out,
  // the layer he pinned to c. 1180 BCE.
  <g>
    {[18, 12, 7, 15].map((w, i) => (
      <rect key={i} x={-w / 2} y={-16 + i * 8} width={w} height={6} fill={i === 2 ? accent : color} opacity={i === 2 ? 1 : 0.75} />
    ))}
  </g>
);

export const ExcavatorRelay: React.FC<SceneProps> = ({ progress, frame, fps, seed, options }) => {
  const opts = (options ?? {}) as ExcavatorRelayOptions;
  const highlight = opts.highlight;
  const hasHighlight = Boolean(highlight);

  const seedInt = Math.floor(seed * 1e9) + 1;
  const grain = React.useMemo(() => {
    const rand = mulberry32(seedInt + 13);
    return Array.from({ length: 50 }, () => ({
      x: rand() * 1920,
      y: SAFE_AREA.edge + rand() * (SAFE_AREA.titleBandTop - SAFE_AREA.edge - 20),
      r: 0.5 + rand() * 1,
      o: 0.03 + rand() * 0.05,
    }));
  }, [seedInt]);

  // The spine draws continuously across the whole shot; the baton is its
  // leading edge, so "spine extending" and "baton travelling" are the same
  // motion, always in progress at any two nearby progress values.
  const spineT = easeInOutCubic(progress);
  const leadingX = lerp(SPINE_X0, SPINE_X1, spineT);

  const idleT = frame / fps;

  return (
    <AbsoluteFill style={{ backgroundColor: PALETTE.ink, overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 1300px 500px at 50% 14%, ${PALETTE.soilWarm}30 0%, transparent 70%)`,
        }}
      />

      {/* Static grain, confined to the working band */}
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        {grain.map((g, i) => (
          <circle key={i} cx={g.x} cy={g.y} r={g.r} fill={PALETTE.bone} opacity={g.o} />
        ))}

        {/* Spine track (full extent, very faint, for context) */}
        <line x1={SPINE_X0} y1={SPINE_Y} x2={SPINE_X1} y2={SPINE_Y} stroke={PALETTE.ash} strokeWidth={1} strokeOpacity={0.18} />

        {/* Spine draw-on */}
        <line
          x1={SPINE_X0}
          y1={SPINE_Y}
          x2={leadingX}
          y2={SPINE_Y}
          stroke={PALETTE.bronze}
          strokeWidth={1.5}
          strokeOpacity={0.75}
        />

        {/* Travelling baton with a short fading trail */}
        {[0, 24, 48, 74].map((back, i) => {
          const bx = Math.max(SPINE_X0, leadingX - back);
          const o = (1 - i * 0.26) * (i === 0 ? 1 : 0.5);
          return <circle key={i} cx={bx} cy={SPINE_Y} r={i === 0 ? 5 : 3 - i * 0.4} fill={PALETTE.goldBright} opacity={o} />;
        })}
        <circle cx={leadingX} cy={SPINE_Y} r={11} fill="none" stroke={PALETTE.goldBright} strokeWidth={1} opacity={0.35} />

        {STATIONS.map((st, i) => {
          const x = STATION_X[i];
          const arrive = easeOutCubic(remap01(leadingX, x - ARRIVE_SOFTNESS, x + ARRIVE_SOFTNESS * 0.4));
          const emphasis = hasHighlight ? easeOutCubic(remap01(leadingX, x + 30, x + 30 + EMPHASIS_SPAN)) : 0;
          const isHi = st.id === highlight;
          const dim = hasHighlight && !isHi;

          const scale = hasHighlight ? lerp(1, isHi ? 1.12 : 0.88, emphasis) : 1;
          const fadeMul = hasHighlight ? lerp(1, isHi ? 1 : 0.42, emphasis) : 1;
          const opacity = arrive * fadeMul;

          const bob = Math.sin(idleT * ((Math.PI * 2) / 5) + i * 1.7) * (isHi ? 2.2 : 1.1);
          const glowPulse = isHi ? 0.5 + 0.5 * Math.sin(idleT * ((Math.PI * 2) / 4.2)) : 0;

          const markColor = isHi ? PALETTE.goldBright : dim ? PALETTE.ash : PALETTE.gold;

          return (
            <g key={st.id} opacity={opacity} transform={`translate(${x},0)`}>
              {/* Stem connecting plate to spine */}
              <line
                x1={0}
                y1={PLATE_Y + PLATE_R}
                x2={0}
                y2={SPINE_Y}
                stroke={PALETTE.ash}
                strokeWidth={1}
                strokeOpacity={0.3 * arrive}
              />

              {/* Node on the spine */}
              <circle cx={0} cy={SPINE_Y} r={isHi ? 5.5 : 4} fill={isHi ? PALETTE.goldBright : dim ? PALETTE.soilWarm : PALETTE.gold} stroke={PALETTE.ink} strokeWidth={1} />

              {/* Plate */}
              <g transform={`translate(0,${PLATE_Y + bob}) scale(${scale})`}>
                {isHi && (
                  <circle r={PLATE_R + 10} fill="none" stroke={PALETTE.goldBright} strokeWidth={1} opacity={0.28 * arrive + 0.14 * glowPulse} />
                )}
                <circle r={PLATE_R} fill={PALETTE.soil} stroke={markColor} strokeOpacity={0.6} strokeWidth={1} />
                {st.id === 'calvert' && <CalvertMark color={markColor} />}
                {st.id === 'schliemann' && <SchliemannMark color={markColor} />}
                {st.id === 'dorpfeld' && <DorpfeldMark color={markColor} />}
                {st.id === 'blegen' && <BlegenMark color={markColor} accent={isHi ? PALETTE.goldBright : PALETTE.ember} />}
              </g>
            </g>
          );
        })}

        {/* Contrast relief across the section-title safe band (spine and
            plates sit above it, but keep any stray overlap calm). */}
        <rect
          x={0}
          y={SAFE_AREA.titleBandTop}
          width={1920}
          height={SAFE_AREA.titleBandBottom - SAFE_AREA.titleBandTop}
          fill={PALETTE.ink}
          opacity={0.25}
        />
        <rect x={0} y={1080 - SAFE_AREA.bottom} width={1920} height={SAFE_AREA.bottom} fill={PALETTE.ink} opacity={0.55} />
      </svg>

      {/* Text labels — HTML for crisp Inter type */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {STATIONS.map((st, i) => {
          const x = STATION_X[i];
          const arrive = easeOutCubic(remap01(leadingX, x - ARRIVE_SOFTNESS, x + ARRIVE_SOFTNESS * 0.4));
          const emphasis = hasHighlight ? easeOutCubic(remap01(leadingX, x + 30, x + 30 + EMPHASIS_SPAN)) : 0;
          const isHi = st.id === highlight;
          const dim = hasHighlight && !isHi;
          const fadeMul = hasHighlight ? lerp(1, isHi ? 1 : 0.42, emphasis) : 1;
          const opacity = arrive * fadeMul;
          const drift = (1 - arrive) * 10;

          return (
            <div
              key={st.id}
              style={{
                position: 'absolute',
                left: x - 200,
                top: SPINE_Y + 10,
                width: 400,
                textAlign: 'center',
                opacity,
                transform: `translateY(${drift}px)`,
              }}
            >
              <div
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 500,
                  fontSize: 11.5,
                  letterSpacing: 1.5,
                  color: isHi ? PALETTE.gold : PALETTE.ash,
                }}
              >
                {st.years}
              </div>
              <div
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: isHi ? 700 : 600,
                  fontSize: isHi ? 21 : 18,
                  letterSpacing: 1.5,
                  color: isHi ? PALETTE.goldBright : dim ? PALETTE.ash : PALETTE.bone,
                  marginTop: 4,
                  whiteSpace: 'nowrap',
                }}
              >
                {st.name}
              </div>
              <div
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: 400,
                  fontSize: 12.5,
                  lineHeight: 1.35,
                  letterSpacing: 0.2,
                  color: isHi ? PALETTE.bone : PALETTE.ash,
                  marginTop: 5,
                  opacity: isHi ? 0.95 : 0.7,
                }}
              >
                {st.line}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export default ExcavatorRelay;
