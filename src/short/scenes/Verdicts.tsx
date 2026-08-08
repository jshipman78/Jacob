/**
 * 5 — "Unproven? Cut. Disputed? It says so out loud."
 *
 * The three outcomes, in the order the architecture doc puts them. The point
 * of the beat is that `disputed` is not a quiet footnote: it survives only
 * with a hedge the narration has to speak, so the hedge is typed out here and
 * a little waveform runs under it.
 */

import React from 'react';
import { AbsoluteFill } from 'remotion';
import { C, FONT_MONO, FONT_UI } from '../theme';
import { useT, ramp, springy, strike, easeOutExpo, Label } from '../kit';

const HEDGE = '“generally placed around 146 BCE”';
const CUT_AT = 0.95;
const DISPUTED_AT = 1.65;
const HEDGE_AT = 1.95;

const ROWS = [
  { verdict: 'established', color: C.green, note: 'may be stated flatly', y: 380 },
  { verdict: 'disputed', color: C.gold, note: 'survives only with a spoken hedge', y: 630 },
  { verdict: 'unsupported', color: C.red, note: 'cut before a word is written', y: 880 },
];

export const Verdicts: React.FC = () => {
  const t = useT();

  const cutKick = strike(t, CUT_AT, 11);
  const dropP = ramp(t, CUT_AT + 0.12, CUT_AT + 0.75);
  const focus = easeOutExpo(ramp(t, DISPUTED_AT, DISPUTED_AT + 0.3));
  const typed = Math.max(0, Math.floor((t - HEDGE_AT) * 26));

  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: 262, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <Label size={24} track={10} color={C.cutDim} style={{ opacity: ramp(t, 0, 0.3) }}>
          three outcomes, not two
        </Label>
      </div>

      {ROWS.map((row, i) => {
        const at = 0.1 + i * 0.14;
        const p = ramp(t, at, at + 0.28);
        if (p <= 0) return null;
        const pop = springy(t - at, 13, 19);

        const isCut = i === 2;
        const isDisputed = i === 1;

        const drop = isCut ? dropP : 0;
        const dim = isDisputed ? 0 : focus * 0.55;

        return (
          <div
            key={row.verdict}
            style={{
              position: 'absolute',
              top: row.y,
              left: 90,
              width: 900,
              height: 210,
              boxSizing: 'border-box',
              padding: '30px 34px',
              border: `3px solid ${row.color}`,
              background: 'linear-gradient(180deg, rgba(32,22,13,0.9), rgba(10,8,6,0.9))',
              opacity: p * (1 - drop) * (1 - dim),
              transform:
                `translate(${(drop * 140 + (1 - pop) * -60).toFixed(1)}px, ${(drop * 620).toFixed(1)}px) ` +
                `rotate(${(drop * 13).toFixed(2)}deg) ` +
                `scale(${(1 + (isDisputed ? focus * 0.05 : 0) + (isCut ? cutKick * 0.06 : 0)).toFixed(3)})`,
              boxShadow: isDisputed
                ? `0 0 ${60 * focus}px rgba(217,184,114,${(0.3 * focus).toFixed(3)})`
                : 'none',
            }}
          >
            <div
              style={{
                fontFamily: FONT_UI,
                fontWeight: 900,
                fontSize: 62,
                letterSpacing: 3,
                textTransform: 'uppercase',
                color: row.color,
              }}
            >
              {row.verdict}
            </div>
            <div style={{ marginTop: 8, fontFamily: FONT_UI, fontSize: 30, color: C.cutDim }}>
              {row.note}
            </div>

            {i === 0 ? (
              <svg width={90} height={90} style={{ position: 'absolute', right: 34, top: 60 }}>
                <path
                  d="M 12 46 L 34 68 L 78 18"
                  fill="none"
                  stroke={C.green}
                  strokeWidth={8}
                  strokeLinecap="round"
                  strokeDasharray={130}
                  strokeDashoffset={130 * (1 - ramp(t, 0.45, 0.8))}
                />
              </svg>
            ) : null}
          </div>
        );
      })}

      {/* --- CUT stamp, struck on the unsupported row ----------------------- */}
      {t >= CUT_AT && dropP < 0.9 ? (
        <div
          style={{
            position: 'absolute',
            top: 930,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            opacity: (1 - dropP) * easeOutExpo(ramp(t, CUT_AT, CUT_AT + 0.15)),
            transform: `translateY(${(dropP * 620).toFixed(1)}px) rotate(${(-9 + dropP * 13).toFixed(1)}deg) scale(${(1.5 - 0.5 * easeOutExpo(ramp(t, CUT_AT, CUT_AT + 0.18))).toFixed(3)})`,
          }}
        >
          <div
            style={{
              border: `8px solid ${C.red}`,
              color: C.red,
              fontFamily: FONT_UI,
              fontWeight: 900,
              fontSize: 110,
              letterSpacing: 10,
              padding: '4px 44px',
              background: 'rgba(10,8,6,0.6)',
            }}
          >
            CUT
          </div>
        </div>
      ) : null}

      {/* --- the hedge the narrator has to say ------------------------------ */}
      {t >= HEDGE_AT ? (
        <div style={{ position: 'absolute', top: 1120, left: 90, width: 900 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            {/* a little level meter: this is spoken, not printed */}
            {Array.from({ length: 22 }).map((_, i) => {
              const h = 6 + 30 * Math.abs(Math.sin(t * 7 + i * 0.7)) * Math.min(1, typed / 6);
              return (
                <div
                  key={i}
                  style={{
                    width: 5,
                    height: h,
                    background: C.gold,
                    opacity: 0.5 + 0.5 * (h / 36),
                  }}
                />
              );
            })}
          </div>
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 40,
              color: C.goldBright,
              letterSpacing: 1,
            }}
          >
            {HEDGE.slice(0, typed)}
            <span style={{ opacity: Math.floor(t * 4) % 2 ? 0.2 : 1 }}>▌</span>
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
