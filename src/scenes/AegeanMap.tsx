import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/cinzel/600.css';
import type { SceneProps } from './types';
import { SAFE_AREA, PALETTE } from './types';

/**
 * AegeanMap — an engraved-chart-style schematic of the northeastern Aegean:
 * the Dardanelles strait running southwest to northeast, the Gallipoli
 * peninsula on its western bank, the Anatolian mainland (the Troad) on its
 * eastern bank, and the mound of Hisarlik marked a few kilometres inland
 * from the strait's southern, Aegean-facing mouth.
 *
 * The chart lives in a fixed "world" coordinate space; a camera <g> pans and
 * zooms over that space so the same geometry can serve a wide regional shot
 * or a tight shot on the mound without redrawing anything.
 *
 * options:
 *   focus?: 'region' | 'site' — 'region' (default) shows the whole strait
 *     and both seas; 'site' pushes in tight on the Troad and the mound.
 *   showLabels?: boolean — default true.
 */

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32), seeded from the scene's `seed` prop.
// ---------------------------------------------------------------------------
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

type AegeanMapOptions = {
  focus?: 'region' | 'site';
  showLabels?: boolean;
};

// ---------------------------------------------------------------------------
// World geometry (fixed coordinate space, roughly matched to the 1920x1080
// canvas at rest scale). North is up. The strait runs bottom-left (Aegean
// mouth, by the Troad) to top-right (Marmara mouth) — the real orientation
// of the Dardanelles.
// ---------------------------------------------------------------------------

// Hisarlik's world position — a few world-units inland (east) from the
// Aegean coast, just south of the strait's southern mouth.
const HISARLIK = { x: 826, y: 738 };
const TROAD_LABEL_PT = { x: 676, y: 730 };

// Coastline strokes (drawn as ink lines on top of the land fills).
const AEGEAN_COAST = 'M800,660 C758,742 716,824 698,900 C686,955 690,1012 714,1064';
const GALLIPOLI_OUTER =
  'M800,660 C696,634 616,582 556,508 C516,454 496,378 516,300 C536,222 588,146 660,80';
const W_BANK =
  'M800,660 C878,584 936,514 1006,458 C1058,414 1120,380 1180,350 C1280,300 1360,240 1420,170';
const E_BANK =
  'M928,596 C978,528 1018,470 1068,430 C1108,400 1160,375 1210,355 C1300,310 1390,260 1480,210';

// Closed fill polygons (land). Their non-coastal edges run to an implied
// "chart edge" — antique charts routinely vignette out rather than resolve
// every coastline to the frame, which reads as intentional, not unfinished.
const ANATOLIA_FILL =
  'M800,660 C758,742 716,824 698,900 C686,955 690,1012 714,1064 L1660,1064 L1660,300 C1606,252 1544,222 1480,210 C1390,260 1300,310 1210,355 C1160,375 1108,400 1068,430 C1018,470 978,528 928,596 Z';
const GALLIPOLI_FILL =
  'M800,660 C696,634 616,582 556,508 C516,454 496,378 516,300 C536,222 588,146 660,80 L250,80 L250,760 Z';

// Small unlabeled river valleys draining toward the coast near the mound —
// texture and plausibility, not asserted as precise hydrology.
const RIVER_A = 'M1060,760 C960,730 890,720 828,742';
const RIVER_B = 'M1000,900 C910,860 856,820 820,772';

// Hand-placed coastal hachure ticks: [x, y, angleDeg].
const COAST_TICKS: [number, number, number][] = [
  [762, 740, 20], [726, 812, 15], [702, 884, 8], [692, 992, -4],
  [712, 616, 210], [636, 566, 200], [576, 500, 195], [520, 420, 188],
  [510, 340, 178], [546, 240, 165], [606, 160, 155],
  [852, 610, 60], [942, 512, 55], [1042, 452, 48], [1136, 396, 42], [1250, 328, 35], [1350, 264, 30],
  [928, 546, 300], [1008, 470, 295], [1096, 416, 290], [1190, 378, 282], [1276, 322, 278], [1366, 272, 270],
];

// Short wave-hachure ticks for open water, hand-placed.
const WAVE_TICKS: [number, number, number][] = [
  [430, 760, -8], [500, 820, 6], [400, 880, -4], [470, 940, 10],
  [340, 700, 4], [560, 700, -6],
  [1000, 560, 18], [1080, 480, 22], [1150, 410, 15],
  [1560, 260, -10], [1620, 340, 6], [1500, 190, 4], [1680, 420, -6],
  [1440, 130, 10], [1560, 420, -4], [1650, 560, 8],
];

const Tick: React.FC<{ x: number; y: number; angle: number; len?: number; opacity: number; color: string }> = ({
  x,
  y,
  angle,
  len = 15,
  opacity,
  color,
}) => (
  <line
    x1={x}
    y1={y}
    x2={x + len * Math.cos((angle * Math.PI) / 180)}
    y2={y + len * Math.sin((angle * Math.PI) / 180)}
    stroke={color}
    strokeWidth={1}
    strokeOpacity={opacity}
    strokeLinecap="round"
  />
);

const WaveTick: React.FC<{ x: number; y: number; angle: number; opacity: number }> = ({ x, y, angle, opacity }) => (
  <g transform={`translate(${x},${y}) rotate(${angle})`} opacity={opacity}>
    <path d="M-14,0 Q-7,-4 0,0 Q7,4 14,0" fill="none" stroke={PALETTE.bone} strokeWidth={1} strokeOpacity={0.5} />
  </g>
);

// A world-space anchored label whose own size stays constant on screen
// regardless of the camera's current zoom (`k`) — the standard map-pin
// counter-scale trick.
const GeoAnchor: React.FC<{ x: number; y: number; k: number; children: React.ReactNode }> = ({
  x,
  y,
  k,
  children,
}) => (
  <g transform={`translate(${x},${y}) scale(${1 / k})`}>{children}</g>
);

const DASH_L_BIG = 1600;
const DASH_L_SMALL = 260;

export const AegeanMap: React.FC<SceneProps> = ({ progress, frame, fps, seed, options }) => {
  const opts = (options ?? {}) as AegeanMapOptions;
  const focus = opts.focus ?? 'region';
  const showLabels = opts.showLabels ?? true;

  const seedInt = Math.floor(seed * 1e9) + 1;

  // Static paper speckle — computed once per seed, not per frame.
  const speckle = useMemo(() => {
    const rand = mulberry32(seedInt + 71);
    return Array.from({ length: 70 }, () => ({
      x: rand() * 1920,
      y: rand() * 1080,
      r: 0.5 + rand() * 1.1,
      o: 0.04 + rand() * 0.07,
    }));
  }, [seedInt]);

  // --- Reveal stages ---------------------------------------------------
  // easeOut (not easeInOut) so the very first strokes appear promptly
  // rather than holding on black while the ease ramps up.
  const coastDraw = easeOutCubic(remap01(progress, 0.0, 0.4));
  const landFade = easeOutCubic(remap01(progress, 0.05, 0.42));
  const hachureFade = easeOutCubic(remap01(progress, 0.22, 0.5));
  const waterFade = easeOutCubic(remap01(progress, 0.18, 0.46));
  const seaLabelsFade = easeOutCubic(remap01(progress, 0.32, 0.55));
  const markerPop = (() => {
    const t = remap01(progress, 0.42, 0.6);
    // Slight overshoot settle, hand-keyframed rather than a spring import.
    if (t < 0.7) return easeOutCubic(t / 0.7) * 1.14;
    return lerp(1.14, 1, easeOutCubic((t - 0.7) / 0.3));
  })();
  const siteLabelsFade = easeOutCubic(remap01(progress, 0.5, 0.72));
  const scaleBarFade = easeOutCubic(remap01(progress, 0.6, 0.8));

  // Camera: a continuous ease toward Hisarlik across the WHOLE shot, not a
  // late-arriving flourish. 'site' shots visibly travel from a regional
  // establishing view down onto the mound; 'region' shots get a gentle,
  // continuous push that never fully stops. Because this is driven straight
  // off `progress`, two nearby progress samples are always visibly
  // different — the chart is always slowly on the move.
  const cameraT = easeInOutCubic(progress);
  const kStart = focus === 'site' ? 0.95 : 0.82;
  const kEnd = focus === 'site' ? 2.4 : 1.0;
  const k = lerp(kStart, kEnd, cameraT);

  // The anchor stays vertically pinned inside the SAFE_AREA "lower pocket"
  // (below the title band, above the subtitle band) throughout, so the
  // marker/label never drift through the forbidden middle band; the
  // horizontal anchor carries the re-centering half of the move.
  const anchorY = focus === 'site' ? 748 : 738;
  const anchorXStart = focus === 'site' ? 940 : 900;
  const anchorXEnd = focus === 'site' ? 1180 : 826;
  const anchorX = lerp(anchorXStart, anchorXEnd, cameraT);
  const camX = anchorX - HISARLIK.x * k;
  const camY = anchorY - HISARLIK.y * k;
  const cameraTransform = `translate(${camX},${camY}) scale(${k})`;

  // Slow idle life on the marker ring once revealed — a small, continuous
  // breathing motion so a long hold never looks frozen.
  const idle = Math.sin((frame / fps) * ((Math.PI * 2) / 7)) * 0.5 + 0.5;

  // A slow, continuous survey-sweep and a faintly crawling graticule —
  // driven by `frame` rather than `progress`, so the chart keeps a quiet
  // pulse of life through any hold, independent of the shot's own length.
  const sweepAngle = ((frame / fps) * (360 / 26)) % 360;
  const graticuleCrawl = (frame / fps) * 5;
  const sweepEnvelope = easeOutCubic(remap01(progress, 0.05, 0.25));

  return (
    <AbsoluteFill style={{ backgroundColor: PALETTE.ink, overflow: 'hidden' }}>
      {/* Ambient warm glow, off-centre, low-key */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 1100px 800px at 62% 40%, ${PALETTE.soilWarm}33 0%, transparent 68%)`,
        }}
      />

      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          {/* Feathered contrast relief for the title-safe band — a soft
              falloff rather than a hard-edged seam. */}
          <linearGradient
            id="titleBandFade"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1={SAFE_AREA.titleBandTop - 50}
            x2="0"
            y2={SAFE_AREA.titleBandBottom + 50}
          >
            <stop offset="0%" stopColor={PALETTE.ink} stopOpacity={0} />
            <stop offset="18%" stopColor={PALETTE.ink} stopOpacity={0.32} />
            <stop offset="82%" stopColor={PALETTE.ink} stopOpacity={0.32} />
            <stop offset="100%" stopColor={PALETTE.ink} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="subtitleBandFade" gradientUnits="userSpaceOnUse" x1="0" y1={1080 - SAFE_AREA.bottom - 60} x2="0" y2={1080 - SAFE_AREA.bottom + 40}>
            <stop offset="0%" stopColor={PALETTE.ink} stopOpacity={0} />
            <stop offset="100%" stopColor={PALETTE.ink} stopOpacity={0.6} />
          </linearGradient>
        </defs>

        {/* Paper speckle, static */}
        {speckle.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill={PALETTE.bone} opacity={s.o} />
        ))}

        {/* Camera-transformed chart content */}
        <g transform={cameraTransform}>
          {/* Graticule — faint drifting grid, textural rather than literal */}
          <g opacity={0.1 * hachureFade} strokeDasharray="3 10">
            {[420, 820, 1220, 1620].map((gx) => (
              <line
                key={`gv-${gx}`}
                x1={gx}
                y1={-100}
                x2={gx}
                y2={1200}
                stroke={PALETTE.bone}
                strokeWidth={1}
                strokeDashoffset={graticuleCrawl}
              />
            ))}
            {[260, 560, 860, 1160].map((gy) => (
              <line
                key={`gh-${gy}`}
                x1={-100}
                y1={gy}
                x2={2000}
                y2={gy}
                stroke={PALETTE.bone}
                strokeWidth={1}
                strokeDashoffset={-graticuleCrawl}
              />
            ))}
          </g>

          {/* Land fills */}
          <path d={ANATOLIA_FILL} fill={PALETTE.soilWarm} opacity={0.6 * landFade} />
          <path d={ANATOLIA_FILL} fill={PALETTE.soil} opacity={0.35 * landFade} />
          <path d={GALLIPOLI_FILL} fill={PALETTE.soilWarm} opacity={0.5 * landFade} />
          <path d={GALLIPOLI_FILL} fill={PALETTE.soil} opacity={0.32 * landFade} />

          {/* River valleys */}
          <path d={RIVER_A} fill="none" stroke={PALETTE.bronze} strokeWidth={1} strokeOpacity={0.3 * hachureFade} />
          <path d={RIVER_B} fill="none" stroke={PALETTE.bronze} strokeWidth={1} strokeOpacity={0.24 * hachureFade} />

          {/* Coastal hachures (engraved-chart relief ticks) */}
          {COAST_TICKS.map(([x, y, a], i) => (
            <Tick key={i} x={x} y={y} angle={a} opacity={0.34 * hachureFade} color={PALETTE.bronze} len={13} />
          ))}

          {/* Water hachures */}
          {WAVE_TICKS.map(([x, y, a], i) => (
            <WaveTick key={i} x={x} y={y} angle={a} opacity={0.3 * waterFade} />
          ))}

          {/* Coastline strokes — drawn in with a dash-offset reveal */}
          {[AEGEAN_COAST, GALLIPOLI_OUTER, W_BANK, E_BANK].map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={PALETTE.gold}
              strokeWidth={1.6}
              strokeOpacity={0.72}
              strokeLinecap="round"
              strokeDasharray={DASH_L_BIG}
              strokeDashoffset={DASH_L_BIG * (1 - coastDraw)}
            />
          ))}

          {/* Contour rings around the mound — literal geography, scales
              with the camera so site-focus reveals more topographic
              detail. */}
          {[9, 16, 24].map((r, i) => (
            <ellipse
              key={r}
              cx={HISARLIK.x}
              cy={HISARLIK.y}
              rx={r}
              ry={r * 0.72}
              fill="none"
              stroke={PALETTE.gold}
              strokeWidth={0.8}
              strokeOpacity={0.3 * markerPop * (1 - i * 0.12)}
              strokeDasharray={DASH_L_SMALL}
              strokeDashoffset={DASH_L_SMALL * (1 - Math.min(1, markerPop))}
            />
          ))}

          {/* Hisarlik marker — a fixed-size chart pin, independent of zoom */}
          <GeoAnchor x={HISARLIK.x} y={HISARLIK.y} k={k}>
            <circle r={13 + idle * 1.6} fill="none" stroke={PALETTE.goldBright} strokeWidth={1} opacity={0.35 * Math.min(1, markerPop)} />
            <g transform={`scale(${Math.min(1, markerPop)}) rotate(45)`}>
              <rect x={-4} y={-4} width={8} height={8} fill={PALETTE.goldBright} />
            </g>
          </GeoAnchor>
        </g>

        {/* Contrast relief across the section-title safe band, feathered */}
        <rect x={0} y={SAFE_AREA.titleBandTop - 50} width={1920} height={SAFE_AREA.titleBandBottom - SAFE_AREA.titleBandTop + 100} fill="url(#titleBandFade)" />
        {/* Contrast relief across the subtitle safe band, feathered at its top edge */}
        <rect x={0} y={1080 - SAFE_AREA.bottom - 60} width={1920} height={SAFE_AREA.bottom + 60} fill="url(#subtitleBandFade)" />

        {/* Chart frame */}
        <rect
          x={SAFE_AREA.edge}
          y={70}
          width={1920 - SAFE_AREA.edge * 2}
          height={1080 - 140}
          fill="none"
          stroke={PALETTE.ash}
          strokeOpacity={0.2 * coastDraw}
          strokeWidth={1}
        />

        {/* Compass mark with a slow survey-sweep — a quiet, continuous
            living detail evoking a surveyor's instrument, independent of
            the reveal timeline. */}
        <g transform="translate(190,150)">
          <circle r={34} fill="none" stroke={PALETTE.ash} strokeOpacity={0.22 * sweepEnvelope} strokeWidth={1} />
          <g opacity={0.5 * sweepEnvelope} style={{ transformOrigin: '0px 0px' }} transform={`rotate(${sweepAngle})`}>
            <defs>
              <linearGradient id="sweepGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={PALETTE.goldBright} stopOpacity={0} />
                <stop offset="100%" stopColor={PALETTE.goldBright} stopOpacity={0.55} />
              </linearGradient>
            </defs>
            <line x1={0} y1={0} x2={34} y2={0} stroke="url(#sweepGrad)" strokeWidth={1.2} />
          </g>
          <g opacity={0.4 * easeOutCubic(remap01(progress, 0.1, 0.3))}>
            <line x1={0} y1={20} x2={0} y2={-20} stroke={PALETTE.bone} strokeWidth={1} />
            <path d="M0,-20 L-5,-10 L5,-10 Z" fill={PALETTE.bone} />
            <text x={0} y={48} fill={PALETTE.bone} fontFamily="Inter, sans-serif" fontSize={12} letterSpacing={2} textAnchor="middle">
              N
            </text>
          </g>
        </g>
      </svg>

      {/* HTML labels for crisp type — world-anchored via worldToScreen so
          they pan and zoom with the camera exactly like the chart beneath
          them, then held at a constant on-screen size. */}
      {showLabels && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {focus === 'region' &&
            (() => {
              const marmara = worldToScreen(1520, 230, camX, camY, k);
              const aegean = worldToScreen(430, 800, camX, camY, k);
              const dardanelles = worldToScreen(1150, 335, camX, camY, k);
              return (
                <>
                  <Label left={marmara.x} top={marmara.y} text="SEA OF MARMARA" size={14} spacing={4} color={PALETTE.bone} opacity={0.55 * seaLabelsFade} weight={500} />
                  <Label left={aegean.x} top={aegean.y} text="AEGEAN SEA" size={14} spacing={4} color={PALETTE.bone} opacity={0.55 * seaLabelsFade} weight={500} />
                  <Label
                    left={dardanelles.x}
                    top={dardanelles.y}
                    text="THE DARDANELLES"
                    size={15}
                    spacing={3.5}
                    color={PALETTE.goldBright}
                    opacity={0.7 * seaLabelsFade}
                    weight={600}
                    rotate={-27}
                  />
                </>
              );
            })()}

          {(() => {
            const troadPt = worldToScreen(TROAD_LABEL_PT.x, TROAD_LABEL_PT.y, camX, camY, k);
            const hisPt = worldToScreen(HISARLIK.x, HISARLIK.y, camX, camY, k);
            return (
              <>
                <Label left={troadPt.x} top={troadPt.y} text="THE TROAD" size={13} spacing={3} color={PALETTE.ash} opacity={0.5 * siteLabelsFade} weight={500} fixedScreen align="right" />
                <div
                  style={{
                    position: 'absolute',
                    left: hisPt.x + 16,
                    top: hisPt.y - 30,
                    opacity: siteLabelsFade,
                    transform: `translateY(${(1 - siteLabelsFade) * 10}px)`,
                  }}
                >
                  <div
                    style={{
                      fontFamily: '"Cinzel", serif',
                      fontWeight: 600,
                      fontSize: 22,
                      letterSpacing: 3,
                      color: PALETTE.goldBright,
                      textShadow: '0 2px 18px rgba(0,0,0,0.7)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    HISARLIK
                  </div>
                  {focus === 'site' && (
                    <div
                      style={{
                        fontFamily: 'Inter, sans-serif',
                        fontWeight: 500,
                        fontSize: 12.5,
                        letterSpacing: 1.5,
                        color: PALETTE.ash,
                        marginTop: 4,
                        opacity: scaleBarFade,
                      }}
                    >
                      site of ancient Troy · ~5 km from the coast
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}
    </AbsoluteFill>
  );
};

// --- small label / projection helpers ---------------------------------

function worldToScreen(x: number, y: number, camX: number, camY: number, k: number) {
  return { x: x * k + camX, y: y * k + camY };
}

const Label: React.FC<{
  left: number;
  top: number;
  text: string;
  size: number;
  spacing: number;
  color: string;
  opacity: number;
  weight: number;
  rotate?: number;
  align?: 'left' | 'right';
  fixedScreen?: boolean;
}> = ({ left, top, text, size, spacing, color, opacity, weight, rotate = 0, align = 'left' }) => (
  <div
    style={{
      position: 'absolute',
      left,
      top,
      transform: `translate(${align === 'right' ? '-100%' : '0'}, -50%) rotate(${rotate}deg)`,
      fontFamily: 'Inter, sans-serif',
      fontWeight: weight,
      fontSize: size,
      letterSpacing: spacing,
      color,
      opacity,
      whiteSpace: 'nowrap',
      textTransform: 'uppercase',
    }}
  >
    {text}
  </div>
);

export default AegeanMap;
