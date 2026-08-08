import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import type { SceneProps } from './types';
import {
  Plate, PLATE, HatchField, StippleField, InkPath, PlateCaption,
  hatch, stipple, contour, segment, wobblyRect,
  rngFor, makeFbm1D, lerp, clamp01,
  onNs, rakingLight, ramp, stagger, settle, pulse, anticipate,
  easeOutCubic, easeInOutCubic, easeOutQuint,
} from './engraving';

/**
 * DeepTimeline — the fact the whole treasure section turns on.
 *
 * Schliemann found the gold in Troy II. Troy II ends around 2350 BCE. Any
 * Trojan War, if there was one, is around 1180 BCE. The gold he called
 * "Priam's Treasure" is older than Priam by something like thirteen hundred
 * years — longer than the gap between us and Charlemagne.
 *
 * Cut as an engraved chronological scale: a ruled bar with century divisions,
 * the two events pinned to it, and then a dimension line thrown across the
 * distance between them. The animation is built entirely around the moment
 * the measurement lands — everything before it is setup, and it arrives with
 * anticipation, a snap, and a settle, not a fade.
 *
 * options:
 *   emphasizeGap?: [number, number]  — the two years to measure between.
 */

const W = 1920;
const H = 1080;

const AXIS_Y = 470;
const AXIS_X0 = 190;
const AXIS_X1 = 1740;

/** The scale runs from 3200 BCE to 500 CE, matching the strata section. */
const YEAR_MIN = -3200;
const YEAR_MAX = 500;
const xOf = (year: number) =>
  AXIS_X0 + ((year - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * (AXIS_X1 - AXIS_X0);

type Options = { emphasizeGap?: [number, number] };

/**
 * The nine cities, with their date ranges — the same stratigraphy as the
 * section scene, laid out horizontally against real time.
 */
const CITIES = [
  { id: 'I',    from: -3000, to: -2550, texture: 'fill' as const },
  { id: 'II',   from: -2600, to: -2350, texture: 'gold' as const },
  { id: 'III',  from: -2350, to: -2200, texture: 'fill' as const },
  { id: 'IV',   from: -2200, to: -1900, texture: 'fill' as const },
  { id: 'V',    from: -1900, to: -1700, texture: 'fill' as const },
  { id: 'VI',   from: -1700, to: -1300, texture: 'masonry' as const },
  { id: 'VIIa', from: -1300, to: -1180, texture: 'burnt' as const },
  { id: 'VIIb', from: -1180, to: -950,  texture: 'fill' as const },
  { id: 'VIII', from: -950,  to: -85,   texture: 'masonry' as const },
  { id: 'IX',   from: -85,   to: 500,   texture: 'masonry' as const },
];

const EVENTS = [
  { year: -2500, label: 'TROY II', note: 'the gold Schliemann found', key: 'a' as const },
  { year: -1180, label: 'THE TROJAN WAR', note: 'if it happened, about here', key: 'b' as const },
];

export const DeepTimeline: React.FC<SceneProps> = ({ progress, frame, fps, seed, options }) => {
  const opts = (options ?? {}) as Options;
  const gap = opts.emphasizeGap ?? [-2500, -1180];
  const gapYears = Math.abs(gap[1] - gap[0]);

  const geo = useMemo(() => {
    const fbm = makeFbm1D(seed, 'tl');

    const axis = contour(seed, 'axis',
      segment({ x: AXIS_X0 - 40, y: AXIS_Y }, { x: AXIS_X1 + 40, y: AXIS_Y + 2 }, 40), 1.4, 320);

    // Century ticks; every fifth is long and labelled.
    const ticks: { x: number; year: number; major: boolean; line: { d: string; len: number } }[] = [];
    for (let y = -3000; y <= 500; y += 100) {
      const x = xOf(y);
      const major = y % 500 === 0;
      ticks.push({
        x, year: y, major,
        line: contour(seed, `tk${y}`,
          segment({ x, y: AXIS_Y }, { x: x + fbm(y * 0.01) * 1.5, y: AXIS_Y + (major ? 26 : 13) }, 3), 0.7, 40),
      });
    }

    // Tone under the axis — a hatched band, so the rule sits on something.
    const band = hatch(seed, 'band', {
      x: AXIS_X0 - 60, y: AXIS_Y + 34, w: AXIS_X1 - AXIS_X0 + 120, h: 34,
      angle: 0, pitch: 9, amp: 1.6, coverage: 0.8, jitter: 0.5, width: 0.8, samples: 12,
      density: (_u, v) => clamp01(1.1 - v * 1.5),
    });

    // The nine cities, laid along the scale at their true dates.
    //
    // This is the whole point of the plate, and the first version missed it: a
    // bare rule across an empty frame states the gap but does not SHOW it.
    // Laying the strata out horizontally — the section turned on its side —
    // makes the distance between the gold and the war a physical span of
    // occupied ground rather than an abstract number.
    const CITY_TOP = AXIS_Y + 86;
    const CITY_H = 208;
    const cities = CITIES.map((c, i) => {
      const x0 = xOf(c.from);
      const x1 = xOf(c.to);
      const w = Math.max(6, x1 - x0);
      const region = { x: x0, y: CITY_TOP, w, h: CITY_H };
      let marks: ReturnType<typeof hatch>;
      if (c.texture === 'burnt') {
        marks = hatch(seed, `c${i}`, {
          ...region, angle: 68, pitch: 6, amp: 1.8, coverage: 0.5, jitter: 1.4,
          width: 1.15, samples: 5, density: (u, v) => clamp01(0.5 + fbm(u * 9 + v * 4 + i) * 0.8),
        });
      } else if (c.texture === 'gold') {
        marks = hatch(seed, `c${i}`, {
          ...region, angle: 22, pitch: 8, amp: 1.2, coverage: 0.8, jitter: 0.5,
          width: 1.1, samples: 8, density: (u, v) => clamp01(0.65 + fbm(u * 6 + i) * 0.6) * clamp01(1.2 - v * 0.6),
        });
      } else if (c.texture === 'masonry') {
        marks = hatch(seed, `c${i}`, {
          ...region, angle: 90, pitch: 13, amp: 1.1, coverage: 0.78, jitter: 0.4,
          width: 0.95, samples: 8, density: (u, v) => clamp01(0.45 + fbm(u * 7 + i * 2) * 0.7) * clamp01(1.25 - v * 0.7),
        });
      } else {
        marks = hatch(seed, `c${i}`, {
          ...region, angle: 40, pitch: 15, amp: 1.5, coverage: 0.5, jitter: 1.2,
          width: 0.9, samples: 6, density: (u, v) => clamp01(0.4 + fbm(u * 6 + v + i * 3) * 0.75) * clamp01(1.2 - v * 0.8),
        });
      }
      return { ...c, x0, x1, w, marks, index: i, top: CITY_TOP, height: CITY_H };
    });

    // The comparison ruler: the same span laid against our own era, which is
    // what makes 1,300 years land as a real quantity rather than a number.
    const modernBand = hatch(seed, 'modern', {
      x: AXIS_X0, y: 806, w: AXIS_X1 - AXIS_X0, h: 18,
      angle: 0, pitch: 7, amp: 1.2, coverage: 0.85, jitter: 0.4, width: 0.75, samples: 10,
    });

    const grain = stipple(seed, 'tlgrain', {
      x: 0, y: 120, w: W, h: 760, count: 420, minR: 0.5, maxR: 1.6,
      density: (_u, v) => clamp01(0.7 - Math.abs(v - 0.45) * 1.1),
    });

    return { axis, ticks, band, modernBand, grain, cities };
  }, [seed]);

  const p = clamp01(progress);

  const tAxis = ramp(p, 0.02, 0.22);
  const tTicks = ramp(p, 0.10, 0.38);
  const tBand = ramp(p, 0.16, 0.44);

  // The two events arrive one at a time, each with a hard landing.
  const tA = ramp(p, 0.26, 0.36);
  const tB = ramp(p, 0.42, 0.52);

  // The measurement. This is the shot's payload, so it gets the full
  // anticipate → snap → settle treatment, and a beat of stillness after.
  const tSpan = ramp(p, 0.56, 0.70);
  const spanGrow = anticipate(tSpan, 0.10, 0.05);
  const tNumber = ramp(p, 0.66, 0.74);
  const numberScale = settle(tNumber, 0.14);
  const numberHit = pulse(p, 0.685, 0.045);

  // The comparison arrives last, after the number has been held.
  const tCompare = ramp(p, 0.80, 0.92);

  // Camera: essentially still while the argument is made, then a slow settle
  // in on the gap once the number has landed. Motion where it means something.
  const closeIn = easeInOutCubic(ramp(p, 0.72, 1.0));
  const gapMidX = (xOf(gap[0]) + xOf(gap[1])) / 2;
  const camScale = 1.0 + closeIn * 0.12;
  const camX = (W / 2 - gapMidX) * (camScale - 1) / camScale;

  const sweep = rakingLight(frame, fps, 29, seed);
  const litness = (u: number) => 1 + 0.45 * Math.exp(-Math.pow((u - lerp(-0.2, 1.2, sweep)) / 0.25, 2));

  const xa = xOf(gap[0]);
  const xb = xOf(gap[1]);
  const spanX1 = lerp(xa, xb, clamp01(spanGrow));
  const SPAN_Y = AXIS_Y - 168;

  const fmtYear = (y: number) => (y < 0 ? `${Math.abs(y)} BCE` : `${y} CE`);

  return (
    <Plate seed={seed} frame={frame} fps={fps} tone="neutral" lightPeriodSec={29} lightStrength={0.8}>
      <AbsoluteFill
        style={{
          transform: `scale(${camScale.toFixed(4)}) translateX(${camX.toFixed(2)}px)`,
          transformOrigin: '50% 45%',
        }}
      >
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute' }}>
          <StippleField dots={geo.grain} t={tBand} color={PLATE.cut} alpha={0.22} />

          {/* The nine cities, occupying real time under the scale. */}
          {geo.cities.map((c) => {
            const ct = stagger(ramp(p, 0.16, 0.56), c.index, geo.cities.length, 0.05, 0.3);
            if (ct <= 0.01) return null;
            const isGold = c.texture === 'gold';
            const isBurnt = c.texture === 'burnt';
            const col = isGold ? PLATE.gold : isBurnt ? PLATE.ember : PLATE.cut;
            return (
              <g key={c.id}>
                <HatchField
                  strokes={c.marks}
                  t={ct}
                  color={col}
                  alpha={isGold || isBurnt ? 0.8 : 0.42}
                  passes={4}
                  modulate={(s) => litness(s.k)}
                />
                <line
                  x1={c.x0} y1={c.top} x2={c.x0} y2={c.top + c.height * ct}
                  stroke={PLATE.cut} strokeWidth={1.1} opacity={0.45}
                />
                <text
                  x={(c.x0 + c.x1) / 2} y={c.top + c.height + 30}
                  textAnchor="middle" fill={isGold ? PLATE.gold : PLATE.cutDim}
                  opacity={clamp01((ct - 0.5) / 0.5) * (c.w > 34 ? 0.9 : 0)}
                  style={{ fontFamily: "'Cinzel', serif", fontWeight: 600, fontSize: 21, letterSpacing: 1.6 }}
                >
                  {c.id}
                </text>
              </g>
            );
          })}
          <text
            x={AXIS_X0 - 40} y={AXIS_Y + 86 + 208 + 30}
            textAnchor="end" fill={PLATE.cutFaint}
            opacity={0.8 * ramp(p, 0.2, 0.4)}
            style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 16, letterSpacing: 2 }}
          >
            CITY
          </text>

          {/* The scale. */}
          <InkPath d={geo.axis.d} len={geo.axis.len} t={tAxis} color={PLATE.cut} width={2.2} opacity={0.9} />
          <HatchField strokes={geo.band} t={tBand} color={PLATE.cut} alpha={0.3} passes={5} modulate={(s) => litness(s.k)} />

          {geo.ticks.map((tk, i) => {
            const tt = stagger(tTicks, i, geo.ticks.length, 0.014, 0.2);
            if (tt <= 0.02) return null;
            return (
              <g key={i}>
                <InkPath d={tk.line.d} len={tk.line.len} t={tt} color={PLATE.cut} width={tk.major ? 1.5 : 0.9} opacity={tk.major ? 0.8 : 0.45} />
                {tk.major ? (
                  <text
                    x={tk.x} y={AXIS_Y + 52}
                    textAnchor="middle" fill={PLATE.cutDim} opacity={0.75 * tt}
                    style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 16, letterSpacing: 1.1 }}
                  >
                    {fmtYear(tk.year)}
                  </text>
                ) : null}
              </g>
            );
          })}

          {/* The two events. */}
          {EVENTS.map((ev, i) => {
            const t = i === 0 ? tA : tB;
            if (t <= 0.01) return null;
            const sc = settle(t, 0.2);
            const x = xOf(ev.year);
            const isGold = i === 0;
            const col = isGold ? PLATE.goldBright : PLATE.cut;
            const stemH = i === 0 ? 96 : 62;
            return (
              <g key={ev.key}>
                <line
                  x1={x} y1={AXIS_Y}
                  x2={x} y2={AXIS_Y - stemH * sc}
                  stroke={col} strokeWidth={1.8} opacity={0.8}
                />
                <circle cx={x} cy={AXIS_Y} r={7 * sc} fill={col} opacity={0.95} />
                <circle cx={x} cy={AXIS_Y} r={22 + pulse(p, i === 0 ? 0.30 : 0.46, 0.05) * 40}
                  fill="none" stroke={col} strokeWidth={1.5}
                  opacity={pulse(p, i === 0 ? 0.30 : 0.46, 0.05) * 0.8} />
                <g opacity={clamp01((t - 0.35) / 0.5)}>
                  <text
                    x={x} y={AXIS_Y - stemH - 16}
                    textAnchor="middle" fill={col}
                    style={{ fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: 30, letterSpacing: 3 }}
                  >
                    {ev.label}
                  </text>
                  <text
                    x={x} y={AXIS_Y - stemH + 10}
                    textAnchor="middle" fill={PLATE.cutDim}
                    style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 17, letterSpacing: 1.2 }}
                  >
                    {ev.note}
                  </text>
                </g>
              </g>
            );
          })}

          {/* The dimension line — the actual argument. */}
          {tSpan > 0.01 ? (
            <g>
              <line x1={xa} y1={AXIS_Y - 20} x2={xa} y2={SPAN_Y - 12} stroke={PLATE.ember} strokeWidth={1.3} opacity={0.6} />
              <line x1={xb} y1={AXIS_Y - 20} x2={xb} y2={SPAN_Y - 12} stroke={PLATE.ember} strokeWidth={1.3} opacity={0.6 * clamp01(spanGrow * 3)} />
              <line x1={xa} y1={SPAN_Y} x2={spanX1} y2={SPAN_Y} stroke={PLATE.ember} strokeWidth={2.6} opacity={0.95} />
              {/* Arrow heads, drawn only once the line has arrived. */}
              <path d={`M ${xa} ${SPAN_Y} l 16 -8 l 0 16 Z`} fill={PLATE.ember} opacity={0.95} />
              <path
                d={`M ${xb} ${SPAN_Y} l -16 -8 l 0 16 Z`}
                fill={PLATE.ember}
                opacity={0.95 * clamp01((spanGrow - 0.9) * 10)}
              />
            </g>
          ) : null}

          {/* The number. Lands hard, then holds. */}
          {tNumber > 0.01 ? (
            <g transform={`translate(${(xa + xb) / 2}, ${SPAN_Y - 54})`} opacity={clamp01(tNumber * 2)}>
              <g transform={`scale(${numberScale.toFixed(4)})`}>
                <text
                  x={0} y={0}
                  textAnchor="middle" fill={PLATE.goldBright}
                  style={{ fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: 74, letterSpacing: 4 }}
                >
                  {gapYears.toLocaleString('en-US')} YEARS
                </text>
              </g>
              <text
                x={0} y={34}
                textAnchor="middle" fill={PLATE.ember}
                opacity={clamp01((tNumber - 0.5) / 0.5)}
                style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 21, letterSpacing: 2.4 }}
              >
                BETWEEN THE GOLD AND THE WAR
              </text>
              {/* The bite of the impact. */}
              <circle r={40 + numberHit * 200} fill="none" stroke={PLATE.goldBright} strokeWidth={2} opacity={numberHit * 0.5} />
            </g>
          ) : null}

          {/* The comparison ruler. */}
          {tCompare > 0.01 ? (
            <g opacity={clamp01(tCompare * 1.4)}>
              <HatchField strokes={geo.modernBand} t={tCompare} color={PLATE.cutDim} alpha={0.3} passes={4} />
              <line
                x1={AXIS_X0} y1={800}
                x2={lerp(AXIS_X0, AXIS_X0 + (xb - xa), easeOutQuint(tCompare))} y2={800}
                stroke={PLATE.cut} strokeWidth={2.2} opacity={0.8}
              />
              <text
                x={AXIS_X0} y={782}
                fill={PLATE.cut} opacity={clamp01((tCompare - 0.4) / 0.6)}
                style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 20, letterSpacing: 1.8 }}
              >
                THE SAME DISTANCE, FOR US: CHARLEMAGNE TO NOW
              </text>
            </g>
          ) : null}
        </svg>
      </AbsoluteFill>

      <PlateCaption
        x={96}
        y={96}
        title="The gap"
        sub="Chronological scale · Hisarlık, 3200 BCE – 500 CE"
        t={ramp(p, 0.0, 0.16)}
      />
    </Plate>
  );
};
