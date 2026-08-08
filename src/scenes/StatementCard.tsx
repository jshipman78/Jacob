import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import type { SceneProps } from './types';
import {
  Plate, PLATE, HatchField, StippleField, InkPath,
  hatch, crossHatch, stipple, contour, segment, wobblyRect, wobblyEllipse,
  rngFor, makeFbm1D, lerp, clamp01,
  onNs, rakingLight, ramp, stagger, settle, pulse, anticipate,
  easeOutCubic, easeInOutCubic, easeOutQuint,
} from './engraving';

/**
 * StatementCard — the rhetorical beats, where a diagram would be
 * literal-minded and wrong.
 *
 * Cut as an engraved title plate: the words set in the block, an ornamental
 * rule cut above and below, a worked ground behind, and the raking light
 * crossing the letterforms so the type itself is a printed surface rather
 * than a text layer.
 *
 * The three variants have genuinely different behaviour, not just different
 * colours:
 *
 *   quiet   — the lines are cut one after another, each holding before the
 *             next begins. Air around them.
 *   question — the lines arrive with a lean and settle, and a cut rule sweeps
 *             beneath; the ground breathes.
 *   verdict — everything lands at once, hard, with a struck border and an
 *             ornament. This is the closing statement, so it is set like one.
 *
 * options:
 *   variant?: 'quiet' | 'question' | 'verdict'
 *   kicker?: string
 *   lines: string[]
 */

const W = 1920;
const H = 1080;
/** The type block sits above the caption band, centred in the usable frame. */
const CENTER_Y = 430;

type Variant = 'quiet' | 'question' | 'verdict';
type Options = { variant?: Variant; kicker?: string; lines?: string[] };

export const StatementCard: React.FC<SceneProps> = ({
  progress, frame, fps, seed, options,
}) => {
  const opts = (options ?? {}) as Options;
  const variant = opts.variant ?? 'quiet';
  const lines = opts.lines ?? [''];
  const kicker = opts.kicker;

  const geo = useMemo(() => {
    const rand = rngFor(seed, 'card');
    const fbm = makeFbm1D(seed, 'cardf');

    // The worked ground: a broad, low-contrast field so the plate is never
    // flat black behind the type.
    const ground = crossHatch(seed, 'cardground', {
      x: -60, y: 60, w: W + 120, h: 900,
      angle: 21, pitch: 30, amp: 2.4, coverage: 0.42, jitter: 1.4, width: 0.9, samples: 6,
      crossAngle: 78, crossPitch: 44,
      density: (u, v) => {
        // Brightest in a broad oval behind the type, falling to nothing at the
        // edges — a vignette made of strokes rather than of a gradient.
        const r = Math.hypot((u - 0.5) * 1.5, (v - 0.38) * 2.1);
        return clamp01((1 - Math.pow(r, 1.7)) * (0.5 + fbm(u * 5 + v * 3) * 0.7));
      },
    });

    const motes = stipple(seed, 'cardmotes', {
      x: 0, y: 80, w: W, h: 760, count: 340, minR: 0.5, maxR: 2.2,
      density: (u, v) => clamp01(1 - Math.hypot((u - 0.5) * 1.4, (v - 0.4) * 1.9)),
    });

    // Ornamental rules — a swelled line with a lozenge at the centre, the
    // standard engraver's divider.
    const ruleTop = contour(seed, 'rt',
      segment({ x: W / 2 - 300, y: 0 }, { x: W / 2 + 300, y: 1 }, 24), 1.0, 200);
    const ruleBot = contour(seed, 'rb',
      segment({ x: W / 2 - 300, y: 0 }, { x: W / 2 + 300, y: 1 }, 24), 1.0, 200);

    const border = wobblyRect(seed, 'cardborder', 168, 118, W - 336, 618, 1.6);
    const borderIn = wobblyRect(seed, 'cardborder2', 186, 136, W - 372, 582, 1.2);

    // Corner ornaments for the verdict plate.
    const corners = [
      { x: 168, y: 118, rot: 0 },
      { x: W - 168, y: 118, rot: 90 },
      { x: W - 168, y: 736, rot: 180 },
      { x: 168, y: 736, rot: 270 },
    ];

    return { ground, motes, ruleTop, ruleBot, border, borderIn, corners, rand };
  }, [seed]);

  const p = clamp01(progress);
  const t = frame / fps;

  const isVerdict = variant === 'verdict';
  const isQuestion = variant === 'question';

  const tGround = ramp(p, 0.0, isVerdict ? 0.14 : 0.30);
  const tRule = ramp(p, isVerdict ? 0.04 : 0.10, isVerdict ? 0.18 : 0.34);
  const tKicker = ramp(p, 0.06, 0.22);

  /**
   * Per-line timing. The variants differ in *rhythm*, which is the point:
   * `quiet` gives each line its own beat and a hold; `verdict` lands the whole
   * block together.
   */
  const lineT = (i: number) => {
    if (isVerdict) return ramp(p, 0.10, 0.24);
    if (isQuestion) return stagger(ramp(p, 0.12, 0.62), i, lines.length, 0.20, 0.26);
    return stagger(ramp(p, 0.14, 0.70), i, lines.length, 0.26, 0.24);
  };

  const fontSize = isVerdict ? 92 : lines.length > 1 ? 78 : 86;
  const lineHeight = fontSize * 1.24;
  const blockTop = CENTER_Y - ((lines.length - 1) * lineHeight) / 2;

  // The ground breathes for the question variant — a slow, quantised swell
  // that keeps the plate alive under a long held title.
  const breathe = 1 + (isQuestion ? 0.16 : 0.09) * Math.sin(onNs(frame, 5) * 0.038);

  // Camera: a very slow push, holding still for most of the shot. On a
  // typographic beat, restraint is the craft.
  const push = easeInOutCubic(ramp(p, 0.05, 1.0));
  const wander = rakingLight(frame, fps, 39, seed);
  const camScale = 1 + push * (isVerdict ? 0.055 : 0.032);
  const camY = -push * (isVerdict ? 10 : 6) + (wander - 0.5) * 9;
  const camXd = (rakingLight(frame, fps, 51, seed * 0.7) - 0.5) * 12;

  const sweep = rakingLight(frame, fps, isVerdict ? 21 : 34, seed);
  const litness = (u: number) => 1 + 0.55 * Math.exp(-Math.pow((u - lerp(-0.2, 1.2, sweep)) / 0.25, 2));

  const col = isVerdict ? PLATE.goldBright : isQuestion ? PLATE.cut : PLATE.cut;

  return (
    <Plate
      seed={seed}
      frame={frame}
      fps={fps}
      tone={isVerdict ? 'warm' : 'neutral'}
      lightPeriodSec={isVerdict ? 21 : 34}
      lightStrength={isVerdict ? 1 : 0.75}
    >
      <AbsoluteFill
        style={{
          transform: `scale(${camScale.toFixed(4)}) translate(${camXd.toFixed(2)}px, ${camY.toFixed(2)}px)`,
          transformOrigin: '50% 40%',
        }}
      >
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute' }}>
          <HatchField
            strokes={geo.ground.first}
            t={tGround}
            color={PLATE.cut}
            alpha={0.30 * breathe}
            passes={5}
            modulate={(s) => litness(s.k)}
          />
          <HatchField
            strokes={geo.ground.second}
            t={ramp(p, 0.12, 0.5)}
            color={PLATE.cutDim}
            alpha={0.26 * breathe}
            passes={4}
          />
          {/* Motes adrift in front of the plate. A typographic beat should be
              still, not frozen — these keep it breathing through a 28-second
              hold without competing with the words. */}
          {geo.motes.map((m, i) => {
            const speed = 0.014 + (m.k % 0.31) * 0.045;
            const u = ((t * speed) + m.k * 4.7) % 1;
            const fade = Math.sin(u * Math.PI);
            const o = m.o * fade * 0.4 * tGround;
            if (o <= 0.01) return null;
            return (
              <circle
                key={i}
                cx={m.x + (u - 0.5) * 130 * (0.4 + (m.k % 0.6))}
                cy={m.y - u * 160}
                r={m.r}
                fill={PLATE.cut}
                opacity={o}
              />
            );
          })}

          {/* Struck border, verdict only. */}
          {isVerdict ? (
            <>
              <InkPath d={geo.border.d} len={geo.border.len} t={ramp(p, 0.02, 0.2)} color={PLATE.gold} width={2.2} opacity={0.7} />
              <InkPath d={geo.borderIn.d} len={geo.borderIn.len} t={ramp(p, 0.08, 0.28)} color={PLATE.gold} width={0.9} opacity={0.4} />
              {geo.corners.map((c, i) => (
                <g
                  key={i}
                  transform={`translate(${c.x}, ${c.y}) rotate(${c.rot})`}
                  opacity={0.75 * clamp01((ramp(p, 0.14, 0.3)))}
                >
                  <path d="M0,26 L0,8 Q0,0 8,0 L26,0" fill="none" stroke={PLATE.goldBright} strokeWidth={2.4} />
                  <circle cx={13} cy={13} r={3.4} fill={PLATE.goldBright} opacity={0.8} />
                </g>
              ))}
            </>
          ) : null}

          {/* Ornamental rules above and below the type block. */}
          <g transform={`translate(0, ${blockTop - fontSize - 44})`}>
            <InkPath d={geo.ruleTop.d} len={geo.ruleTop.len} t={tRule} color={col} width={1.4} opacity={0.6} />
            <g opacity={0.8 * clamp01((tRule - 0.6) / 0.4)}>
              <path d={`M ${W / 2 - 11} 0 L ${W / 2} -8 L ${W / 2 + 11} 0 L ${W / 2} 8 Z`} fill={col} />
            </g>
          </g>
          <g transform={`translate(0, ${blockTop + (lines.length - 1) * lineHeight + 62})`}>
            <InkPath
              d={geo.ruleBot.d}
              len={geo.ruleBot.len}
              t={ramp(p, isVerdict ? 0.1 : 0.3, isVerdict ? 0.26 : 0.6)}
              color={col}
              width={1.4}
              opacity={0.6}
            />
            <g opacity={0.8 * clamp01((ramp(p, isVerdict ? 0.2 : 0.5, isVerdict ? 0.3 : 0.7)))}>
              <path d={`M ${W / 2 - 11} 0 L ${W / 2} -8 L ${W / 2 + 11} 0 L ${W / 2} 8 Z`} fill={col} />
            </g>
          </g>

          {/* A cut sweep beneath the question, arriving after the words. */}
          {isQuestion ? (
            <line
              x1={W / 2 - 340 * easeOutQuint(ramp(p, 0.62, 0.78))}
              y1={blockTop + (lines.length - 1) * lineHeight + 34}
              x2={W / 2 + 340 * easeOutQuint(ramp(p, 0.62, 0.78))}
              y2={blockTop + (lines.length - 1) * lineHeight + 34}
              stroke={PLATE.gold}
              strokeWidth={2.2}
              opacity={0.7}
            />
          ) : null}
        </svg>

        {/* The type itself. */}
        {kicker ? (
          <div
            style={{
              position: 'absolute',
              left: 0, right: 0,
              top: blockTop - fontSize - 122,
              textAlign: 'center',
              opacity: tKicker,
              transform: `translateY(${((1 - tKicker) * 8).toFixed(2)}px)`,
              fontFamily: "'Inter', sans-serif",
              fontWeight: 600,
              fontSize: 21,
              letterSpacing: 5.5,
              color: PLATE.cutDim,
              textShadow: '0 2px 16px rgba(0,0,0,0.85)',
            }}
          >
            {kicker}
          </div>
        ) : null}

        {lines.map((line, i) => {
          const t = lineT(i);
          if (t <= 0.005) return null;
          // Anticipation and settle on each line, so a word lands rather than
          // fading up.
          const s = isVerdict ? settle(t, 0.05) : anticipate(t, 0.05, 0.04);
          const slide = (1 - clamp01(s)) * (isQuestion ? 22 : 14);
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 0, right: 0,
                top: blockTop + i * lineHeight - fontSize * 0.7,
                textAlign: 'center',
                opacity: clamp01(t * 1.6),
                transform: `translateY(${slide.toFixed(2)}px)`,
                fontFamily: "'Cinzel', serif",
                fontWeight: isVerdict ? 700 : 600,
                fontSize,
                lineHeight: 1.24,
                letterSpacing: isVerdict ? 5 : 3.5,
                color: isVerdict ? PLATE.goldBright : '#e6dcc8',
                textShadow: isVerdict
                  ? '0 0 42px rgba(217,184,114,0.34), 0 3px 22px rgba(0,0,0,0.9)'
                  : '0 3px 22px rgba(0,0,0,0.9)',
              }}
            >
              {line}
            </div>
          );
        })}
      </AbsoluteFill>

      {/* The impact of the verdict landing — a single ring, once. */}
      {isVerdict ? (
        <AbsoluteFill
          style={{
            background: `radial-gradient(circle at 50% ${((CENTER_Y / H) * 100).toFixed(1)}%, rgba(240,211,143,${(pulse(p, 0.16, 0.05) * 0.22).toFixed(4)}) 0%, rgba(0,0,0,0) 55%)`,
            mixBlendMode: 'screen',
            pointerEvents: 'none',
          }}
        />
      ) : null}
    </Plate>
  );
};
