import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import type { SceneProps } from './types';
import {
  Plate, PLATE, HatchField, StippleField, InkPath, PlateCaption,
  hatch, crossHatch, hatchContours, stipple, flicks, contour, segment, wobblyEllipse,
  rngFor, makeFbm1D, lerp, clamp01,
  onNs, rakingLight, ramp, stagger, settle, pulse,
  easeOutCubic, easeInOutCubic, easeOutQuint,
} from './engraving';

/**
 * LampInterior — the film's nocturne.
 *
 * The landscape plate cannot carry every atmospheric beat. Three of them are
 * interiors, and putting a wide shot of a mound behind them was simply the
 * wrong picture: the boy reading Homer by candlelight, the gold going into the
 * shawl, and the crates leaving the country at night all happen in a room, at
 * a table, by one small light.
 *
 * So this is a single lamplit still life, cut as a night-piece: a table edge,
 * an open book or a wrapped bundle, and one flame that is genuinely the only
 * light in the plate. Everything is modelled by its distance from that flame —
 * the hatching opens up near it and closes to solid black away from it, which
 * is exactly how a wood engraver renders lamplight.
 *
 * The flame itself is animated on THREES with a seeded, quantised flicker; the
 * cast shadows and the modelling follow it a frame or two behind, so the room
 * breathes with the light instead of pulsing in lockstep with it.
 *
 * options:
 *   subject?: 'book' | 'bundle' | 'crates'
 *   intensity?: number
 */

const W = 1920;
const H = 1080;

/** The flame — the single source everything in the plate is lit by. */
const LAMP = { x: 1268, y: 372 };
const TABLE_Y = 640;

type Subject = 'book' | 'bundle' | 'crates';
type Options = { subject?: Subject; intensity?: number };

export const LampInterior: React.FC<SceneProps> = ({
  progress, frame, fps, seed, options,
}) => {
  const opts = (options ?? {}) as Options;
  const subject = opts.subject ?? 'book';
  const intensity = clamp01(opts.intensity ?? 0.7);

  const geo = useMemo(() => {
    const rand = rngFor(seed, 'lamp');
    const fbm = makeFbm1D(seed, 'lampf');

    /** Falloff from the flame, 0 (dark) → 1 (lit), in plate coordinates. */
    const litAt = (px: number, py: number) => {
      // Wide enough that the subject on the table is genuinely lit. A
      // physically tight falloff looked right in the abstract and left the
      // book — the whole point of the shot — invisible.
      const d = Math.hypot((px - LAMP.x) / 880, (py - LAMP.y) / 640);
      return clamp01(1.2 - Math.pow(d, 1.3));
    };

    // --- the room behind: hatched only where the light reaches ------------
    const wall = crossHatch(seed, 'wall', {
      x: -60, y: 40, w: W + 120, h: 700,
      angle: 88, pitch: 11, amp: 1.4, coverage: 0.72, jitter: 0.7, width: 1.0, samples: 8,
      crossAngle: 22, crossPitch: 17,
      density: (u, v) => litAt(-60 + u * (W + 120), 40 + v * 700) * 0.9,
    });

    // --- the table: a strong horizontal, catching the light ----------------
    const tablePts: { x: number; y: number }[] = [];
    for (let i = 0; i <= 50; i++) {
      const u = i / 50;
      tablePts.push({ x: -60 + u * (W + 120), y: TABLE_Y + fbm(u * 4 + 9) * 4 });
    }
    const tableEdge = contour(seed, 'table', tablePts, 1.5, 240);
    const tableTop = hatch(seed, 'ttop', {
      x: -60, y: TABLE_Y, w: W + 120, h: 200,
      angle: 4, pitch: 9, amp: 1.5, coverage: 0.8, jitter: 0.5, width: 1.0, samples: 10,
      density: (u, v) => litAt(-60 + u * (W + 120), TABLE_Y + v * 200) * clamp01(1.3 - v * 1.5),
    });
    // Wood grain running along the table, only where lit.
    const grain = flicks(seed, 'grain', {
      x: -60, y: TABLE_Y + 8, w: W + 120, h: 150,
      count: 220, length: 90,
      angleAt: () => 2,
      density: (u, v) => litAt(-60 + u * (W + 120), TABLE_Y + 8 + v * 150),
    });

    // --- the lamp -----------------------------------------------------------
    const lampBody = contour(seed, 'lampb', [
      { x: LAMP.x - 46, y: LAMP.y + 214 }, { x: LAMP.x - 34, y: LAMP.y + 150 },
      { x: LAMP.x - 18, y: LAMP.y + 96 }, { x: LAMP.x - 15, y: LAMP.y + 56 },
      { x: LAMP.x - 26, y: LAMP.y + 40 }, { x: LAMP.x - 12, y: LAMP.y + 26 },
    ], 1.2, 80);
    const lampBody2 = contour(seed, 'lampb2', [
      { x: LAMP.x + 46, y: LAMP.y + 214 }, { x: LAMP.x + 34, y: LAMP.y + 150 },
      { x: LAMP.x + 18, y: LAMP.y + 96 }, { x: LAMP.x + 15, y: LAMP.y + 56 },
      { x: LAMP.x + 26, y: LAMP.y + 40 }, { x: LAMP.x + 12, y: LAMP.y + 26 },
    ], 1.2, 80);
    const lampFoot = wobblyEllipse(seed, 'lampf', LAMP.x, LAMP.y + 216, 62, 13, 0.9, 30);

    // --- the subject on the table ------------------------------------------
    // Book: two leaves opened toward the light, text as ruled lines.
    const BX = 700;   // centre of the open book
    const BW = 420;   // half-width
    const bookL = contour(seed, 'bookl', [
      { x: BX - BW, y: TABLE_Y - 4 }, { x: BX - BW + 62, y: TABLE_Y - 86 },
      { x: BX - 170, y: TABLE_Y - 112 }, { x: BX, y: TABLE_Y - 92 },
    ], 1.4, 90);
    const bookR = contour(seed, 'bookr', [
      { x: BX, y: TABLE_Y - 92 }, { x: BX + 170, y: TABLE_Y - 112 },
      { x: BX + BW - 62, y: TABLE_Y - 82 }, { x: BX + BW, y: TABLE_Y - 2 },
    ], 1.4, 90);
    const bookBase = contour(seed, 'bookbase', [
      { x: BX - BW, y: TABLE_Y - 4 }, { x: BX - 200, y: TABLE_Y + 18 },
      { x: BX, y: TABLE_Y + 24 }, { x: BX + 200, y: TABLE_Y + 18 }, { x: BX + BW, y: TABLE_Y - 2 },
    ], 1.2, 120);
    const spine = contour(seed, 'spine',
      segment({ x: BX, y: TABLE_Y - 92 }, { x: BX, y: TABLE_Y + 24 }, 8), 1.0, 60);
    const textLines: { d: string; len: number }[] = [];
    for (let i = 0; i < 14; i++) {
      const y = TABLE_Y - 88 + i * 7.4;
      const inset = i * 2.6;
      textLines.push(contour(seed, `tl${i}`,
        segment({ x: BX - BW + 74 + inset, y: y - 4 - i * 0.5 }, { x: BX - 26, y: y }, 8), 0.7, 60));
      textLines.push(contour(seed, `tr${i}`,
        segment({ x: BX + 26, y }, { x: BX + BW - 74 - inset, y: y - 4 - i * 0.5 }, 8), 0.7, 60));
    }

    // Bundle: cloth folded over something heavy, with contour hatching that
    // follows the folds.
    const bundleTop: { x: number; y: number }[] = [];
    for (let i = 0; i <= 40; i++) {
      const u = i / 40;
      const x = 400 + u * 620;
      const y =
        TABLE_Y + 10 -
        Math.exp(-Math.pow((u - 0.45) / 0.34, 2)) * 150 -
        Math.exp(-Math.pow((u - 0.72) / 0.18, 2)) * 60 +
        fbm(u * 9 + 21) * 12;
      bundleTop.push({ x, y });
    }
    const bundleLine = contour(seed, 'bundle', bundleTop, 1.5, 110);
    // Close the silhouette along the table, and tie the cloth — without these
    // the bundle is an open curve and reads as another hill, which is exactly
    // what it looked like on the first pass.
    const bundleBase = contour(seed, 'bundlebase',
      segment({ x: 400, y: TABLE_Y + 10 }, { x: 1020, y: TABLE_Y + 14 }, 14), 1.1, 140);
    const bundleTies = [
      contour(seed, 'tie1', [
        { x: 560, y: TABLE_Y + 8 }, { x: 588, y: TABLE_Y - 60 },
        { x: 640, y: TABLE_Y - 116 }, { x: 700, y: TABLE_Y - 146 },
      ], 1.2, 90),
      contour(seed, 'tie2', [
        { x: 700, y: TABLE_Y - 146 }, { x: 772, y: TABLE_Y - 122 },
        { x: 828, y: TABLE_Y - 66 }, { x: 856, y: TABLE_Y + 6 },
      ], 1.2, 90),
    ];
    // The knot at the crown, where the corners are gathered.
    const knot = wobblyEllipse(seed, 'knot', 700, TABLE_Y - 152, 30, 19, 1.0, 26);
    const bundleFolds = hatchContours(seed, 'folds', bundleTop, {
      lines: 20, spacing: 9, spacingGrowth: 1.06, dashLength: 28, dashGap: 14,
      amp: 1.2, width: 1.15, drift: 8,
      density: (u, v) => {
        const x = 400 + u * 620;
        const y = TABLE_Y + 10 - (1 - v) * 120;
        return litAt(x, y) * clamp01(1.25 - v * 1.3) * (0.55 + fbm(u * 7 + 4) * 0.8);
      },
    });

    // Crates: three boxes, stacked, stencilled.
    const crates = [
      { x: 300, y: TABLE_Y - 150, w: 250, h: 150 },
      { x: 570, y: TABLE_Y - 116, w: 200, h: 116 },
      { x: 470, y: TABLE_Y - 300, w: 220, h: 140 },
    ];

    // Dust and smoke rising off the flame.
    const smoke = stipple(seed, 'smoke', {
      x: LAMP.x - 130, y: 80, w: 260, h: 320, count: 150, minR: 0.6, maxR: 2.6,
    });

    return {
      wall, tableEdge, tableTop, grain, lampBody, lampBody2, lampFoot,
      bookL, bookR, bookBase, spine, textLines,
      bundleLine, bundleBase, bundleTies, knot, bundleFolds, crates, smoke, litAt,
    };
  }, [seed]);

  const p = clamp01(progress);
  const t = frame / fps;

  /**
   * The flame. Quantised to threes and driven by a seeded noise table, so it
   * flickers like a flame — irregular, held, occasionally guttering — instead
   * of breathing like a sine wave. Deterministic under out-of-order rendering
   * because it is a pure function of the frame index.
   */
  const flick = useMemo(() => {
    const rand = rngFor(seed, 'flame');
    const arr = new Float32Array(600);
    for (let i = 0; i < 600; i++) arr[i] = rand();
    return arr;
  }, [seed]);
  const fi = Math.floor(onNs(frame, 3) / 3);
  const f0 = flick[fi % 600];
  const f1 = flick[(fi + 1) % 600];
  // Occasional gutter — the flame drops hard, roughly once every few seconds.
  const gutter = f0 > 0.94 ? 0.45 : 1;
  const flame = (0.78 + f0 * 0.30) * gutter;
  const flameLean = (f1 - 0.5) * 7;

  const tRoom = ramp(p, 0.0, 0.34);
  const tTable = ramp(p, 0.06, 0.40);
  const tLamp = ramp(p, 0.10, 0.36);
  const tSubject = ramp(p, 0.22, 0.70);

  // Camera: a slow drift in toward the light, easing at both ends, plus a
  // gentle lateral so the plate never sits still.
  const push = easeInOutCubic(ramp(p, 0.04, 1.0));
  const camScale = 1.02 + push * 0.10;
  const camX = lerp(28, -34, push);
  const camY = lerp(10, -20, push);

  return (
    <Plate
      seed={seed}
      frame={frame}
      fps={fps}
      tone="warm"
      lightPeriodSec={40}
      lightStrength={0.35}
      plateMark={false}
    >
      <AbsoluteFill
        style={{
          transform: `scale(${camScale.toFixed(4)}) translate(${camX.toFixed(2)}px, ${camY.toFixed(2)}px)`,
          transformOrigin: '68% 42%',
        }}
      >
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute' }}>
          {/* The room. The flame's flicker modulates the hatching's opacity —
              light moving on a surface, not a filter over the top of it. */}
          <HatchField strokes={geo.wall.first} t={tRoom} color={PLATE.cut} alpha={0.30 * flame} passes={6} />
          <HatchField strokes={geo.wall.second} t={ramp(p, 0.10, 0.5)} color={PLATE.cutDim} alpha={0.22 * flame} passes={4} />

          {/* The table. */}
          <HatchField strokes={geo.tableTop} t={tTable} color={PLATE.cut} alpha={0.42 * flame} passes={5} />
          <HatchField strokes={geo.grain} t={ramp(p, 0.16, 0.56)} color={PLATE.cut} alpha={0.22 * flame} passes={4} />
          <InkPath d={geo.tableEdge.d} len={geo.tableEdge.len} t={tTable} color={PLATE.cut} width={2.0} opacity={0.8} />

          {/* The subject. */}
          {subject === 'book' ? (
            <g>
              <InkPath d={geo.bookBase.d} len={geo.bookBase.len} t={tSubject} color={PLATE.cut} width={1.8} opacity={0.85} />
              <InkPath d={geo.bookL.d} len={geo.bookL.len} t={tSubject} color={PLATE.cut} width={1.8} opacity={0.9} />
              <InkPath d={geo.bookR.d} len={geo.bookR.len} t={clamp01((tSubject - 0.12) / 0.88)} color={PLATE.cut} width={1.8} opacity={0.9} />
              <InkPath d={geo.spine.d} len={geo.spine.len} t={clamp01((tSubject - 0.2) / 0.8)} color={PLATE.cut} width={1.4} opacity={0.6} />
              {geo.textLines.map((l, i) => (
                <InkPath
                  key={i}
                  d={l.d} len={l.len}
                  t={stagger(clamp01((tSubject - 0.25) / 0.75), i, geo.textLines.length, 0.012, 0.2)}
                  color={PLATE.cut} width={0.7}
                  opacity={0.6 * flame}
                />
              ))}
            </g>
          ) : null}

          {subject === 'bundle' ? (
            <g>
              <HatchField strokes={geo.bundleFolds} t={tSubject} color={PLATE.cut} alpha={0.7 * flame} passes={5} />
              <InkPath d={geo.bundleLine.d} len={geo.bundleLine.len} t={tSubject} color={PLATE.cut} width={2.0} opacity={0.9} />
              <InkPath d={geo.bundleBase.d} len={geo.bundleBase.len} t={tSubject} color={PLATE.cut} width={1.5} opacity={0.6} />
              {geo.bundleTies.map((tie, i) => (
                <InkPath
                  key={i}
                  d={tie.d} len={tie.len}
                  t={clamp01((tSubject - 0.2 - i * 0.1) / 0.7)}
                  color={PLATE.cut} width={1.6} opacity={0.7}
                />
              ))}
              <InkPath d={geo.knot.d} len={geo.knot.len} t={clamp01((tSubject - 0.4) / 0.6)} color={PLATE.cut} width={1.8} opacity={0.85} />
              {/* Gold showing through the cloth — the reason for the scene. */}
              {Array.from({ length: 9 }, (_, i) => {
                const k = i / 9;
                const gt = stagger(clamp01((p - 0.5) / 0.45), i, 9, 0.06, 0.3);
                if (gt <= 0.02) return null;
                const x = 520 + k * 380;
                const y = TABLE_Y - 40 - Math.exp(-Math.pow((k - 0.4) / 0.4, 2)) * 70;
                const tw = 0.55 + 0.45 * Math.sin(t * 1.7 + i * 2.1);
                return (
                  <g key={i} opacity={gt * flame}>
                    <circle cx={x} cy={y} r={3 + tw * 2.4} fill={PLATE.goldBright} opacity={0.85} />
                    <path
                      d={`M ${x - 14} ${y} L ${x + 14} ${y} M ${x} ${y - 14} L ${x} ${y + 14}`}
                      stroke={PLATE.goldBright} strokeWidth={1.1} opacity={0.5 * tw}
                    />
                  </g>
                );
              })}
            </g>
          ) : null}

          {subject === 'crates' ? (
            <g>
              {geo.crates.map((c, i) => {
                const ct = stagger(tSubject, i, geo.crates.length, 0.16, 0.4);
                if (ct <= 0.02) return null;
                const s = settle(ct, 0.1);
                return (
                  <g key={i} opacity={clamp01(ct * 1.6)} transform={`translate(0, ${((1 - s) * -26).toFixed(1)})`}>
                    <rect
                      x={c.x} y={c.y} width={c.w} height={c.h}
                      fill="none" stroke={PLATE.cut} strokeWidth={2}
                      opacity={0.85 * (0.4 + geo.litAt(c.x + c.w / 2, c.y + c.h / 2) * 0.8)}
                    />
                    <path
                      d={`M ${c.x} ${c.y} L ${c.x + c.w} ${c.y + c.h} M ${c.x + c.w} ${c.y} L ${c.x} ${c.y + c.h}`}
                      stroke={PLATE.cut} strokeWidth={1.2}
                      opacity={0.45 * (0.4 + geo.litAt(c.x + c.w / 2, c.y + c.h / 2) * 0.8)}
                    />
                    <text
                      x={c.x + c.w / 2} y={c.y + c.h / 2 + 8}
                      textAnchor="middle" fill={PLATE.cutDim}
                      opacity={0.7 * clamp01((ct - 0.5) / 0.5)}
                      style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 17, letterSpacing: 2.2 }}
                    >
                      ATHENS
                    </text>
                  </g>
                );
              })}
            </g>
          ) : null}

          {/* The lamp, and its flame. */}
          <g opacity={tLamp}>
            <InkPath d={geo.lampBody.d} len={geo.lampBody.len} t={tLamp} color={PLATE.cut} width={2.0} opacity={0.9} />
            <InkPath d={geo.lampBody2.d} len={geo.lampBody2.len} t={tLamp} color={PLATE.cut} width={2.0} opacity={0.9} />
            <InkPath d={geo.lampFoot.d} len={geo.lampFoot.len} t={tLamp} color={PLATE.cut} width={1.6} opacity={0.7} />
            {/* Flame: a cut teardrop that leans and changes height on threes. */}
            <path
              d={`M ${LAMP.x} ${LAMP.y + 26} C ${LAMP.x - 16} ${LAMP.y - 4}, ${LAMP.x - 11 + flameLean} ${LAMP.y - 34 * flame}, ${LAMP.x + flameLean} ${LAMP.y - 54 * flame} C ${LAMP.x + 11 + flameLean} ${LAMP.y - 34 * flame}, ${LAMP.x + 16} ${LAMP.y - 4}, ${LAMP.x} ${LAMP.y + 26} Z`}
              fill={PLATE.goldBright}
              opacity={0.9 * tLamp}
            />
            <path
              d={`M ${LAMP.x} ${LAMP.y + 14} C ${LAMP.x - 6} ${LAMP.y}, ${LAMP.x - 4 + flameLean * 0.6} ${LAMP.y - 16 * flame}, ${LAMP.x + flameLean * 0.6} ${LAMP.y - 26 * flame} C ${LAMP.x + 4 + flameLean * 0.6} ${LAMP.y - 16 * flame}, ${LAMP.x + 6} ${LAMP.y}, ${LAMP.x} ${LAMP.y + 14} Z`}
              fill="#fff4dc"
              opacity={0.95 * tLamp}
            />
          </g>

          {/* Smoke off the flame. */}
          {geo.smoke.map((m, i) => {
            const u = ((t * 0.06 + m.k * 4.3) % 1);
            const o = Math.sin(u * Math.PI) * 0.22 * tLamp * flame;
            if (o <= 0.01) return null;
            return (
              <circle
                key={i}
                cx={LAMP.x + (m.x - (LAMP.x - 130) - 130) * (0.3 + u * 1.4) + flameLean * 3}
                cy={LAMP.y - 60 - u * 300}
                r={m.r * (1 + u * 2)}
                fill={PLATE.cut}
                opacity={o}
              />
            );
          })}
        </svg>
      </AbsoluteFill>

      {/* The pool of lamplight. Follows the flicker one step behind, which is
          what makes the room feel lit rather than tinted. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 44% 52% at ${((LAMP.x / W) * 100).toFixed(1)}% ${((LAMP.y / H) * 100).toFixed(1)}%, rgba(255,206,124,${(0.20 * intensity * (0.8 + f1 * 0.35)).toFixed(4)}) 0%, rgba(214,140,58,${(0.07 * intensity).toFixed(4)}) 42%, rgba(0,0,0,0) 74%)`,
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />
      {/* Everything away from the flame falls to solid black. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 82% 88% at ${((LAMP.x / W) * 100).toFixed(1)}% ${((LAMP.y / H) * 100).toFixed(1)}%, rgba(0,0,0,0) 22%, rgba(0,0,0,0.52) 68%, rgba(0,0,0,0.86) 100%)`,
          pointerEvents: 'none',
        }}
      />
    </Plate>
  );
};
