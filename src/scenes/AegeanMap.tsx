import React, { useId, useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import type { SceneProps } from './types';
import {
  Plate, PLATE, HatchField, StippleField, InkPath, PlateCaption, Marginalia,
  hatch, hatchContours, stipple, contour, wobblyEllipse, segment, wobble,
  rngFor, makeFbm1D, lerp, clamp01,
  cycle, onNs, rakingLight, ramp, stagger, settle, pulse, easeOutCubic, easeInOutCubic,
} from './engraving';

/**
 * AegeanMap — the north-west corner of Asia Minor: the Dardanelles, the
 * Aegean, and the mound at Hisarlık four miles inland.
 *
 * Built as an engraved survey chart of the kind bound into a 19th-century
 * excavation report: coastline cut as a swelling contour line, the sea
 * modelled entirely in horizontal water-hatching that thins with distance
 * from the shore, the land in stipple and contour hatching, and the whole
 * thing under a graticule that draws itself in.
 *
 * The strait is the argument the narration is making — the Dardanelles is the
 * gate between the Aegean and the Black Sea, and a city sitting on it
 * controls the traffic — so the strait gets the light, and a slow procession
 * of ships works up it while the plate is on screen.
 *
 * options:
 *   focus: 'region' | 'site'   — the whole strait, or in close on the mound.
 *   showLabels?: boolean
 */

const W = 1920;
const H = 1080;

type Options = { focus?: 'region' | 'site'; showLabels?: boolean };

/**
 * Coastlines, hand-plotted as control points and then wobbled. Coordinates
 * are in the plate's own space; the two focus modes are different framings of
 * the same drawing, which is why the site view can zoom into the region view
 * without the geography changing under it.
 */
const EUROPE_SHORE = [
  { x: -120, y: 92 }, { x: 150, y: 132 }, { x: 360, y: 196 }, { x: 545, y: 268 },
  { x: 700, y: 352 }, { x: 830, y: 432 }, { x: 946, y: 500 }, { x: 1064, y: 546 },
  { x: 1190, y: 566 }, { x: 1330, y: 560 }, { x: 1470, y: 532 }, { x: 1640, y: 486 },
  { x: 1810, y: 428 }, { x: 2040, y: 344 },
];
const ASIA_SHORE = [
  { x: -120, y: 330 }, { x: 170, y: 372 }, { x: 400, y: 424 }, { x: 592, y: 494 },
  { x: 742, y: 580 }, { x: 880, y: 660 }, { x: 1010, y: 712 }, { x: 1150, y: 742 },
  { x: 1300, y: 748 }, { x: 1460, y: 736 }, { x: 1640, y: 706 }, { x: 1830, y: 664 },
  { x: 2040, y: 610 },
];
/** The mound: four miles inland from the Asian shore, south of the mouth. */
const SITE = { x: 812, y: 690 };
/** Where the strait narrows — the choke point that makes the place matter. */
const NARROWS = { x: 1230, y: 654 };

export const AegeanMap: React.FC<SceneProps> = ({
  progress, frame, fps, seed, options,
}) => {
  const opts = (options ?? {}) as Options;
  const focus = opts.focus ?? 'region';
  const showLabels = opts.showLabels ?? true;

  const geo = useMemo(() => {
    const rand = rngFor(seed, 'map');
    const fbm = makeFbm1D(seed, 'mapf');

    const dense = (pts: { x: number; y: number }[], n = 6) => {
      const out: { x: number; y: number }[] = [];
      for (let i = 0; i < pts.length - 1; i++) {
        for (let k = 0; k < n; k++) out.push({
          x: lerp(pts[i].x, pts[i + 1].x, k / n),
          y: lerp(pts[i].y, pts[i + 1].y, k / n),
        });
      }
      out.push(pts[pts.length - 1]);
      // Give the coastline the crenellation a real shore has.
      return out.map((p, i) => ({
        x: p.x + fbm(i * 0.31) * 9,
        y: p.y + fbm(i * 0.29 + 40) * 9,
      }));
    };

    const eu = dense(EUROPE_SHORE);
    const as = dense(ASIA_SHORE);
    const euLine = contour(seed, 'eu', eu, 1.5, 120);
    const asLine = contour(seed, 'as', as, 1.5, 120);

    // Sea: the closed channel between the two shores.
    const seaFill =
      `M ${eu.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ')} ` +
      `L ${as.slice().reverse().map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ')} Z`;

    // Water hatching: horizontal rules, closely spaced against the shore and
    // opening out toward the middle of the channel — the standard engraved
    // convention for water, and it makes the coast read without outlining it
    // twice.
    const shoreDist = (px: number, py: number) => {
      let best = 1e9;
      for (const arr of [eu, as]) {
        for (const q of arr) {
          const d = Math.hypot(q.x - px, q.y - py);
          if (d < best) best = d;
        }
      }
      return best;
    };
    const water = hatch(seed, 'water', {
      x: -140, y: 60, w: W + 280, h: 760,
      angle: 0, pitch: 9.5, amp: 2.1, coverage: 0.9, jitter: 0.45,
      width: 0.95, samples: 14,
      density: (u, v) => {
        const px = -140 + u * (W + 280);
        const py = 60 + v * 760;
        const d = shoreDist(px, py);
        // Tight and bright against the shore, opening out into the channel
        // but never dying completely — open water still carries a faint rule.
        return clamp01(1.25 - d / 250) * 0.82 + 0.18;
      },
    });

    // Land tone on both sides — contour hatching running away from the coast,
    // so the land reads as rising ground rather than as empty paper.
    const euLand = hatchContours(seed, 'euLand', eu, {
      lines: 13, spacing: 15, spacingGrowth: 1.10, direction: -90,
      dashLength: 30, dashGap: 26, amp: 1.2, width: 1.0, drift: 10,
      density: (u, v) => clamp01(1.1 - v * 1.5) * clamp01(0.45 + fbm(u * 7 + 11) * 0.8),
    });
    const asLand = hatchContours(seed, 'asLand', as, {
      lines: 15, spacing: 15, spacingGrowth: 1.10, direction: 90,
      dashLength: 30, dashGap: 26, amp: 1.2, width: 1.0, drift: 10,
      density: (u, v) => clamp01(1.1 - v * 1.45) * clamp01(0.45 + fbm(u * 7 + 71) * 0.8),
    });

    const landGrain = stipple(seed, 'land', {
      x: 0, y: 520, w: W, h: 560, count: 900, minR: 0.5, maxR: 1.7,
      density: (u, v) => clamp01(v * 1.2) * clamp01(0.4 + fbm(u * 9 + 5) * 0.9),
    });

    // The graticule — meridians and parallels, ruled and slightly off-true.
    const grid: { d: string; len: number }[] = [];
    for (let i = 0; i <= 8; i++) {
      const x = 60 + (i * (W - 120)) / 8;
      grid.push(contour(seed, `gx${i}`, segment({ x, y: 40 }, { x: x + 6, y: H - 40 }, 10), 1.2, 260));
    }
    for (let j = 0; j <= 4; j++) {
      const y = 70 + (j * (H - 180)) / 4;
      grid.push(contour(seed, `gy${j}`, segment({ x: 40, y }, { x: W - 40, y: y + 5 }, 12), 1.2, 300));
    }

    // The compass rose, north-east corner — an engraved plate almost always
    // has one, and it gives the composition a second point of interest.
    const roseC = { x: 1690, y: 210 };
    const rose = wobblyEllipse(seed, 'rose', roseC.x, roseC.y, 74, 74, 1.0, 44);
    const roseInner = wobblyEllipse(seed, 'rose2', roseC.x, roseC.y, 52, 52, 0.8, 36);

    // Ships working the strait: a slow procession, each a hull and two sails.
    const ships = Array.from({ length: 9 }, (_, i) => ({
      k: i / 9,
      offset: rand(),
      lane: 0.3 + rand() * 0.45,
      scale: 0.7 + rand() * 0.7,
      speed: 0.010 + rand() * 0.014,
      dir: rand() < 0.5 ? 1 : -1,
    }));

    return {
      eu, as, euLine, asLine, seaFill, water, euLand, asLand, landGrain,
      grid, rose, roseInner, roseC, ships,
    };
  }, [seed]);

  const p = clamp01(progress);

  // Build order: the graticule is ruled first (the surveyor's frame), then
  // the coast is plotted, then the water is laid in, then the land, then the
  // labels. Each stage overlaps the next.
  const tGrid = ramp(p, 0.00, 0.16);
  const tCoast = ramp(p, 0.08, 0.42);
  const tWater = ramp(p, 0.20, 0.66);
  const tLand = ramp(p, 0.30, 0.72);
  const tRose = ramp(p, 0.40, 0.60);
  const tLabels = ramp(p, 0.46, 0.80);

  // Camera. In 'site' mode the plate is examined closely — the drawing is the
  // same, we just move in on the mound. The move is NOT a constant creep: it
  // pushes in, holds, then drifts, which is the whole point of the brief.
  const isSite = focus === 'site';
  const pushIn = isSite ? easeOutCubic(ramp(p, 0.0, 0.34)) : 0;
  const holdDrift = easeInOutCubic(ramp(p, 0.52, 1.0));
  const scale = isSite
    ? lerp(1.0, 2.05, pushIn) + holdDrift * 0.10
    : 1.03 + easeInOutCubic(ramp(p, 0.1, 1.0)) * 0.07;
  const focusPt = isSite ? SITE : { x: W / 2 + 40, y: 470 };
  const camX = (W / 2 - focusPt.x) * (scale - 1) / scale - holdDrift * (isSite ? 40 : 22);
  const camY = (H / 2 - focusPt.y) * (scale - 1) / scale + holdDrift * (isSite ? 14 : -10);

  const sweep = rakingLight(frame, fps, 30, seed);
  const litness = (u: number) => 1 + 0.5 * Math.exp(-Math.pow((u - lerp(-0.2, 1.2, sweep)) / 0.24, 2));

  const t = frame / fps;

  // The site marker only appears once the coast is plotted, and it arrives
  // with a snap and a settle rather than a fade.
  const tMark = ramp(p, 0.5, 0.62);
  const markScale = settle(tMark, 0.22);
  const markPulse = pulse(p, 0.56, 0.05);

  const id = useId().replace(/:/g, '');

  return (
    <Plate seed={seed} frame={frame} fps={fps} tone="cold" lightPeriodSec={30} lightStrength={0.8}>
      <AbsoluteFill
        style={{
          transform: `scale(${scale.toFixed(4)}) translate(${camX.toFixed(2)}px, ${camY.toFixed(2)}px)`,
          transformOrigin: '50% 50%',
        }}
      >
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute' }}>
          <defs>
            <clipPath id={`sea-${id}`}>
              <path d={geo.seaFill} />
            </clipPath>
          </defs>

          {/* Graticule — ruled first, faint. */}
          {geo.grid.map((g, i) => (
            <InkPath
              key={i}
              d={g.d}
              len={g.len}
              t={stagger(tGrid, i, geo.grid.length, 0.045, 0.4)}
              color={PLATE.cutFaint}
              width={0.8}
              opacity={0.5}
            />
          ))}

          {/* The sea, hatched only inside the channel. */}
          <g clipPath={`url(#sea-${id})`}>
            <HatchField
              strokes={geo.water}
              t={tWater}
              color={PLATE.cut}
              alpha={0.62}
              passes={6}
              modulate={(s) => litness(s.k)}
            />
          </g>

          {/* Land tone. */}
          <HatchField strokes={geo.euLand} t={tLand} color={PLATE.cut} alpha={0.66} passes={5} modulate={(s) => litness(s.k)} />
          <HatchField strokes={geo.asLand} t={tLand} color={PLATE.cut} alpha={0.66} passes={5} modulate={(s) => litness(s.k)} />
          <StippleField dots={geo.landGrain} t={tLand} color={PLATE.cut} alpha={0.5} />

          {/* The coastlines, cut last and heaviest — the authoritative line. */}
          <InkPath d={geo.euLine.d} len={geo.euLine.len} t={tCoast} color={PLATE.cut} width={2.1} opacity={0.9} />
          <InkPath d={geo.asLine.d} len={geo.asLine.len} t={ramp(p, 0.13, 0.47)} color={PLATE.cut} width={2.1} opacity={0.9} />

          {/* Ships working the strait — held poses, drifting along their lane. */}
          {geo.ships.map((s, i) => {
            const appear = stagger(tWater, i, geo.ships.length, 0.05, 0.4);
            if (appear <= 0.02) return null;
            const u = ((t * s.speed + s.offset) % 1);
            const x = lerp(-140, W + 140, s.dir > 0 ? u : 1 - u);
            // Sit the ship between the two shores at its lane fraction.
            const idx = clamp01((x + 140) / (W + 280));
            const iE = Math.min(geo.eu.length - 1, Math.round(idx * (geo.eu.length - 1)));
            const iA = Math.min(geo.as.length - 1, Math.round(idx * (geo.as.length - 1)));
            const y = lerp(geo.eu[iE].y, geo.as[iA].y, s.lane);
            const fade = Math.sin(u * Math.PI);
            // The hull bobs on a held two-frame cycle, not a smooth sine.
            const bob = cycle(frame + i * 9, 8, 2) * 1.2;
            const sc = s.scale;
            return (
              <g
                key={i}
                transform={`translate(${x.toFixed(1)}, ${(y + bob).toFixed(1)}) scale(${(s.dir * sc).toFixed(2)}, ${sc.toFixed(2)})`}
                opacity={0.7 * fade * appear}
              >
                <path d="M-11,0 L11,0 L8,5 L-8,5 Z" fill="none" stroke={PLATE.cut} strokeWidth={1.3 / sc} />
                <path d="M0,0 L0,-15 M0,-14 L9,-3 M0,-13 L-8,-3" fill="none" stroke={PLATE.cut} strokeWidth={1.1 / sc} />
              </g>
            );
          })}

          {/* Compass rose. */}
          <g opacity={tRose}>
            <InkPath d={geo.rose.d} len={geo.rose.len} t={tRose} color={PLATE.gold} width={1.3} opacity={0.7} />
            <InkPath d={geo.roseInner.d} len={geo.roseInner.len} t={ramp(p, 0.44, 0.64)} color={PLATE.gold} width={0.9} opacity={0.45} />
            <g
              transform={`translate(${geo.roseC.x}, ${geo.roseC.y}) rotate(${(rakingLight(frame, fps, 96, seed) * 3 - 1.5).toFixed(3)})`}
              opacity={0.85}
            >
              <path d="M0,-70 L11,-12 L0,0 L-11,-12 Z" fill={PLATE.gold} opacity={0.75} />
              <path d="M0,70 L9,12 L0,0 L-9,12 Z" fill="none" stroke={PLATE.gold} strokeWidth={1.1} opacity={0.6} />
              <path d="M-70,0 L-12,-9 L0,0 L-12,9 Z M70,0 L12,-9 L0,0 L12,9 Z" fill="none" stroke={PLATE.gold} strokeWidth={1.1} opacity={0.55} />
              <text x={0} y={-84} textAnchor="middle" fill={PLATE.gold} opacity={0.8}
                style={{ fontFamily: "'Cinzel', serif", fontSize: 22, letterSpacing: 2 }}>N</text>
            </g>
          </g>

          {/* The site. Cut as a target with a bright bite when it lands. */}
          {tMark > 0.01 ? (
            <g transform={`translate(${SITE.x}, ${SITE.y})`}>
              <circle r={13 * markScale} fill="none" stroke={PLATE.goldBright} strokeWidth={2.2} opacity={0.95} />
              <circle r={4.5 * markScale} fill={PLATE.goldBright} opacity={0.95} />
              <circle r={26 + markPulse * 44} fill="none" stroke={PLATE.goldBright} strokeWidth={1.6} opacity={markPulse * 0.8} />
              <path
                d="M-30,0 L-17,0 M17,0 L30,0 M0,-30 L0,-17 M0,17 L0,30"
                stroke={PLATE.goldBright}
                strokeWidth={1.6}
                opacity={0.7 * markScale}
              />
            </g>
          ) : null}

          {showLabels ? (
            <>
              <Marginalia
                fromX={SITE.x} fromY={SITE.y - 18}
                toX={SITE.x - 34} toY={SITE.y - 74}
                label="HISARLIK" note="4 miles from the coast"
                t={tLabels} color={PLATE.goldBright} anchor="end" fontSize={23}
              />
              <Marginalia
                fromX={NARROWS.x} fromY={NARROWS.y - 96}
                toX={NARROWS.x + 132} toY={NARROWS.y - 176}
                label="THE DARDANELLES" note="Aegean → Sea of Marmara → Black Sea"
                t={ramp(p, 0.54, 0.86)} color={PLATE.cut} anchor="start" fontSize={22}
              />
              <text
                x={300} y={214}
                fill={PLATE.cutDim}
                opacity={ramp(p, 0.6, 0.8) * 0.75}
                style={{ fontFamily: "'Cinzel', serif", fontSize: 27, letterSpacing: 7 }}
              >
                THRACE
              </text>
              <text
                x={190} y={806}
                fill={PLATE.cutDim}
                opacity={ramp(p, 0.64, 0.86) * 0.75}
                style={{ fontFamily: "'Cinzel', serif", fontSize: 27, letterSpacing: 7 }}
              >
                ANATOLIA
              </text>
            </>
          ) : null}
        </svg>
      </AbsoluteFill>

      <PlateCaption
        x={96}
        y={80}
        title={isSite ? 'The site at Hisarlık' : 'The Dardanelles'}
        sub={isSite ? 'Plate II · the mound and its approaches' : 'Plate I · the strait and the plain of Troy'}
        t={ramp(p, 0.06, 0.3)}
      />
    </Plate>
  );
};
