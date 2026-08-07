import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import type { SceneProps } from './types';
import {
  Plate, PLATE, HatchField, StippleField, InkPath, PlateCaption,
  hatch, crossHatch, hatchContours, stipple, flicks, contour, wobble, segment, swelled, burinProfile,
  rngFor, makeFbm1D, lerp, clamp01, clamp,
  onNs, rakingLight, ramp, easeOutCubic, easeInOutCubic, stagger,
} from './engraving';

/**
 * ExcavationField — the mound of Hisarlık under excavation, as a wide
 * engraved landscape plate.
 *
 * This is the film's atmospheric workhorse: it carries eight shots and about
 * a third of the running time, so it has to hold up under long looks and
 * never repeat itself. It is built as five depth planes that move at
 * different rates —
 *
 *   sky → far hills and the strait → the mound → the workings → foreground
 *
 * — which is where the depth comes from. On top of that: a gang of workmen
 * cut as tiny silhouettes, animated on fours in a six-pose cycle so they
 * read as *limited animation* rather than as tweened puppets; dust lifting
 * off the spoil heaps; and a raking light that crosses the whole plate over
 * half a minute.
 *
 * options:
 *   mood: 'fire' | 'candle' | 'dusk' | 'dust' | 'night' | 'gold'
 *   intensity?: number  — 0..1, how hard the mood is pushed.
 */

type Mood = 'fire' | 'candle' | 'dusk' | 'dust' | 'night' | 'gold';

type MoodSpec = {
  tone: 'cold' | 'neutral' | 'warm' | 'fire';
  /** Colour of the key light source in the scene. */
  key: string;
  /** Where the key sits, as a fraction of the frame. */
  keyX: number;
  keyY: number;
  /** How bright the sky hatching is. */
  skyLight: number;
  /** How much dust is in the air. */
  dust: number;
  /** Whether the workings are populated. */
  crew: number;
  lightPeriod: number;
};

const MOODS: Record<Mood, MoodSpec> = {
  fire:   { tone: 'fire',    key: '#e07a28', keyX: 0.30, keyY: 0.62, skyLight: 0.55, dust: 1.0, crew: 0.35, lightPeriod: 19 },
  candle: { tone: 'warm',    key: '#f0c477', keyX: 0.72, keyY: 0.44, skyLight: 0.22, dust: 0.35, crew: 0.0,  lightPeriod: 31 },
  dusk:   { tone: 'warm',    key: '#d9a05c', keyX: 0.18, keyY: 0.30, skyLight: 0.80, dust: 0.45, crew: 0.25, lightPeriod: 34 },
  dust:   { tone: 'neutral', key: '#e6d3aa', keyX: 0.62, keyY: 0.22, skyLight: 0.95, dust: 1.0,  crew: 1.0,  lightPeriod: 24 },
  night:  { tone: 'cold',    key: '#9fb4d0', keyX: 0.78, keyY: 0.18, skyLight: 0.30, dust: 0.25, crew: 0.18, lightPeriod: 38 },
  gold:   { tone: 'warm',    key: '#f0d38f', keyX: 0.50, keyY: 0.40, skyLight: 0.62, dust: 0.55, crew: 0.45, lightPeriod: 28 },
};

const W = 1920;
const H = 1080;
/** Horizon sits high — the mound and its workings own the lower two thirds. */
const HORIZON = 430;

// ---------------------------------------------------------------------------
// The six-pose workman cycle.
//
// Each pose is a tiny path drawn in a 1x1 unit box, scaled at use. They are
// deliberately crude — at 14 to 30 px tall on the plate a figure is five or
// six burin strokes, which is exactly how a real engraver would cut a distant
// gang of labourers.
// ---------------------------------------------------------------------------

type Pose = { d: string };

/** digging: down-swing, mid, up-swing, hold, carry-left, carry-right */
const POSES: Pose[] = [
  // 0 — bent over the pick, arms down
  { d: 'M0.5,0.02 L0.5,0.42 M0.5,0.42 L0.38,0.72 M0.5,0.42 L0.62,0.72 M0.5,0.12 L0.22,0.34 M0.5,0.14 L0.26,0.36' },
  // 1 — mid-swing, straightening
  { d: 'M0.5,0.0 L0.5,0.40 M0.5,0.40 L0.36,0.72 M0.5,0.40 L0.64,0.72 M0.5,0.10 L0.30,0.02 M0.5,0.12 L0.32,0.06' },
  // 2 — top of the swing, pick above the head
  { d: 'M0.48,0.0 L0.5,0.40 M0.5,0.40 L0.38,0.72 M0.5,0.40 L0.63,0.72 M0.48,0.06 L0.62,-0.16 M0.48,0.08 L0.60,-0.12' },
  // 3 — hold, upright, resting
  { d: 'M0.5,0.0 L0.5,0.42 M0.5,0.42 L0.42,0.72 M0.5,0.42 L0.58,0.72 M0.5,0.10 L0.66,0.28' },
  // 4 — carrying a basket, left stride
  { d: 'M0.5,0.0 L0.5,0.42 M0.5,0.42 L0.32,0.72 M0.5,0.42 L0.60,0.72 M0.5,0.12 L0.70,0.22 M0.66,0.22 L0.74,0.22' },
  // 5 — carrying a basket, right stride
  { d: 'M0.5,0.0 L0.5,0.42 M0.5,0.42 L0.44,0.72 M0.5,0.42 L0.68,0.72 M0.5,0.12 L0.70,0.24 M0.66,0.24 L0.74,0.24' },
];

type Figure = {
  x: number;
  y: number;
  scale: number;
  /** Which plane it belongs to, for parallax. */
  plane: number;
  /** Phase offset into the pose cycle. */
  phase: number;
  /** Frames per pose — varied so the gang isn't in lockstep. */
  hold: number;
  /** 'dig' figures cycle 0..3; 'carry' figures shuttle along a path. */
  kind: 'dig' | 'carry';
  /** For carriers: how far along their run, and the run's extent. */
  runX: number;
  flip: boolean;
  o: number;
};

export const ExcavationField: React.FC<SceneProps> = ({
  progress, frame, fps, seed, options,
}) => {
  const opts = (options ?? {}) as { mood?: Mood; intensity?: number };
  const mood = opts.mood ?? 'dusk';
  const spec = MOODS[mood] ?? MOODS.dusk;
  const intensity = clamp01(opts.intensity ?? 0.6);

  // -------------------------------------------------------------------------
  // Static geometry, built once per seed. None of this touches `frame`.
  // -------------------------------------------------------------------------

  const geo = useMemo(() => {
    const rand = rngFor(seed, 'field-geo');
    const fbm = makeFbm1D(seed, 'field-ridge');

    // --- far ridge line, across the whole plate ---------------------------
    const farPts: { x: number; y: number }[] = [];
    for (let i = 0; i <= 60; i++) {
      const u = i / 60;
      const x = -200 + u * (W + 400);
      const y =
        HORIZON -
        26 -
        fbm(u * 3.1 + 4.2) * 34 -
        Math.sin(u * Math.PI * 1.4 + 1.1) * 16;
      farPts.push({ x, y });
    }
    const farRidge = contour(seed, 'far', farPts, 1.4, 220);

    // --- the strait: a band of water below the far ridge -------------------
    const water = hatch(seed, 'water', {
      x: -100, y: HORIZON - 30, w: W + 200, h: 44,
      angle: 0, pitch: 5.2, amp: 1.6, coverage: 0.55, jitter: 0.9,
      width: 0.95, samples: 10,
      density: (_u, v) => 0.35 + 0.65 * (1 - v),
    });

    // --- the mound of Hisarlık: the silhouette that owns the frame --------
    // Asymmetric on purpose — the flat top is where the citadel was, and the
    // long tail to the right is the slope Schliemann attacked.
    const moundPts: { x: number; y: number }[] = [];
    for (let i = 0; i <= 90; i++) {
      const u = i / 90;
      const x = -160 + u * (W + 320);
      // A broad shoulder rising to a flat crown around u = 0.42.
      const crown = Math.exp(-Math.pow((u - 0.44) / 0.30, 2));
      const shoulder = Math.exp(-Math.pow((u - 0.74) / 0.26, 2)) * 0.42;
      const y =
        HORIZON + 30 - (crown * 246 + shoulder * 118) + fbm(u * 6.3 + 19.1) * 15;
      moundPts.push({ x, y });
    }
    const moundLine = contour(seed, 'mound', moundPts, 1.6, 190);
    const moundTopAt = (px: number) => {
      const u = clamp01((px + 160) / (W + 320));
      const i = Math.round(u * 90);
      return moundPts[clamp(i, 0, 90)].y;
    };

    // Closed silhouette, for masking the flank hatching.
    const moundFill =
      `M ${moundPts[0].x} ${H + 60} ` +
      moundPts.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') +
      ` L ${moundPts[moundPts.length - 1].x} ${H + 60} Z`;

    // --- the flank -------------------------------------------------------
    // Cut with CONTOUR hatching that follows the skyline down into the form,
    // not with a parallel grid. The lines themselves have to describe the
    // roundness of the mound; parallel hatching over the same shape reads as
    // graph paper laid on a hill, which is precisely the diagram problem we
    // are getting away from.
    //
    // Tone plan: a bright cut rim just under the skyline on the lit side, the
    // tone dropping away into an uncut dark on the shadow side and again into
    // the deep foreground, so the plate has real blacks rather than an even
    // grey everywhere.
    const flankTone = (u: number, v: number) => {
      // u runs left→right along the skyline, v runs down into the mound.
      const lit = 1 - clamp01(Math.abs(u - spec.keyX) * 1.7);
      // A bright cut rim just under the skyline — the light catching the crest.
      const rim = Math.exp(-Math.pow((v - 0.05) / 0.13, 2));
      // The body of the slope: full tone at the top, falling into the dark of
      // the near ground, then picking up again on the foreground bank.
      const body = clamp01(1 - v * 0.72);
      const trough = 1 - 0.55 * Math.exp(-Math.pow((v - 0.52) / 0.15, 2));
      // Passages of light and shadow ALONG the slope, so the tone is never an
      // even wash — this is what stops it reading as a gradient.
      const passages = 0.55 + fbm(u * 4.1 + 2.1) * 0.75 + fbm(u * 11.7 + 8.3) * 0.25;
      return clamp01((rim * 1.15 + body * 0.85) * (0.30 + lit * 0.95) * passages * trough);
    };
    const flankMain = hatchContours(seed, 'flankMain', moundPts, {
      // Enough contours to reach the foot of the plate: the near flank has to
      // fill the lower frame, or the composition is a lump in a void.
      lines: 44,
      spacing: 12,
      spacingGrowth: 1.055,
      dashLength: 44,
      dashGap: 17,
      amp: 1.1,
      width: 1.5,
      drift: 10,
      density: flankTone,
    });
    // A sparse second system running across the contours, only in the
    // mid-tones — the crossing pass an engraver adds last to deepen a grey.
    const flankCross = hatch(seed, 'flankCross', {
      x: -160, y: HORIZON - 150, w: W + 320, h: 420,
      angle: 64, pitch: 27, amp: 1.3, coverage: 0.42, jitter: 1.1,
      width: 0.85, samples: 6,
      density: (u, v) => {
        const t = flankTone(u, clamp01(v * 1.1));
        // Only where the tone is a middling grey; never in the lights or the
        // darks, which is what keeps it from flattening into a grid.
        return clamp01(1 - Math.abs(t - 0.42) * 3.4) * 0.85;
      },
    });

    // --- the trench cut into the near flank -------------------------------
    const trenchX = 1180;
    const trenchW = 300;
    const trenchTop = moundTopAt(trenchX + trenchW / 2) + 26;
    const trenchPts = [
      { x: trenchX, y: trenchTop },
      { x: trenchX + 26, y: trenchTop + 150 },
      { x: trenchX + 52, y: trenchTop + 268 },
      { x: trenchX + trenchW - 46, y: trenchTop + 276 },
      { x: trenchX + trenchW - 20, y: trenchTop + 148 },
      { x: trenchX + trenchW, y: trenchTop },
    ];
    const trench = contour(seed, 'trench', trenchPts, 1.5, 90);

    // --- spoil heaps in the near ground -----------------------------------
    const heaps = [0, 1, 2, 3].map((i) => {
      const cx = 160 + i * 470 + rand() * 130;
      const cy = 830 + rand() * 60;
      const rx = 200 + rand() * 130;
      const ry = 52 + rand() * 34;
      const pts: { x: number; y: number }[] = [];
      for (let j = 0; j <= 34; j++) {
        const u = j / 34;
        const a = Math.PI * (1 + u);
        pts.push({
          x: cx + Math.cos(a) * rx,
          y: cy + Math.sin(a) * ry * (0.8 + fbm(u * 5 + i * 9) * 0.35),
        });
      }
      return { line: contour(seed, `heap${i}`, pts, 1.3, 110), cx, cy, rx, ry };
    });

    // --- ground hatching in the working floor -----------------------------
    // Confined to a band well above the subtitles; below y≈820 the plate is
    // left almost solid, which both anchors the composition with a real black
    // and guarantees the caption band stays calm.
    const floor = hatch(seed, 'floor', {
      x: -80, y: 740, w: W + 160, h: 150,
      angle: 3, pitch: 19, amp: 1.9, coverage: 0.5, jitter: 1.0,
      width: 1.0, samples: 8,
      density: (u, v) =>
        clamp01(1.15 - v * 2.2) * clamp01(0.35 + fbm(u * 6.7 + 40) * 0.75),
    });

    // --- sky --------------------------------------------------------------
    // Only the band above the horizon is cut, and it fades to an uncut dark
    // at the top of the plate. A hatched sky that reaches the top edge has no
    // weight; leaving it solid is what gives the mound something to sit
    // against.
    const sky = hatch(seed, 'sky', {
      x: -60, y: 40, w: W + 120, h: HORIZON - 40,
      angle: 0, pitch: 13, amp: 2.2, coverage: 0.66, jitter: 0.9,
      width: 0.85, samples: 9,
      density: (u, v) => {
        // Bright only close to the horizon, and only near the key light.
        const toHorizon = Math.pow(v, 2.6);
        const toKey = 1 - clamp01(Math.abs(u - spec.keyX) * 1.55);
        return clamp01(toHorizon * 0.95 + toKey * toHorizon * 0.7 - 0.06);
      },
    });

    // --- clouds: a few long contour strokes, aerial ------------------------
    const clouds = [0, 1, 2, 3, 4].map((i) => {
      const y = 90 + i * 62 + rand() * 26;
      const x0 = -100 + rand() * 500;
      const w = 500 + rand() * 780;
      const pts: { x: number; y: number }[] = [];
      for (let j = 0; j <= 26; j++) {
        const u = j / 26;
        pts.push({ x: x0 + u * w, y: y + fbm(u * 4 + i * 13) * 11 });
      }
      return contour(seed, `cloud${i}`, pts, 1.2, 200);
    });

    // --- the gang ----------------------------------------------------------
    const figures: Figure[] = [];
    const nFigures = Math.round(26 * spec.crew);
    for (let i = 0; i < nFigures; i++) {
      // Most of the gang works ON the skyline, where a figure silhouettes
      // against the cut sky and actually reads. Buried in the flank hatching
      // they turn into debris — which is exactly what the first pass did.
      const onRidge = rand() < 0.62;
      const plane = onRidge ? 0 : rand() < 0.5 ? 1 : 2;
      const depth = [0.5, 0.72, 1.0][plane];
      const x = 110 + rand() * (W - 220);
      const ridgeY = moundTopAt(x);
      const y = onRidge
        ? ridgeY + 2 + rand() * 10
        : Math.min(ridgeY + 90 + depth * 190 + rand() * 40, 800);
      figures.push({
        x,
        y,
        scale: lerp(26, 52, depth) * lerp(0.85, 1.15, rand()),
        plane,
        phase: Math.floor(rand() * 6),
        hold: 3 + Math.floor(rand() * 4), // shoot on 3s, 4s, 5s or 6s
        kind: rand() < 0.62 ? 'dig' : 'carry',
        runX: 60 + rand() * 180,
        flip: rand() < 0.5,
        o: onRidge ? 0.95 : lerp(0.42, 0.8, depth),
      });
    }

    // --- airborne dust -----------------------------------------------------
    const motes = stipple(seed, 'motes', {
      x: -100, y: 260, w: W + 200, h: 640,
      count: Math.round(220 * spec.dust),
      minR: 0.7, maxR: 2.6,
    });

    // --- the near bank -----------------------------------------------------
    // A spoil bank thrown up in the immediate foreground, crossing the lower
    // third. It gives the plate a true near plane, puts a dark mass under the
    // subtitles, and creates a trough of shadow between itself and the mound —
    // which is what actually makes the mound sit *back* in the frame.
    const bankPts: { x: number; y: number }[] = [];
    for (let i = 0; i <= 70; i++) {
      const u = i / 70;
      const x = -200 + u * (W + 400);
      const hump =
        Math.exp(-Math.pow((u - 0.18) / 0.22, 2)) * 96 +
        Math.exp(-Math.pow((u - 0.82) / 0.28, 2)) * 74;
      bankPts.push({ x, y: 872 - hump + fbm(u * 8.7 + 55) * 20 });
    }
    const bankLine = contour(seed, 'bank', bankPts, 1.7, 150);
    const bankFill =
      `M ${bankPts[0].x} ${H + 60} ` +
      bankPts.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') +
      ` L ${bankPts[bankPts.length - 1].x} ${H + 60} Z`;
    // Only the crest is cut; below it the block is left solid, so the bottom
    // of the plate is a genuine black and the caption band stays calm.
    const bankHatch = hatchContours(seed, 'bank', bankPts, {
      lines: 9,
      spacing: 10,
      spacingGrowth: 1.16,
      dashLength: 30,
      dashGap: 22,
      amp: 1.3,
      width: 1.25,
      drift: 12,
      density: (u, v) =>
        clamp01(1.25 - v * 2.3) * clamp01(0.4 + fbm(u * 5.3 + 90) * 0.9),
    });

    // --- foreground framing: a dark cut corner, near-plane ------------------
    const foreFlicks = flicks(seed, 'fore', {
      x: -40, y: 830, w: 560, h: 130,
      count: 90,
      length: 26,
      angleAt: (u) => -18 - u * 26,
      density: (u, v) => clamp01((1 - u * 1.4)) * clamp01(1 - v * 0.7),
    });

    return {
      farRidge, water, moundLine, moundFill, flankMain, flankCross,
      trench, trenchTop, trenchX, trenchW,
      heaps, floor, sky, clouds, figures, motes, foreFlicks, moundTopAt,
      bankLine, bankFill, bankHatch,
    };
  }, [seed, spec.keyX, spec.crew, spec.dust]);

  // -------------------------------------------------------------------------
  // Time
  // -------------------------------------------------------------------------

  const p = clamp01(progress);

  // The plate builds itself in a deliberate order: sky, then the far land,
  // then the mound, then the workings, then the gang. Each stage overlaps the
  // next, so the drawing is always doing something somewhere.
  const tSky = ramp(p, 0.00, 0.26);
  const tFar = ramp(p, 0.06, 0.30);
  const tMound = ramp(p, 0.10, 0.40);
  const tFlank = ramp(p, 0.16, 0.58);
  const tWork = ramp(p, 0.26, 0.66);
  const tCrew = ramp(p, 0.34, 0.72);

  // Camera: a slow push with a lateral drift, easing at the turns rather than
  // sliding at a constant rate. This is the parallax driver.
  const camU = easeInOutCubic(clamp01(p * 1.06));
  const push = 1 + camU * 0.075;
  const driftX = lerp(-26, 26, rakingLight(frame, fps, 42, seed)) - camU * 30;
  const driftY = -camU * 22;

  const plane = (depth: number) => ({
    transform: `translate(${(driftX * depth).toFixed(2)}px, ${(driftY * depth).toFixed(2)}px) scale(${(1 + (push - 1) * depth).toFixed(4)})`,
    transformOrigin: '50% 62%',
  });

  // The travelling key light, used to modulate stroke opacity so the light
  // moves ACROSS the hatching rather than sitting on top of it as a haze.
  const sweep = rakingLight(frame, fps, spec.lightPeriod, seed * 0.37);
  const sweepX = lerp(-0.25, 1.25, sweep);
  const litness = (u: number) =>
    1 + 0.55 * intensity * Math.exp(-Math.pow((u - sweepX) / 0.26, 2));

  // Dust drifts on a long loop; motes rise and fade before they wrap.
  const dustT = frame / fps;

  return (
    <Plate
      seed={seed}
      frame={frame}
      fps={fps}
      tone={spec.tone}
      lightPeriodSec={spec.lightPeriod}
      lightStrength={0.7 + intensity * 0.5}
    >
      {/* ---------------- sky plane (slowest) ---------------- */}
      <AbsoluteFill style={plane(0.18)}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute' }}>
          <HatchField
            strokes={geo.sky}
            t={tSky}
            color={PLATE.cut}
            alpha={0.30 * spec.skyLight}
            weight={0.9}
            passes={6}
            modulate={(s) => litness(s.k)}
          />
          {geo.clouds.map((c, i) => (
            <InkPath
              key={i}
              d={c.d}
              len={c.len}
              t={stagger(tSky, i, geo.clouds.length, 0.1, 0.5)}
              color={PLATE.cut}
              width={1.0}
              opacity={0.16 + 0.1 * spec.skyLight}
            />
          ))}
        </svg>
      </AbsoluteFill>

      {/* ---------------- far land and the strait ---------------- */}
      <AbsoluteFill style={plane(0.34)}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute' }}>
          <HatchField
            strokes={geo.water}
            t={tFar}
            color={PLATE.cut}
            alpha={0.34}
            passes={4}
            modulate={(s) => litness(s.k)}
          />
          <InkPath d={geo.farRidge.d} len={geo.farRidge.len} t={tFar} color={PLATE.cutDim} width={1.5} opacity={0.6} />
        </svg>
      </AbsoluteFill>

      {/* ---------------- the mound ---------------- */}
      <AbsoluteFill style={plane(0.62)}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute' }}>
          <defs>
            <clipPath id={`mound-${Math.round(seed * 1e6)}`}>
              <path d={geo.moundFill} />
            </clipPath>
          </defs>

          {/* The block is dark inside the mound; the contour cuts open it. */}
          <g clipPath={`url(#mound-${Math.round(seed * 1e6)})`}>
            <HatchField
              strokes={geo.flankMain}
              t={tFlank}
              color={PLATE.cut}
              alpha={1.0}
              passes={5}
              modulate={(s) => litness(s.k)}
            />
            {/* The crossing pass arrives later — that's how an engraver
                actually builds a dark: one direction, then the other, with
                the block re-inked between. */}
            <HatchField
              strokes={geo.flankCross}
              t={ramp(p, 0.38, 0.82)}
              color={PLATE.cutDim}
              alpha={0.42}
              passes={4}
              modulate={(s) => litness(s.k)}
            />
          </g>

          <InkPath d={geo.moundLine.d} len={geo.moundLine.len} t={tMound} color={PLATE.cut} width={1.9} opacity={0.82} />
          <InkPath d={geo.trench.d} len={geo.trench.len} t={ramp(p, 0.30, 0.56)} color={PLATE.cut} width={1.6} opacity={0.72} />
        </svg>
      </AbsoluteFill>

      {/* ---------------- the workings ---------------- */}
      <AbsoluteFill style={plane(0.84)}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute' }}>
          <HatchField
            strokes={geo.floor}
            t={tWork}
            color={PLATE.cut}
            alpha={0.26}
            passes={5}
            modulate={(s) => litness(s.k)}
          />
          {geo.heaps.map((h, i) => (
            <InkPath
              key={i}
              d={h.line.d}
              len={h.line.len}
              t={stagger(tWork, i, geo.heaps.length, 0.12, 0.5)}
              color={PLATE.cut}
              width={1.4}
              opacity={0.5}
            />
          ))}

          {/* The gang. Poses are quantised — each figure holds its drawing
              for 3 to 6 frames and then snaps to the next. Nothing here is
              interpolated; that is the whole point. */}
          {geo.figures.map((f, i) => {
            const appear = stagger(tCrew, i, geo.figures.length, 0.014, 0.16);
            if (appear <= 0.02) return null;
            const held = Math.floor(onNs(frame + i * 5, f.hold) / f.hold);
            const poseIdx =
              f.kind === 'dig'
                ? (held + f.phase) % 4
                : 4 + ((held + f.phase) % 2);
            // Carriers shuttle back and forth along a short run, and they
            // pause at each end — a triangle wave with flats.
            const shuttle =
              f.kind === 'carry'
                ? (() => {
                    const c = ((frame / fps) * 0.09 + f.phase / 6) % 1;
                    const tri = c < 0.5 ? c * 2 : 2 - c * 2;
                    return (easeInOutCubic(clamp01((tri - 0.12) / 0.76)) - 0.5) * f.runX;
                  })()
                : 0;
            const s = f.scale;
            return (
              <g
                key={i}
                transform={`translate(${(f.x + shuttle).toFixed(1)}, ${f.y.toFixed(1)}) scale(${((f.flip ? -1 : 1) * s).toFixed(2)}, ${s.toFixed(2)})`}
                opacity={f.o * appear * 0.9}
              >
                <path
                  d={POSES[poseIdx].d}
                  fill="none"
                  stroke={PLATE.cut}
                  strokeWidth={2.4 / s}
                  strokeLinecap="round"
                />
              </g>
            );
          })}

          <StippleField
            dots={geo.motes.slice(0, Math.round(geo.motes.length * 0.4))}
            t={tWork}
            color={PLATE.cut}
            alpha={0.3}
          />
        </svg>
      </AbsoluteFill>

      {/* ---------------- airborne dust (fastest, nearest) ---------------- */}
      <AbsoluteFill style={plane(1.0)}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute' }}>
          {geo.motes.map((m, i) => {
            // Each mote drifts up and across on its own long loop, fading at
            // both ends so the wrap is never visible.
            const speed = 0.018 + (m.k % 0.31) * 0.05;
            const u = ((dustT * speed) + m.k * 3.7) % 1;
            const fade = Math.sin(u * Math.PI);
            const o = m.o * fade * 0.5 * spec.dust * tWork;
            if (o <= 0.01) return null;
            const dx = (u - 0.5) * 180 * (0.5 + (m.k % 0.5));
            const dy = -u * 150;
            return (
              <circle
                key={i}
                cx={m.x + dx}
                cy={m.y + dy}
                r={m.r}
                fill={PLATE.cut}
                opacity={o}
              />
            );
          })}
          {/* The near bank: a solid mass that occludes the middle distance,
              with only its crest cut open. */}
          <path d={geo.bankFill} fill={PLATE.blockDark} opacity={0.94} />
          <HatchField
            strokes={geo.bankHatch}
            t={ramp(p, 0.30, 0.70)}
            color={PLATE.cut}
            alpha={0.8}
            passes={4}
            modulate={(s) => litness(s.k)}
          />
          <InkPath
            d={geo.bankLine.d}
            len={geo.bankLine.len}
            t={ramp(p, 0.22, 0.52)}
            color={PLATE.cut}
            width={1.8}
            opacity={0.72}
          />
          <HatchField
            strokes={geo.foreFlicks}
            t={ramp(p, 0.42, 0.8)}
            color={PLATE.cut}
            alpha={0.22}
            passes={4}
          />
        </svg>
      </AbsoluteFill>

      {/* ---------------- the key light in the scene ---------------- */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 46% 52% at ${(spec.keyX * 100).toFixed(1)}% ${(spec.keyY * 100).toFixed(1)}%, ${spec.key}${Math.round(lerp(10, 42, intensity)).toString(16).padStart(2, '0')} 0%, rgba(0,0,0,0) 62%)`,
          mixBlendMode: 'screen',
          opacity: 0.5 + 0.5 * ramp(p, 0.0, 0.3),
          pointerEvents: 'none',
        }}
      />

      {mood === 'fire' ? (
        // The burning-city beat: a low ember glow that breathes, quantised so
        // it flickers like a flame rather than pulsing like an LED.
        <AbsoluteFill
          style={{
            background: `radial-gradient(ellipse 80% 34% at 50% 88%, rgba(196,98,31,${(0.16 + 0.10 * Math.abs(Math.sin(onNs(frame, 3) * 0.21))).toFixed(3)}) 0%, rgba(0,0,0,0) 70%)`,
            mixBlendMode: 'screen',
            pointerEvents: 'none',
          }}
        />
      ) : null}
    </Plate>
  );
};
