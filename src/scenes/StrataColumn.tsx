import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import type { SceneProps } from './types';
import {
  Plate, PLATE, HatchField, StippleField, InkPath,
  hatch, hatchContours, stipple, flicks, contour, segment, wobble, wobblyRect,
  rngFor, makeFbm1D, lerp, clamp01, clamp,
  onNs, rakingLight, ramp, stagger, settle, pulse, anticipate,
  easeOutCubic, easeInOutCubic, easeOutQuint,
} from './engraving';

/**
 * StrataColumn — the central fact of the dig: Hisarlık is not one city but at
 * least nine, stacked across four thousand years.
 *
 * Re-cut as an engraved section of the kind that faces page one of an
 * excavation report. Each of the nine layers is a band of the block worked in
 * its OWN mark-making — coursed masonry for the stone cities, close horizontal
 * rule for silt, a broken flick-field for burnt destruction debris, stipple for
 * loose fill — so a viewer can tell the layers apart by texture before reading
 * a single numeral. That is the thing a flat colour-banded diagram cannot do.
 *
 * The camera sinks slowly down the section for the whole shot. Ticks and
 * numerals draw themselves out in the margin, each trailing the band it
 * annotates by a few frames.
 *
 * options:
 *   highlight?: string | string[]   — layer id(s) to bring up.
 *   mode?: 'intact' | 'destroyed'   — 'destroyed' gouges the upper layers away
 *                                     over the shot and leaves ghost outlines.
 */

const W = 1920;
const H = 1080;

/** The section occupies the right two-thirds; the margin carries the labels. */
const COL_X = 690;
const COL_W = 900;
const COL_TOP = 96;
const COL_BOTTOM = 812;
const COL_H = COL_BOTTOM - COL_TOP;
const LABEL_RIGHT = 655;

type Texture = 'masonry' | 'silt' | 'burnt' | 'fill' | 'gold' | 'rubble';

type LayerDef = {
  id: string;
  roman: string;
  years: string;
  weight: number;
  texture: Texture;
  note?: string;
};

/** Bottom (oldest) to top (most recent). */
const LAYERS: LayerDef[] = [
  { id: 'I',    roman: 'I',    years: '3000–2550 BCE', weight: 1.22, texture: 'fill' },
  { id: 'II',   roman: 'II',   years: '2600–2350 BCE', weight: 1.05, texture: 'gold',    note: 'the treasure' },
  { id: 'III',  roman: 'III',  years: '2350–2200 BCE', weight: 0.62, texture: 'rubble' },
  { id: 'IV',   roman: 'IV',   years: '2200–1900 BCE', weight: 0.74, texture: 'fill' },
  { id: 'V',    roman: 'V',    years: '1900–1700 BCE', weight: 0.62, texture: 'silt' },
  { id: 'VI',   roman: 'VI',   years: '1700–1300 BCE', weight: 1.30, texture: 'masonry' },
  { id: 'VIIa', roman: 'VIIa', years: '1300–1180 BCE', weight: 0.40, texture: 'burnt',   note: 'war-era candidate' },
  { id: 'VIIb', roman: 'VIIb', years: '1180–950 BCE',  weight: 0.42, texture: 'rubble' },
  { id: 'VIII', roman: 'VIII', years: '950–85 BCE',    weight: 0.82, texture: 'masonry' },
  { id: 'IX',   roman: 'IX',   years: '85 BCE–500 CE', weight: 0.88, texture: 'masonry' },
];

const TOTAL_WEIGHT = LAYERS.reduce((s, l) => s + l.weight, 0);

type Options = { highlight?: string | string[]; mode?: 'intact' | 'destroyed' };

export const StrataColumn: React.FC<SceneProps> = ({
  progress, frame, fps, seed, options,
}) => {
  const opts = (options ?? {}) as Options;
  const mode = opts.mode ?? 'intact';
  const highlight = useMemo(() => {
    const h = opts.highlight;
    if (!h) return new Set<string>();
    return new Set(Array.isArray(h) ? h : [h]);
  }, [opts.highlight]);

  const geo = useMemo(() => {
    const rand = rngFor(seed, 'strata');
    const fbm = makeFbm1D(seed, 'strataf');

    // Lay the bands out bottom-up.
    let cursor = COL_BOTTOM;
    const bands = LAYERS.map((def, i) => {
      const h = (def.weight / TOTAL_WEIGHT) * COL_H;
      const bottomY = cursor;
      const topY = cursor - h;
      cursor = topY;

      // The interface between two layers is never flat — it is an old ground
      // surface, dug into and trodden down.
      const interfacePts: { x: number; y: number }[] = [];
      for (let k = 0; k <= 40; k++) {
        const u = k / 40;
        interfacePts.push({
          x: COL_X - 30 + u * (COL_W + 60),
          y: topY + fbm(u * 5.5 + i * 17) * Math.min(9, h * 0.22),
        });
      }
      const interfaceLine = contour(seed, `iface${i}`, interfacePts, 1.3, 130);

      // Per-texture mark-making.
      let marks: ReturnType<typeof hatch> = [];
      let dots: ReturnType<typeof stipple> = [];
      let courses: { d: string; len: number }[] = [];

      const region = { x: COL_X, y: topY, w: COL_W, h: Math.max(4, h) };

      if (def.texture === 'masonry') {
        // Coursed stone: horizontal bedding joints with staggered verticals.
        const courseH = clamp(h / Math.max(2, Math.round(h / 26)), 14, 30);
        for (let cy = topY + courseH; cy < bottomY - 2; cy += courseH) {
          courses.push(
            contour(seed, `c${i}-${cy.toFixed(0)}`,
              segment({ x: COL_X + 6, y: cy }, { x: COL_X + COL_W - 6, y: cy + fbm(cy * 0.07) * 3 }, 14),
              1.0, 150)
          );
          const n = 5 + Math.floor(rand() * 4);
          for (let k = 0; k < n; k++) {
            const jx = COL_X + 40 + rand() * (COL_W - 80);
            courses.push(
              contour(seed, `v${i}-${cy.toFixed(0)}-${k}`,
                segment({ x: jx, y: cy }, { x: jx + fbm(jx * 0.02) * 2, y: Math.min(cy + courseH, bottomY - 2) }, 4),
                0.8, 40)
            );
          }
        }
        marks = hatch(seed, `mas${i}`, {
          ...region, angle: 24, pitch: 20, amp: 1.1, coverage: 0.5, jitter: 0.9,
          width: 0.85, samples: 6,
          density: (u) => clamp01(0.3 + fbm(u * 6 + i * 4) * 0.7),
        });
      } else if (def.texture === 'burnt') {
        // Destruction debris: short violent flicks and heavy stipple. This is
        // the layer that matters — the burnt city — so it has to look burnt.
        marks = flicks(seed, `burnt${i}`, {
          ...region, count: 320, length: 15,
          angleAt: (u, v) => -60 + fbm(u * 9 + v * 4) * 120,
          density: () => 0.9,
        });
        dots = stipple(seed, `burntd${i}`, { ...region, count: 420, minR: 0.6, maxR: 2.4 });
      } else if (def.texture === 'silt') {
        // Waterlaid silt: fine, close, unbroken horizontal rule.
        marks = hatch(seed, `silt${i}`, {
          ...region, angle: 0, pitch: 5.5, amp: 1.4, coverage: 0.9, jitter: 0.25,
          width: 0.8, samples: 10,
          density: (u) => clamp01(0.55 + fbm(u * 4 + i) * 0.5),
        });
      } else if (def.texture === 'rubble') {
        marks = hatch(seed, `rub${i}`, {
          ...region, angle: 52, pitch: 12, amp: 1.6, coverage: 0.42, jitter: 1.3,
          width: 1.05, samples: 5,
          density: (u, v) => clamp01(0.35 + fbm(u * 8 + v * 3 + i) * 0.85),
        });
        dots = stipple(seed, `rubd${i}`, { ...region, count: 260, minR: 0.6, maxR: 2.6 });
      } else if (def.texture === 'gold') {
        marks = hatch(seed, `gold${i}`, {
          ...region, angle: 16, pitch: 11, amp: 1.3, coverage: 0.68, jitter: 0.7,
          width: 1.0, samples: 8,
          density: (u, v) => clamp01(0.45 + fbm(u * 5 + i) * 0.7) * clamp01(1.1 - v * 0.5),
        });
        dots = stipple(seed, `goldd${i}`, { ...region, count: 200, minR: 0.7, maxR: 2.8 });
      } else {
        // Loose fill: mid-pitch diagonal with heavy break-up.
        marks = hatch(seed, `fill${i}`, {
          ...region, angle: 34, pitch: 14, amp: 1.5, coverage: 0.5, jitter: 1.1,
          width: 0.95, samples: 6,
          density: (u, v) => clamp01(0.4 + fbm(u * 7 + v * 2 + i * 3) * 0.8),
        });
        dots = stipple(seed, `filld${i}`, { ...region, count: 300, minR: 0.5, maxR: 2.0 });
      }

      return { def, topY, bottomY, h, interfaceLine, marks, dots, courses, index: i };
    });

    // The plate frame: the ruled box the section is drawn inside.
    const frameRect = wobblyRect(seed, 'frame', COL_X - 8, COL_TOP - 8, COL_W + 16, COL_H + 16, 1.3);

    // The scale bar running down the left of the section.
    const scaleTicks = bands.map((b) =>
      contour(seed, `tick${b.index}`,
        segment({ x: COL_X - 8, y: b.topY }, { x: COL_X - 62, y: b.topY - 2 }, 5), 0.9, 60)
    );

    // For 'destroyed' mode: the profile of Schliemann's cut, gouged down
    // through the upper layers.
    const gougePts: { x: number; y: number }[] = [];
    for (let k = 0; k <= 44; k++) {
      const u = k / 44;
      gougePts.push({
        x: COL_X + 190 + u * 460,
        y: COL_TOP + Math.sin(u * Math.PI) * 30 + fbm(u * 7 + 3) * 8,
      });
    }

    return { bands, frameRect, scaleTicks, gougePts };
  }, [seed]);

  const p = clamp01(progress);

  // The section is cut from the bottom up — the oldest layer first, which is
  // the order the ground was actually laid down in and the order the reveal
  // reads best in.
  const tFrame = ramp(p, 0.0, 0.12);
  const bandT = (i: number) => stagger(ramp(p, 0.06, 0.72), i, LAYERS.length, 0.052, 0.30);

  // The camera sinks through the section: down, HOLD, down again. This is the
  // hold-then-move rhythm the brief asks for — nothing eases continuously for
  // forty seconds.
  const sink =
    easeOutQuint(ramp(p, 0.08, 0.32)) * 0.42 +
    easeOutQuint(ramp(p, 0.50, 0.70)) * 0.34 +
    easeInOutCubic(ramp(p, 0.82, 1.0)) * 0.24;
  // Starts a touch high and settles low, but the travel is deliberately small:
  // the shot's whole claim is that there are NINE layers, so the stack has to
  // stay entirely in frame the whole time.
  const camY = lerp(26, -44, sink);
  const camScale = 1.0 + sink * 0.055;

  // Falling sediment in front of the section — secondary motion, and it sells
  // the section as a cut face rather than a chart.
  const t = frame / fps;

  const sweep = rakingLight(frame, fps, 27, seed);
  const litness = (u: number) => 1 + 0.6 * Math.exp(-Math.pow((u - lerp(-0.2, 1.2, sweep)) / 0.22, 2));

  const hasHighlight = highlight.size > 0;
  const destroyed = mode === 'destroyed';
  // In 'destroyed' mode the cut eats down through the upper bands over the
  // shot, in three bites with holds between rather than as a smooth wipe.
  const gouge = destroyed
    ? easeOutCubic(ramp(p, 0.30, 0.40)) * 0.38 +
      easeOutCubic(ramp(p, 0.52, 0.60)) * 0.34 +
      easeOutCubic(ramp(p, 0.72, 0.82)) * 0.28
    : 0;
  const gougeDepth = COL_TOP + gouge * COL_H * 0.62;

  const id = Math.round(seed * 1e6);

  return (
    <Plate seed={seed} frame={frame} fps={fps} tone="warm" lightPeriodSec={27} lightStrength={0.85}>
      <AbsoluteFill
        style={{
          transform: `translateY(${camY.toFixed(2)}px) scale(${camScale.toFixed(4)})`,
          transformOrigin: '58% 40%',
        }}
      >
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute' }}>
          <defs>
            {geo.bands.map((b) => (
              <clipPath key={b.index} id={`band-${id}-${b.index}`}>
                <rect x={COL_X} y={b.topY} width={COL_W} height={Math.max(1, b.h)} />
              </clipPath>
            ))}
            {destroyed ? (
              <clipPath id={`kept-${id}`}>
                {/* Everything except the gouge — the material Schliemann left. */}
                <path
                  d={`M ${COL_X - 40} ${COL_BOTTOM + 60} L ${COL_X - 40} ${COL_TOP - 40} L ${geo.gougePts[0].x} ${COL_TOP - 40} ` +
                     geo.gougePts.map((q) => `L ${q.x.toFixed(1)} ${(q.y + gougeDepth - COL_TOP).toFixed(1)}`).join(' ') +
                     ` L ${geo.gougePts[geo.gougePts.length - 1].x} ${COL_TOP - 40} L ${COL_X + COL_W + 40} ${COL_TOP - 40} L ${COL_X + COL_W + 40} ${COL_BOTTOM + 60} Z`}
                />
              </clipPath>
            ) : null}
          </defs>

          <g clipPath={destroyed ? `url(#kept-${id})` : undefined}>
            {geo.bands.map((b) => {
              const bt = bandT(b.index);
              if (bt <= 0.005) return null;
              const isHot = highlight.has(b.def.id);
              const dim = hasHighlight && !isHot ? 0.34 : 1;
              const col = b.def.texture === 'gold' || isHot ? PLATE.gold : PLATE.cut;
              // A highlighted layer breathes — a slow, quantised swell, so it
              // reads as lamplight moving on it rather than as a CSS pulse.
              const breathe = isHot
                ? 1 + 0.18 * Math.sin(onNs(frame, 4) * 0.055)
                : 1;
              return (
                <g key={b.index} clipPath={`url(#band-${id}-${b.index})`}>
                  <HatchField
                    strokes={b.marks}
                    t={bt}
                    color={col}
                    alpha={0.82 * dim * breathe}
                    passes={5}
                    modulate={(s) => litness(s.k)}
                  />
                  <StippleField dots={b.dots} t={bt} color={col} alpha={0.66 * dim * breathe} />
                  {b.courses.map((c, k) => (
                    <InkPath
                      key={k}
                      d={c.d}
                      len={c.len}
                      t={stagger(bt, k, b.courses.length, 0.008, 0.3)}
                      color={col}
                      width={0.9}
                      opacity={0.6 * dim}
                    />
                  ))}
                </g>
              );
            })}

            {/* Layer interfaces — drawn last and heaviest, because they are
                the actual evidence: each one is a city ending. */}
            {geo.bands.map((b) => (
              <InkPath
                key={b.index}
                d={b.interfaceLine.d}
                len={b.interfaceLine.len}
                t={bandT(b.index)}
                color={highlight.has(b.def.id) ? PLATE.goldBright : PLATE.cut}
                width={highlight.has(b.def.id) ? 2.4 : 1.5}
                opacity={hasHighlight && !highlight.has(b.def.id) ? 0.35 : 0.85}
              />
            ))}
          </g>

          {destroyed && gouge > 0.02 ? (
            <>
              {/* The cut edge itself, and the ghost of what was removed. */}
              <path
                d={`M ${geo.gougePts[0].x} ${COL_TOP - 40} ` +
                   geo.gougePts.map((q) => `L ${q.x.toFixed(1)} ${(q.y + gougeDepth - COL_TOP).toFixed(1)}`).join(' ') +
                   ` L ${geo.gougePts[geo.gougePts.length - 1].x} ${COL_TOP - 40}`}
                fill="none"
                stroke={PLATE.ember}
                strokeWidth={2.2}
                opacity={0.8}
              />
              <text
                x={COL_X + 420}
                y={COL_TOP - 26}
                textAnchor="middle"
                fill={PLATE.ember}
                opacity={0.75 * ramp(p, 0.44, 0.6)}
                style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 20, letterSpacing: 3 }}
              >
                REMOVED, LARGELY UNRECORDED
              </text>
            </>
          ) : null}

          {/* Frame. */}
          <InkPath d={geo.frameRect.d} len={geo.frameRect.len} t={tFrame} color={PLATE.cutDim} width={1.2} opacity={0.55} />

          {/* Margin: ticks and numerals, each trailing its band. */}
          {geo.bands.map((b) => {
            const bt = bandT(b.index);
            const lt = clamp01((bt - 0.45) / 0.5);
            if (lt <= 0.01) return null;
            const isHot = highlight.has(b.def.id);
            const col = isHot ? PLATE.goldBright : PLATE.cut;
            return (
              <g key={b.index} opacity={hasHighlight && !isHot ? 0.4 : 1}>
                <InkPath
                  d={geo.scaleTicks[b.index].d}
                  len={geo.scaleTicks[b.index].len}
                  t={clamp01(bt / 0.6)}
                  color={col}
                  width={0.9}
                  opacity={0.5}
                />
                <g opacity={lt} transform={`translate(${((1 - lt) * -10).toFixed(2)}, 0)`}>
                  <text
                    x={LABEL_RIGHT} y={b.topY + Math.min(30, b.h * 0.62)}
                    textAnchor="end" fill={col}
                    style={{ fontFamily: "'Cinzel', serif", fontWeight: 600, fontSize: isHot ? 38 : 31, letterSpacing: 2 }}
                  >
                    {b.def.roman}
                  </text>
                  <text
                    x={LABEL_RIGHT} y={b.topY + Math.min(30, b.h * 0.62) + 22}
                    textAnchor="end" fill={PLATE.cutDim}
                    style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 16, letterSpacing: 1.1 }}
                  >
                    {b.def.years}
                  </text>
                  {b.def.note && isHot ? (
                    <text
                      x={LABEL_RIGHT} y={b.topY + Math.min(30, b.h * 0.62) + 44}
                      textAnchor="end" fill={PLATE.gold}
                      style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 16, letterSpacing: 1.4 }}
                    >
                      {b.def.note}
                    </text>
                  ) : null}
                </g>
              </g>
            );
          })}

          {/* Sediment sifting down the face of the section. */}
          {Array.from({ length: 46 }, (_, i) => {
            const k = i / 46;
            const speed = 0.05 + (k % 0.27) * 0.16;
            const u = ((t * speed) + k * 5.31) % 1;
            const fade = Math.sin(u * Math.PI);
            const o = fade * 0.5 * ramp(p, 0.2, 0.4);
            if (o <= 0.02) return null;
            const x = COL_X + 20 + ((k * 7919) % 1) * (COL_W - 40);
            const y = COL_TOP + u * COL_H;
            return <circle key={i} cx={x} cy={y} r={0.9 + (k % 0.3) * 3} fill={PLATE.cut} opacity={o} />;
          })}
        </svg>
      </AbsoluteFill>

      {/* Header, set outside the moving plate so it stays anchored. */}
      <div
        style={{
          position: 'absolute', left: 92, top: 116, width: 396,
          opacity: ramp(p, 0.02, 0.2), pointerEvents: 'none',
        }}
      >
        <div style={{ width: 200, height: 1, background: `linear-gradient(90deg, ${PLATE.gold}, transparent)`, opacity: 0.7, marginBottom: 12 }} />
        <div style={{ fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: 34, letterSpacing: 4, color: PLATE.gold, lineHeight: 1.2 }}>
          NINE CITIES
        </div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 18, letterSpacing: 1.6, color: PLATE.cutDim, marginTop: 10, lineHeight: 1.45 }}>
          {destroyed
            ? 'Material lost to the cut of 1871–73'
            : 'Section through Hisarlık'}
        </div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 15, letterSpacing: 1.2, color: PLATE.cutFaint, marginTop: 26, lineHeight: 1.6 }}>
          SURFACE ↑<br />BEDROCK ↓
        </div>
      </div>
    </Plate>
  );
};
