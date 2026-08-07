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
// the subject of the frame over a quiet, textured ground. Typography is the
// whole design here: Cinzel display, Inter kicker, careful tracking and
// leading. Text stays well clear of SAFE_AREA.bottom (subtitles) and prefers
// short fragments so it never competes with the burned-in captions.
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

type VariantStyle = {
  textColor: string;
  accent: string;
  bgTop: string;
  bgBottom: string;
  weight: number;
  letterSpacing: string;
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
    letterSpacing: '0.01em',
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
    letterSpacing: '0.005em',
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
    letterSpacing: '0.015em',
    fontSizeMax: 62,
    fontSizeMin: 44,
    rule: false,
    ruleDouble: false,
    align: 'center',
  },
};

// Ground texture: a handful of seeded soft glows + faint horizon, kept
// static/cheap — no per-frame SVG filters.
const Ground: React.FC<{ seed: number; variant: StatementVariant }> = ({ seed, variant }) => {
  const v = VARIANTS[variant];
  const glows = useMemo(() => {
    const rng = mulberry32(Math.floor(seed * 1e6) + 401);
    return Array.from({ length: 3 }, () => ({
      x: 15 + rng() * 70,
      y: 10 + rng() * 55,
      r: 380 + rng() * 420,
      o: 0.05 + rng() * 0.07,
    }));
  }, [seed]);

  return (
    <AbsoluteFill style={{ background: `linear-gradient(160deg, ${v.bgTop} 0%, ${v.bgBottom} 100%)` }}>
      {glows.map((g, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${g.x}%`,
            top: `${g.y}%`,
            width: g.r,
            height: g.r,
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${v.accent} 0%, rgba(0,0,0,0) 70%)`,
            opacity: g.o,
          }}
        />
      ))}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse 70% 65% at 50% 44%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.68) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

export const StatementCard: React.FC<SceneProps> = ({ progress, seed, options }) => {
  const opts = (options ?? {}) as StatementCardOptions;
  const lines = opts.lines && opts.lines.length > 0 ? opts.lines : [];
  const variant: StatementVariant = opts.variant ?? 'quiet';
  const kicker = opts.kicker;
  const v = VARIANTS[variant];

  // Longer lines shrink to fit within the safe width without wrapping badly.
  const longest = Math.max(0, ...lines.map((l) => l.length));
  const fontSize = clamp(
    v.fontSizeMax - Math.max(0, longest - 22) * 1.35,
    v.fontSizeMin,
    v.fontSizeMax
  );

  const kickerIn = easeOutCubic((progress - 0.02) / 0.14);
  const ruleIn = easeOutCubic((progress - 0.06) / 0.18);

  // Stagger line arrivals across the first half of the shot; the remainder
  // holds so the statement can sit under narration without further motion.
  const revealSpan = 0.5;
  const perLine = lines.length > 0 ? revealSpan / lines.length : revealSpan;

  // Ceiling for the text block so it never enters the subtitle safe area.
  const maxBottom = 1080 - SAFE_AREA.bottom - 90;

  return (
    <AbsoluteFill>
      <Ground seed={seed} variant={variant} />
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
            transform: 'translateY(-4%)',
          }}
        >
          {kicker && (
            <div
              style={{
                fontFamily: '"Inter", sans-serif',
                fontWeight: 600,
                fontSize: 24,
                letterSpacing: '0.42em',
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
                width: v.ruleDouble ? 96 : 64,
                height: v.ruleDouble ? 6 : 2,
                marginBottom: 40,
                background: v.accent,
                opacity: 0.6 * ruleIn,
                transform: `scaleX(${0.2 + 0.8 * ruleIn})`,
                boxShadow: v.ruleDouble ? `0 10px 0 0 ${v.accent}` : 'none',
              }}
            />
          )}

          {lines.map((line, i) => {
            const start = 0.08 + i * perLine;
            const t = easeOutCubic((progress - start) / 0.2);
            return (
              <div
                key={i}
                style={{
                  fontFamily: '"Cinzel", serif',
                  fontWeight: v.weight,
                  fontSize,
                  lineHeight: 1.34,
                  letterSpacing: v.letterSpacing,
                  color: v.textColor,
                  textAlign: v.align,
                  opacity: t,
                  transform: `translateY(${(1 - t) * 22}px)`,
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
