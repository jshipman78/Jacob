/**
 * 2 — "One topic in. A finished film out."
 *
 * The interface is one line of shell, so the scene is one line of shell: typed
 * live, then the stage ledger the pipeline actually prints, then the film
 * sliding out from under it.
 */

import React from 'react';
import { AbsoluteFill } from 'remotion';
import { C, FONT_MONO, FONT_UI } from '../theme';
import { useT, ramp, springy, strike, easeOutCubic, Label } from '../kit';

const COMMAND = 'npm run make-video -- "the fall of Carthage"';
const TYPE_START = 0.15;
const TYPE_RATE = 34; // characters per second

const STAGES: { name: string; note: string; at: number }[] = [
  { name: 'research', note: '41 sources', at: 1.5 },
  { name: 'claims', note: '38 written', at: 1.78 },
  { name: 'fact-check', note: '6 cut', at: 2.06 },
  { name: 'narrate', note: '14:02', at: 2.34 },
  { name: 'render', note: '25,236 frames', at: 2.62 },
];

export const Command: React.FC = () => {
  const t = useT();

  const panel = easeOutCubic(ramp(t, 0, 0.35));
  const typed = Math.max(0, Math.floor((t - TYPE_START) * TYPE_RATE));
  const shown = COMMAND.slice(0, typed);
  const typing = typed < COMMAND.length;
  const enterAt = TYPE_START + COMMAND.length / TYPE_RATE + 0.12;
  const submitted = t >= enterAt;
  const flash = strike(t, enterAt, 8);

  const filmOut = ramp(t, 2.55, 3.3);
  const filmScroll = (Math.max(0, t - 2.55) * 260) % 150;

  return (
    <AbsoluteFill>
      {/* --- the terminal --------------------------------------------------- */}
      <div
        style={{
          position: 'absolute',
          top: 430,
          left: 70,
          width: 940,
          opacity: panel,
          transform: `translateY(${((1 - panel) * 40).toFixed(1)}px)`,
          border: `2px solid ${C.cutFaint}`,
          background: `linear-gradient(180deg, rgba(32,22,13,0.96), rgba(10,8,6,0.96))`,
          boxShadow: `0 0 ${60 + flash * 90}px rgba(217,184,114,${(0.06 + flash * 0.35).toFixed(3)})`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '18px 24px',
            borderBottom: `1px solid ${C.cutFaint}`,
          }}
        >
          {[C.red, C.gold, C.green].map((c) => (
            <div key={c} style={{ width: 14, height: 14, borderRadius: 7, background: c, opacity: 0.7 }} />
          ))}
          <div style={{ flex: 1 }} />
          <Label size={18} track={4} color={C.cutFaint}>
            zsh — documentary pipeline
          </Label>
        </div>

        {/* Fixed height: the panel must not grow as the stage ledger fills,
            or the whole scene jitters upward line by line. */}
        <div
          style={{
            padding: '34px 30px 40px',
            minHeight: 520,
            boxSizing: 'border-box',
            fontFamily: FONT_MONO,
            fontSize: 34,
            lineHeight: 1.65,
          }}
        >
          <div style={{ color: C.cut, wordBreak: 'break-word' }}>
            <span style={{ color: C.gold }}>$ </span>
            {shown}
            <span
              style={{
                display: 'inline-block',
                width: 18,
                height: 34,
                marginLeft: 3,
                verticalAlign: '-6px',
                background: C.goldBright,
                opacity: typing || Math.floor(t * 3) % 2 === 0 ? 1 : 0,
              }}
            />
          </div>

          {STAGES.map((s) => {
            const p = ramp(t, s.at, s.at + 0.2);
            if (p <= 0) return null;
            const pop = springy(t - s.at, 14, 22);
            return (
              <div
                key={s.name}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  marginTop: 10,
                  opacity: p,
                  transform: `translateX(${((1 - pop) * 26).toFixed(1)}px)`,
                }}
              >
                <span style={{ color: C.green, width: 42 }}>✓</span>
                <span style={{ color: C.cut, width: 300 }}>{s.name}</span>
                <span style={{ flex: 1, color: C.cutFaint, letterSpacing: 6, overflow: 'hidden' }}>
                  ································
                </span>
                <span style={{ color: C.goldBright }}>{s.note}</span>
              </div>
            );
          })}

          {submitted ? null : (
            <div style={{ marginTop: 22, color: C.cutFaint, fontSize: 26 }}>&nbsp;</div>
          )}
        </div>
      </div>

      {/* --- the film sliding out from under it ----------------------------- */}
      <svg
        viewBox="0 0 1080 1920"
        width="100%"
        height="100%"
        style={{ position: 'absolute', inset: 0, opacity: filmOut }}
      >
        <clipPath id="cmd-film">
          <rect x={70} y={1120} width={940} height={170} />
        </clipPath>
        <g clipPath="url(#cmd-film)">
          <g transform={`translate(${-filmScroll} 0)`}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <g key={i} transform={`translate(${i * 150} 0)`}>
                <rect x={70} y={1120} width={150} height={170} fill="none" stroke={C.cut} strokeWidth={2.5} />
                <rect x={88} y={1150} width={114} height={110} fill="rgba(217,184,114,0.07)" stroke={C.cutDim} strokeWidth={1.4} />
                {[0, 1, 2].map((j) => (
                  <React.Fragment key={j}>
                    <rect x={92 + j * 40} y={1128} width={16} height={12} fill={C.cutFaint} />
                    <rect x={92 + j * 40} y={1270} width={16} height={12} fill={C.cutFaint} />
                  </React.Fragment>
                ))}
              </g>
            ))}
          </g>
        </g>
      </svg>

      <div
        style={{
          position: 'absolute',
          top: 1310,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: ramp(t, 2.9, 3.2),
          fontFamily: FONT_UI,
          fontSize: 26,
          letterSpacing: 8,
          color: C.gold,
          textTransform: 'uppercase',
        }}
      >
        out/carthage.mp4 · citations.md
      </div>
    </AbsoluteFill>
  );
};
