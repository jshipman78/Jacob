import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import '@fontsource/cinzel/500.css';
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import type { SceneProps } from './types';
import { SAFE_AREA, PALETTE } from './types';

// ---------------------------------------------------------------------------
// StatementCard — the rhetorical beats. A short line (or two) of type set as
// the subject of the frame over a quiet, living ground. Typography is the
// whole design here: Cinzel display, Inter kicker, careful tracking and
// leading, a rule that draws rather than pops, tracking that settles as a
// line lands. Text stays well clear of SAFE_AREA.bottom (subtitles) and
// prefers short fragments so it never competes with the burned-in captions.
//
// Motion model: line/rule/kicker arrival is driven by `progress` (a clear,
// one-time arc regardless of shot length). Once settled, the ground keeps a
// slow, continuous life — drifting glows, a breathing vignette — driven off
// `frame/fps` (elapsed seconds) so the card is never inert for the rest of a
// long hold.
// ---------------------------------------------------------------------------

export type StatementVariant = 'question' | 'verdict' | 'quiet';

export interface StatementCardOptions {
  lines?: string[];
  variant?: StatementVariant;
  kicker?: string;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const TAU = Math.PI * 2;

type VariantStyle = {
  textColor: string;
  accent: string;
  bgTop: string;
  bgBottom: string;
  weight: number;
  letterSpacing: number; // em, settled value
  fontSizeMax: number;
  fontSizeMin: number;
  rule: boolean;
  ruleDouble: boolean;
  align: 'center' | 'left';
};

const VARIANTS: Record<StatementVariant, VariantStyle> = {
  question: {
    textColor: '#e9e2d6',
    accent: '#a7c4cf',
    bgTop: '#0b0e12',
    bgBottom: '#050608',
    weight: 500,
    letterSpacing: 0.01,
    fontSizeMax: 78,
    fontSizeMin: 54,
    rule: true,
    ruleDouble: false,
    align: 'center',
  },
  verdict: {
    textColor: PALETTE.goldBright,
    accent: PALETTE.gold,
    bgTop: '#120b06',
    bgBottom: '#050302',
    weight: 700,
    letterSpacing: 0.005,
    fontSizeMax: 84,
    fontSizeMin: 58,
    rule: true,
    ruleDouble: true,
    align: 'center',
  },
  quiet: {
    textColor: PALETTE.bone,
    accent: PALETTE.ash,
    bgTop: '#0a0908',
    bgBottom: '#040303',
    weight: 500,
    letterSpacing: 0.015,
    fontSizeMax: 62,
    fontSizeMin: 44,
    rule: false,
    ruleDouble: false,
    align: 'center',
  },
};

// Ground texture: a handful of seeded soft glows that drift and breathe
// continuously — cheap (opacity/transform only), no per-frame filters.
const Ground: React.FC<{ seed: number; variant: StatementVariant; t: number }> = ({ seed, variant, t }) => {
  const v = VARIANTS[variant];
  const glows = useMemo(() => {
    const rng = mulberry32(Math.floor(seed * 1e6) + 401);
    return Array.from({ length: 3 }, () => ({
      x: 15 + rng() * 70,
      y: 10 + rng() * 55,
      r: 380 + rng() * 420,
      o: 0.05 + rng() * 0.07,
      driftPeriod: 14 + rng() * 16,
      breathePeriod: 6 + rng() * 6,
      phase: rng() * TAU,
    }));
  }, [seed]);

  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${v.bgTop} 0%, ${v.bgBottom} 100%)` }}>
      {glows.map((g, i) => {
        const dx = Math.sin(t * TAU / g.driftPeriod + g.phase) * 3.2;
        const dy = Math.cos(t * TAU / (g.driftPeriod * 1.3) + g.phase) * 2.4;
        const breathe = 0.75 + 0.25 * Math.sin(t * TAU / g.breathePeriod + g.phase);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${g.x + dx}%`,
              top: `${g.y + dy}%`,
              width: g.r,
              height: g.r,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${v.accent} 0%, rgba(0,0,0,0) 70%)`,
              opacity: g.o * breathe,
            }}
          />
        );
      })}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse 70% 65% at 50% 44%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.68) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

export const StatementCard: React.FC<SceneProps> = ({ progress, frame, fps, seed, options }) => {
  const opts = (options ?? {}) as StatementCardOptions;
  const lines = opts.lines && opts.lines.length > 0 ? opts.lines : [];
  const variant: StatementVariant = opts.variant ?? 'quiet';
  const kicker = opts.kicker;
  const v = VARIANTS[variant];
  const t = frame / Math.max(1, fps);

  // Longer lines shrink to fit within the safe width without wrapping badly.
  const longest = Math.max(0, ...lines.map((l) => l.length));
  const fontSize = clamp(
    v.fontSizeMax - Math.max(0, longest - 22) * 1.35,
    v.fontSizeMin,
    v.fontSizeMax
  );

  const kickerIn = easeOutCubic((progress - 0.02) / 0.14);
  const ruleIn = easeOutCubic((progress - 0.06) / 0.2);
  // A faint highlight travels along the settled rule — a slow, continuous
  // "light catching metal" cue rather than a static bar.
  const ruleTravel = (Math.sin(t * TAU / 9 + seed * TAU) + 1) / 2;

  // Stagger line arrivals across the first ~55% of the shot; the remainder
  // holds so the statement can sit under narration with only quiet ambient
  // motion continuing (ground drift/breathe, rule shimmer).
  const revealSpan = 0.55;
  const perLine = lines.length > 0 ? revealSpan / lines.length : revealSpan;

  const maxBottom = 1080 - SAFE_AREA.bottom - 90;

  // Whole block breathes almost imperceptibly once settled, so a long hold
  // never reads as a frozen frame.
  const settleBreath = 1 + 0.0035 * Math.sin(t * TAU / 6.5 + seed * TAU);

  return (
    <AbsoluteFill>
      <Ground seed={seed} variant={variant} t={t} />
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          padding: `0 ${SAFE_AREA.edge + 80}px`,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: v.align === 'center' ? 'center' : 'flex-start',
            maxWidth: 1500,
            maxHeight: maxBottom - 260,
            transform: `translateY(-4%) scale(${settleBreath})`,
          }}
        >
          {kicker && (
            <div
              style={{
                fontFamily: '"Inter", sans-serif',
                fontWeight: 600,
                fontSize: 24,
                letterSpacing: `${0.3 + 0.28 * (1 - kickerIn)}em`,
                textTransform: 'uppercase',
                color: v.accent,
                opacity: 0.55 * kickerIn,
                transform: `translateY(${(1 - kickerIn) * 14}px)`,
                marginBottom: 34,
              }}
            >
              {kicker}
            </div>
          )}

          {v.rule && (
            <div
              style={{
                position: 'relative',
                width: v.ruleDouble ? 96 : 64,
                height: v.ruleDouble ? 6 : 2,
                marginBottom: 40,
                overflow: 'hidden',
                background: 'rgba(255,255,255,0.08)',
                opacity: ruleIn > 0 ? 1 : 0,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: v.accent,
                  transform: `scaleX(${clamp(ruleIn, 0, 1)})`,
                  transformOrigin: 'left center',
                }}
              />
              {ruleIn >= 1 && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    width: '40%',
                    left: `${ruleTravel * 100 - 20}%`,
                    background:
                      'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%)',
                    opacity: 0.5,
                  }}
                />
              )}
            </div>
          )}

          {lines.map((line, i) => {
            const start = 0.08 + i * perLine;
            const tt = easeOutCubic((progress - start) / 0.22);
            // Tracking (letter-spacing) settles from slightly wide to the
            // variant's resting value as the line lands.
            const ls = v.letterSpacing + (1 - tt) * 0.05;
            return (
              <div
                key={i}
                style={{
                  fontFamily: '"Cinzel", serif',
                  fontWeight: v.weight,
                  fontSize,
                  lineHeight: 1.34,
                  letterSpacing: `${ls}em`,
                  color: v.textColor,
                  textAlign: v.align,
                  opacity: tt,
                  transform: `translateY(${(1 - tt) * 22}px)`,
                  textShadow: '0 3px 30px rgba(0,0,0,0.55)',
                }}
              >
                {line}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export default StatementCard;
