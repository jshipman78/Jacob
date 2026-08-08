/**
 * 4 — "Every claim is attacked by a fact-checker paid to kill it."
 *
 * The claim ledger, with the adversary working down it. The fact-check stage
 * is told to get claims retracted and given live search to hunt for
 * contradicting evidence, so it is drawn as a crosshair moving down the page,
 * not as a tick-box being ticked.
 */

import React from 'react';
import { AbsoluteFill } from 'remotion';
import { C, FONT_MONO, FONT_UI } from '../theme';
import { useT, ramp, springy, strike, Label } from '../kit';

type Claim = { id: string; text: string; attackedAt?: number; killed?: boolean };

// Kept short enough to set on one line at 34px — a claim that wraps puts the
// strike-through between its own two lines.
const CLAIMS: Claim[] = [
  { id: 'C-01', text: 'Schliemann reached Hisarlık in 1870.' },
  { id: 'C-02', text: 'The treasure came from one deposit.', attackedAt: 1.85, killed: true },
  { id: 'C-03', text: 'Troy VIIa ends in a burn layer.' },
  { id: 'C-04', text: 'His wife was present at the find.', attackedAt: 2.75, killed: true },
];

const ROW_H = 168;
const TOP = 360;

export const Claims: React.FC = () => {
  const t = useT();

  // The crosshair rides down the ledger, pausing on what it is attacking.
  const scan = Math.min(3, Math.max(0, t - 1.25));
  const scanY = TOP + 60 + Math.min(3.4, scan * 1.15) * ROW_H * 0.78;

  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: 250, left: 90, opacity: ramp(t, 0, 0.3) }}>
        <Label size={24} track={10} color={C.gold}>
          claim ledger — carthage
        </Label>
      </div>
      <div
        style={{
          position: 'absolute',
          top: 258,
          right: 90,
          opacity: ramp(t, 0.1, 0.4),
          fontFamily: FONT_MONO,
          fontSize: 24,
          color: C.cutDim,
          letterSpacing: 2,
        }}
      >
        38 written
      </div>
      <div
        style={{
          position: 'absolute',
          top: 312,
          left: 90,
          width: 900 * ramp(t, 0.05, 0.4),
          height: 2,
          background: C.gold,
          opacity: 0.7,
        }}
      />

      {CLAIMS.map((c, i) => {
        const at = 0.18 + i * 0.16;
        const p = ramp(t, at, at + 0.3);
        if (p <= 0) return null;
        const slide = springy(t - at, 13, 20);
        const hit = c.attackedAt !== undefined ? strike(t, c.attackedAt, 9) : 0;
        const killed = c.killed && c.attackedAt !== undefined && t >= c.attackedAt;
        const killP = c.attackedAt !== undefined ? ramp(t, c.attackedAt, c.attackedAt + 0.3) : 0;
        const y = TOP + i * ROW_H;

        return (
          <div
            key={c.id}
            style={{
              position: 'absolute',
              top: y,
              left: 90,
              width: 900,
              height: ROW_H - 26,
              opacity: p * (killed ? 1 - killP * 0.45 : 1),
              transform: `translateX(${((1 - slide) * 90 + hit * 16).toFixed(1)}px)`,
              border: `2px solid ${killed ? C.red : C.cutFaint}`,
              background: killed
                ? 'rgba(194,64,47,0.10)'
                : 'linear-gradient(180deg, rgba(32,22,13,0.85), rgba(10,8,6,0.85))',
              padding: '22px 28px',
              boxSizing: 'border-box',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 24,
                  color: killed ? C.red : C.gold,
                  border: `1px solid ${killed ? C.red : C.gold}`,
                  padding: '4px 10px',
                }}
              >
                {c.id}
              </span>
              <span
                style={{
                  fontFamily: FONT_UI,
                  fontSize: 34,
                  fontWeight: 600,
                  color: killed ? C.cutDim : C.cut,
                  flex: 1,
                }}
              >
                {c.text}
              </span>
            </div>

            {/* the strike-through, drawn left to right through the claim */}
            {killP > 0 ? (
              <div
                style={{
                  position: 'absolute',
                  top: 46,
                  left: 28,
                  height: 5,
                  width: (900 - 56) * Math.min(1, killP * 1.6),
                  background: C.red,
                  opacity: 0.9,
                }}
              />
            ) : null}

            {killP > 0.4 ? (
              <div
                style={{
                  position: 'absolute',
                  right: 28,
                  bottom: 18,
                  fontFamily: FONT_UI,
                  fontSize: 22,
                  letterSpacing: 4,
                  textTransform: 'uppercase',
                  color: C.red,
                  opacity: ramp(t, (c.attackedAt ?? 0) + 0.25, (c.attackedAt ?? 0) + 0.45),
                }}
              >
                contradicted — retracted
              </div>
            ) : null}
          </div>
        );
      })}

      {/* --- the adversary -------------------------------------------------- */}
      <svg
        viewBox="0 0 1080 1920"
        width="100%"
        height="100%"
        style={{ position: 'absolute', inset: 0, opacity: ramp(t, 1.2, 1.45) }}
      >
        <g transform={`translate(0 ${scanY.toFixed(1)})`}>
          <line x1={70} y1={0} x2={1010} y2={0} stroke={C.red} strokeWidth={2} opacity={0.75} />
          <circle cx={540} cy={0} r={26 + 6 * Math.sin(t * 9)} fill="none" stroke={C.red} strokeWidth={3} />
          <line x1={540 - 44} y1={0} x2={540 - 14} y2={0} stroke={C.red} strokeWidth={3} />
          <line x1={540 + 14} y1={0} x2={540 + 44} y2={0} stroke={C.red} strokeWidth={3} />
          <line x1={540} y1={-44} x2={540} y2={-14} stroke={C.red} strokeWidth={3} />
          <line x1={540} y1={14} x2={540} y2={44} stroke={C.red} strokeWidth={3} />
        </g>
      </svg>

      <div
        style={{
          position: 'absolute',
          top: 1180,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: ramp(t, 1.3, 1.6),
          fontFamily: FONT_UI,
          fontWeight: 800,
          fontSize: 30,
          letterSpacing: 8,
          textTransform: 'uppercase',
          color: C.red,
        }}
      >
        adversarial fact-check · searching for contradictions
      </div>
    </AbsoluteFill>
  );
};
