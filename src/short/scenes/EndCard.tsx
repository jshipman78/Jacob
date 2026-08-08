/**
 * 8 — "One command."
 *
 * Back to where it started, with the thing you'd actually type. The burst is
 * a graver's sunburst — struck once, then held while the last words land.
 */

import React from 'react';
import { AbsoluteFill } from 'remotion';
import { C, FONT_DISPLAY, FONT_MONO } from '../theme';
import { useT, ramp, strike, easeOutExpo, Label } from '../kit';

const COMMAND = 'npm run make-video -- "<topic>"';

export const EndCard: React.FC = () => {
  const t = useT();

  const burst = easeOutExpo(ramp(t, 0.1, 0.75));
  const kick = strike(t, 0.32, 9);
  const line = easeOutExpo(ramp(t, 0.35, 0.8));
  const tag = ramp(t, 0.95, 1.25);

  return (
    <AbsoluteFill>
      <svg viewBox="0 0 1080 1920" width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        {/* sunburst */}
        {Array.from({ length: 44 }).map((_, i) => {
          // The rays start outside the type, not through it — a burst behind a
          // word is energy, a burst across it is noise.
          const a = (i / 44) * Math.PI * 2 + t * 0.06;
          const inner = 330 + kick * 34;
          const outer = inner + (i % 2 ? 250 : 170) * burst;
          return (
            <line
              key={i}
              x1={540 + Math.cos(a) * inner}
              y1={780 + Math.sin(a) * inner}
              x2={540 + Math.cos(a) * outer}
              y2={780 + Math.sin(a) * outer}
              stroke={i % 2 ? C.gold : C.cutFaint}
              strokeWidth={i % 2 ? 2.4 : 1.4}
              opacity={(i % 2 ? 0.55 : 0.3) * burst}
            />
          );
        })}
        {/* the disc the type sits on, so the burst reads as behind it */}
        <circle cx={540} cy={780} r={310} fill="rgba(10,8,6,0.86)" opacity={burst} />
        <circle
          cx={540}
          cy={780}
          r={310 + kick * 26}
          fill="none"
          stroke={C.gold}
          strokeWidth={3}
          opacity={burst * 0.9}
        />
        <circle cx={540} cy={780} r={310 + 300 * kick} fill="none" stroke={C.goldBright} strokeWidth={4} opacity={kick} />
      </svg>

      <div
        style={{
          position: 'absolute',
          top: 640,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: burst,
          transform: `scale(${(0.92 + 0.08 * burst + kick * 0.08).toFixed(3)})`,
          fontFamily: FONT_DISPLAY,
          fontWeight: 700,
          fontSize: 74,
          lineHeight: 1.05,
          color: C.goldBright,
          letterSpacing: 2,
        }}
      >
        ONE
        <br />
        COMMAND
      </div>

      <div
        style={{
          position: 'absolute',
          top: 1160,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          opacity: line,
        }}
      >
        <div
          style={{
            border: `2px solid ${C.gold}`,
            padding: '22px 34px',
            background: 'rgba(10,8,6,0.8)',
            fontFamily: FONT_MONO,
            fontSize: 34,
            color: C.cut,
            transform: `translateY(${((1 - line) * 24).toFixed(1)}px)`,
          }}
        >
          <span style={{ color: C.gold }}>$ </span>
          {COMMAND}
          <span style={{ color: C.goldBright, opacity: Math.floor(t * 3) % 2 ? 0.15 : 1 }}>▌</span>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 1300,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          opacity: tag,
        }}
      >
        <Label size={26} track={9} color={C.cutDim}>
          researched · fact-checked · cited
        </Label>
      </div>
    </AbsoluteFill>
  );
};
