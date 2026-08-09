import React, { useId, useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import type { SceneProps } from './types';
import {
  Plate, PLATE, HatchField, StippleField, InkPath, PlateCaption,
  hatch, hatchContours, stipple, flicks, contour, segment, wobblyRect,
  rngFor, makeFbm1D, lerp, clamp01, clamp,
  cycle, onNs, rakingLight, ramp, stagger, pulse, anticipate,
  easeOutCubic, easeInOutCubic, easeOutQuint,
} from './engraving';

/**
 * GreatTrench — the cut of 1871–73, driven straight down through the middle of
 * the mound and through everything in it.
 *
 * The whole shot is one action: the trench eats downward. Crucially it does
 * NOT ease smoothly from top to bottom — it goes in BITES, four of them, each
 * one dropping fast and then holding dead still while debris settles. That
 * held beat between bites is the difference between an animation that reads as
 * a machine wipe and one that reads as men with picks.
 *
 * Anticipation: before each bite the whole plate pulls up a couple of pixels.
 * Overlapping action: the spoil thrown out of the cut lags the cut itself by
 * several frames, and the depth marker in the margin trails both.
 */

const W = 1920;
const H = 1080;

const GROUND = 250;
const FLOOR = 830;
const TRENCH_X = 700;
const TRENCH_W = 470;

/** The layers the cut goes through, top (recent) to bottom (oldest). */
const BANDS = [
  { id: 'IX',   frac: 0.10, texture: 'masonry' as const },
  { id: 'VIII', frac: 0.10, texture: 'masonry' as const },
  { id: 'VIIb', frac: 0.06, texture: 'rubble' as const },
  { id: 'VIIa', frac: 0.05, texture: 'burnt' as const },
  { id: 'VI',   frac: 0.17, texture: 'masonry' as const },
  { id: 'V',    frac: 0.08, texture: 'silt' as const },
  { id: 'IV',   frac: 0.10, texture: 'fill' as const },
  { id: 'III',  frac: 0.08, texture: 'rubble' as const },
  { id: 'II',   frac: 0.14, texture: 'gold' as const },
  { id: 'I',    frac: 0.12, texture: 'fill' as const },
];

export const GreatTrench: React.FC<SceneProps> = ({ progress, frame, fps, seed }) => {
  const geo = useMemo(() => {
    const rand = rngFor(seed, 'trench');
    const fbm = makeFbm1D(seed, 'trenchf');

    const total = FLOOR - GROUND;
    let cursor = GROUND;
    const bands = BANDS.map((b, i) => {
      const h = b.frac * total;
      const topY = cursor;
      cursor += h;

      const region = { x: -60, y: topY, w: W + 120, h: Math.max(4, h) };
      let marks: ReturnType<typeof hatch> = [];
      let dots: ReturnType<typeof stipple> = [];

      if (b.texture === 'masonry') {
        marks = hatch(seed, `t-mas${i}`, {
          ...region, angle: 0, pitch: Math.max(9, h / 3), amp: 1.2, coverage: 0.86,
          jitter: 0.4, width: 1.1, samples: 12,
          density: (u) => clamp01(0.45 + fbm(u * 5 + i * 3) * 0.7),
        });
      } else if (b.texture === 'burnt') {
        marks = flicks(seed, `t-burnt${i}`, {
          ...region, count: 300, length: 15,
          angleAt: (u, v) => -55 + fbm(u * 8 + v * 3) * 110,
        });
        dots = stipple(seed, `t-burntd${i}`, { ...region, count: 340, minR: 0.6, maxR: 2.5 });
      } else if (b.texture === 'silt') {
        marks = hatch(seed, `t-silt${i}`, {
          ...region, angle: 0, pitch: 5, amp: 1.3, coverage: 0.94, jitter: 0.2,
          width: 0.8, samples: 12, density: () => 0.85,
        });
      } else if (b.texture === 'gold') {
        marks = hatch(seed, `t-gold${i}`, {
          ...region, angle: 14, pitch: 10, amp: 1.2, coverage: 0.7, jitter: 0.6,
          width: 1.0, samples: 8, density: (u) => clamp01(0.5 + fbm(u * 6 + i) * 0.7),
        });
        dots = stipple(seed, `t-goldd${i}`, { ...region, count: 200, minR: 0.7, maxR: 2.9 });
      } else if (b.texture === 'rubble') {
        marks = hatch(seed, `t-rub${i}`, {
          ...region, angle: 48, pitch: 11, amp: 1.7, coverage: 0.44, jitter: 1.3,
          width: 1.05, samples: 5, density: (u, v) => clamp01(0.4 + fbm(u * 7 + v * 2 + i) * 0.8),
        });
        dots = stipple(seed, `t-rubd${i}`, { ...region, count: 240, minR: 0.6, maxR: 2.4 });
      } else {
        marks = hatch(seed, `t-fill${i}`, {
          ...region, angle: 32, pitch: 13, amp: 1.5, coverage: 0.52, jitter: 1.1,
          width: 0.95, samples: 6, density: (u, v) => clamp01(0.42 + fbm(u * 6 + v + i * 2) * 0.8),
        });
        dots = stipple(seed, `t-filld${i}`, { ...region, count: 260, minR: 0.5, maxR: 2.2 });
      }

      const ifacePts: { x: number; y: number }[] = [];
      for (let k = 0; k <= 44; k++) {
        const u = k / 44;
        ifacePts.push({ x: -60 + u * (W + 120), y: topY + fbm(u * 5 + i * 13) * 7 });
      }

      return {
        ...b, topY, h, marks, dots,
        iface: contour(seed, `t-if${i}`, ifacePts, 1.3, 140),
      };
    });

    // The ground surface — the mound's crown, gently domed.
    const surfacePts: { x: number; y: number }[] = [];
    for (let k = 0; k <= 60; k++) {
      const u = k / 60;
      surfacePts.push({
        x: -60 + u * (W + 120),
        y: GROUND - Math.exp(-Math.pow((u - 0.5) / 0.44, 2)) * 66 + fbm(u * 6 + 3) * 10,
      });
    }
    const surface = contour(seed, 'surf', surfacePts, 1.6, 180);
    const surfaceTopAt = (px: number) => {
      const u = clamp01((px + 60) / (W + 120));
      return surfacePts[clamp(Math.round(u * 60), 0, 60)].y;
    };

    // Sky above the mound.
    const sky = hatch(seed, 'tsky', {
      x: -60, y: 20, w: W + 120, h: 190,
      angle: 0, pitch: 14, amp: 2.2, coverage: 0.62, jitter: 0.9, width: 0.85, samples: 9,
      density: (u, v) => clamp01(Math.pow(v, 2.2) * 1.2 - 0.05),
    });

    // Spoil thrown out of the cut: each clod has its own arc and spin.
    const spoil = Array.from({ length: 54 }, (_, i) => ({
      k: i / 54,
      side: rand() < 0.5 ? -1 : 1,
      born: rand(),
      vx: 130 + rand() * 340,
      vy: -(180 + rand() * 260),
      size: 3 + rand() * 9,
      spin: (rand() - 0.5) * 700,
      life: 0.9 + rand() * 0.7,
    }));

    return { bands, surface, surfaceTopAt, sky, spoil };
  }, [seed]);

  const p = clamp01(progress);

  // --- the bites ----------------------------------------------------------
  // Four discrete digging campaigns. Each drops fast (easeOutQuint over a
  // short window) then holds. The sum reaches 1 at p ≈ 0.86, leaving a beat at
  // the bottom of the cut before the shot ends.
  const BITES = [
    { at: 0.16, dur: 0.075, amount: 0.30 },
    { at: 0.36, dur: 0.070, amount: 0.26 },
    { at: 0.56, dur: 0.065, amount: 0.24 },
    { at: 0.76, dur: 0.075, amount: 0.20 },
  ];
  let cut = 0;
  let biteVel = 0;
  for (const b of BITES) {
    cut += easeOutQuint(ramp(p, b.at, b.at + b.dur)) * b.amount;
    // How hard this bite is moving right now — drives the dust and the shake.
    const inBite = ramp(p, b.at, b.at + b.dur);
    if (inBite > 0 && inBite < 1) biteVel = Math.max(biteVel, Math.sin(inBite * Math.PI));
  }
  cut = clamp01(cut);

  // Anticipation: the plate lifts a little just before each bite lands.
  let antic = 0;
  for (const b of BITES) {
    const pre = ramp(p, b.at - 0.05, b.at);
    antic += pre * (1 - ramp(p, b.at, b.at + 0.02)) * 3.2;
  }

  const cutDepth = GROUND + cut * (FLOOR - GROUND);

  // Camera: pushes in on the cut, and drops with it — but in its own rhythm,
  // slightly behind the digging, which is the overlapping action.
  const follow = easeInOutCubic(ramp(p, 0.12, 0.94));
  const camScale = 1.0 + follow * 0.16;
  const camY = -follow * 60 - antic;
  const camX = lerp(30, -18, easeInOutCubic(ramp(p, 0.0, 1.0)));

  const t = frame / fps;
  const sweep = rakingLight(frame, fps, 25, seed);
  const litness = (u: number) => 1 + 0.5 * Math.exp(-Math.pow((u - lerp(-0.2, 1.2, sweep)) / 0.24, 2));

  const tGround = ramp(p, 0.0, 0.14);
  const tBands = ramp(p, 0.04, 0.4);

  const id = useId().replace(/:/g, '');

  // Wobble on the trench walls, so the cut is hacked rather than milled.
  const wallJitter = (y: number) => Math.sin(y * 0.031 + seed * 31) * 7 + Math.sin(y * 0.083 + 2) * 3;

  const leftWall =
    `M ${TRENCH_X} ${GROUND - 90} ` +
    Array.from({ length: 26 }, (_, i) => {
      const y = GROUND - 90 + ((cutDepth + 30 - (GROUND - 90)) * i) / 25;
      return `L ${(TRENCH_X + wallJitter(y)).toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  const rightWall =
    `M ${TRENCH_X + TRENCH_W} ${GROUND - 90} ` +
    Array.from({ length: 26 }, (_, i) => {
      const y = GROUND - 90 + ((cutDepth + 30 - (GROUND - 90)) * i) / 25;
      return `L ${(TRENCH_X + TRENCH_W - wallJitter(y + 40)).toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');

  // The closed void the cut has opened: down the left wall, across the floor,
  // back up the right wall.
  const voidPath =
    leftWall +
    ` L ${(TRENCH_X + TRENCH_W - wallJitter(cutDepth + 40)).toFixed(1)} ${(cutDepth + 30).toFixed(1)} ` +
    Array.from({ length: 26 }, (_, i) => {
      const y = cutDepth + 30 - ((cutDepth + 30 - (GROUND - 90)) * i) / 25;
      return `L ${(TRENCH_X + TRENCH_W - wallJitter(y + 40)).toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ') +
    ' Z';

  return (
    <Plate seed={seed} frame={frame} fps={fps} tone="warm" lightPeriodSec={25} lightStrength={0.9}>
      <AbsoluteFill
        style={{
          transform: `translate(${camX.toFixed(2)}px, ${camY.toFixed(2)}px) scale(${camScale.toFixed(4)})`,
          transformOrigin: '50% 46%',
        }}
      >
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute' }}>
          <defs>
            {/* The section, minus whatever the cut has removed so far. */}
            <clipPath id={`ground-${id}`}>
              <path
                d={`M -80 ${H + 60} L -80 ${GROUND - 130} L ${W + 80} ${GROUND - 130} L ${W + 80} ${H + 60} Z`}
              />
            </clipPath>
            <mask id={`cutmask-${id}`}>
              <rect x={-80} y={-80} width={W + 160} height={H + 160} fill="#fff" />
              {/* The void the trench has opened. */}
              <path d={voidPath} fill="#000" />
            </mask>
          </defs>

          {/* Sky. */}
          <HatchField strokes={geo.sky} t={tGround} color={PLATE.cut} alpha={0.34} passes={5} modulate={(s) => litness(s.k)} />

          {/* The section itself, with the trench masked out of it. */}
          <g mask={`url(#cutmask-${id})`} clipPath={`url(#ground-${id})`}>
            {geo.bands.map((b, i) => {
              const bt = stagger(tBands, i, geo.bands.length, 0.03, 0.3);
              if (bt <= 0.005) return null;
              const col = b.texture === 'gold' ? PLATE.gold : b.texture === 'burnt' ? PLATE.ember : PLATE.cut;
              return (
                <g key={i}>
                  <HatchField strokes={b.marks} t={bt} color={col} alpha={0.62} passes={5} modulate={(s) => litness(s.k)} />
                  <StippleField dots={b.dots} t={bt} color={col} alpha={0.5} />
                  <InkPath d={b.iface.d} len={b.iface.len} t={bt} color={PLATE.cut} width={1.4} opacity={0.7} />
                </g>
              );
            })}
          </g>

          {/* The surface line, broken by the cut. */}
          <g mask={`url(#cutmask-${id})`}>
            <InkPath d={geo.surface.d} len={geo.surface.len} t={tGround} color={PLATE.cut} width={2.2} opacity={0.9} />
          </g>

          {/* The cut walls — hacked, lit on one side. */}
          {cut > 0.005 ? (
            <>
              <path d={leftWall} fill="none" stroke={PLATE.cut} strokeWidth={2.4} opacity={0.9} />
              <path d={rightWall} fill="none" stroke={PLATE.cutDim} strokeWidth={2.0} opacity={0.7} />
              {/* The floor of the cut, where the picks are working now. */}
              <path
                d={`M ${TRENCH_X + wallJitter(cutDepth)} ${cutDepth} L ${TRENCH_X + TRENCH_W - wallJitter(cutDepth + 40)} ${cutDepth + 6}`}
                fill="none"
                stroke={PLATE.goldBright}
                strokeWidth={2.6}
                opacity={0.55 + 0.45 * biteVel}
              />
            </>
          ) : null}

          {/* Spoil thrown clear of the cut. Each clod is launched by whichever
              bite is live, arcs, spins, and falls — overlapping the dig by
              design, so debris is still landing after the picks have stopped. */}
          {geo.spoil.map((s, i) => {
            // Which bite threw this clod.
            const bite = BITES[i % BITES.length];
            const age = (p - (bite.at + s.born * 0.06)) / (s.life * 0.16);
            if (age < 0 || age > 1) return null;
            const tt = age * s.life;
            const x = TRENCH_X + TRENCH_W / 2 + s.side * (40 + s.vx * tt);
            const y = cutDepth - 40 + s.vy * tt + 900 * tt * tt;
            if (y > FLOOR + 120) return null;
            const o = Math.sin(age * Math.PI) * 0.85;
            return (
              <g key={i} transform={`translate(${x.toFixed(1)}, ${y.toFixed(1)}) rotate(${(s.spin * tt).toFixed(1)})`} opacity={o}>
                <path
                  d={`M ${-s.size} 0 L ${-s.size * 0.3} ${-s.size * 0.8} L ${s.size} ${-s.size * 0.2} L ${s.size * 0.4} ${s.size * 0.7} Z`}
                  fill="none"
                  stroke={PLATE.cut}
                  strokeWidth={1.2}
                />
              </g>
            );
          })}

          {/* Dust boiling out of the cut while a bite is live. */}
          {biteVel > 0.02
            ? Array.from({ length: 40 }, (_, i) => {
                const k = i / 40;
                const u = ((t * 0.35 + k * 3.1) % 1);
                const o = Math.sin(u * Math.PI) * biteVel * 0.5;
                if (o <= 0.02) return null;
                return (
                  <circle
                    key={i}
                    cx={TRENCH_X + 30 + ((k * 7919) % 1) * (TRENCH_W - 60) + (u - 0.5) * 90}
                    cy={cutDepth - u * 220}
                    r={1.4 + (k % 0.4) * 6}
                    fill={PLATE.cut}
                    opacity={o}
                  />
                );
              })
            : null}

          {/* Scale figure standing on the lip — the reason the cut reads as
              enormous rather than as a rectangle. */}
          {cut > 0.1 ? (
            <g
              transform={`translate(${TRENCH_X - 84}, ${geo.surfaceTopAt(TRENCH_X - 84) - 62}) scale(62)`}
              opacity={0.95}
            >
              <path
                d={
                  (cycle(frame, 9, 2) === 0
                    ? 'M0.5,0.0 L0.5,0.42 M0.5,0.42 L0.42,0.72 M0.5,0.42 L0.58,0.72 M0.5,0.10 L0.70,0.24'
                    : 'M0.5,0.0 L0.5,0.42 M0.5,0.42 L0.40,0.72 M0.5,0.42 L0.60,0.72 M0.5,0.10 L0.68,0.18')
                }
                fill="none"
                stroke={PLATE.cut}
                strokeWidth={2.6 / 62}
                strokeLinecap="round"
              />
            </g>
          ) : null}

          {/* Depth marker in the margin — trails the cut by design. */}
          {cut > 0.06 ? (
            <g opacity={0.85}>
              <line
                x1={TRENCH_X - 150} y1={GROUND - 80}
                x2={TRENCH_X - 150} y2={lerp(GROUND, cutDepth, easeOutCubic(clamp01((p - 0.02) * 1.15)))}
                stroke={PLATE.ember} strokeWidth={1.6} opacity={0.75}
              />
              <text
                x={TRENCH_X - 166}
                y={lerp(GROUND, cutDepth, easeOutCubic(clamp01((p - 0.02) * 1.15))) + 6}
                textAnchor="end"
                fill={PLATE.ember}
                style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 26, letterSpacing: 1.6 }}
              >
                {Math.round(cut * 16)} m
              </text>
            </g>
          ) : null}
        </svg>
      </AbsoluteFill>

      <PlateCaption
        x={96}
        y={92}
        title="The Great Trench"
        sub="1871–73 · driven through nine cities"
        t={ramp(p, 0.02, 0.2)}
      />
    </Plate>
  );
};
