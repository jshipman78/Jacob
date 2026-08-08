/**
 * 3 — "It researches live. If it can't reach the web, it refuses to write."
 *
 * Two beats in one scene, because the line has two halves. First the globe
 * lit up and the tool-call counter climbing — the transport counts real
 * network calls. Then the connection is cut, the counter drops to zero, and
 * the build stamps itself HALTED rather than writing from memory.
 */

import React from 'react';
import { AbsoluteFill } from 'remotion';
import { C, FONT_MONO, FONT_UI } from '../theme';
import { useT, ramp, strike, easeOutCubic, easeOutExpo, Label } from '../kit';

const CX = 540;
const CY = 700;
const R = 290;

/** Where the search lands. Fixed, so the scene is identical every render. */
const NODES: { x: number; y: number; label: string }[] = [
  { x: 190, y: 430, label: 'JSTOR' },
  { x: 880, y: 400, label: 'BRITISH MUSEUM' },
  { x: 150, y: 940, label: 'PERSEUS' },
  { x: 905, y: 900, label: 'LIVIUS' },
  { x: 540, y: 300, label: 'ARCHIVE' },
  { x: 540, y: 1080, label: 'JSTOR' },
];

const CUT_AT = 2.45; // local seconds — the moment the network goes away

export const Research: React.FC = () => {
  const t = useT();

  const build = easeOutCubic(ramp(t, 0, 0.6));
  const live = t < CUT_AT;
  const cutP = ramp(t, CUT_AT, CUT_AT + 0.25);
  const cutKick = strike(t, CUT_AT, 10);

  // Tool calls climb while the network is up, and are worth nothing after.
  const calls = live ? Math.floor(ramp(t, 0.35, CUT_AT) * 41) : 0;

  const stampAt = CUT_AT + 0.55;
  const stamp = easeOutExpo(ramp(t, stampAt, stampAt + 0.22));
  const stampKick = strike(t, stampAt, 12);

  const shake = (cutKick * 14 + stampKick * 10) * (Math.sin(t * 90) > 0 ? 1 : -1);

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `translate(${shake.toFixed(2)}px, 0)` }}>
        <svg viewBox="0 0 1080 1920" width="100%" height="100%">
          <g opacity={build * (1 - cutP * 0.55)}>
            {/* the sphere */}
            <circle cx={CX} cy={CY} r={R} fill="none" stroke={C.cut} strokeWidth={3} />
            <circle cx={CX} cy={CY} r={R} fill="rgba(217,184,114,0.035)" stroke="none" />

            {/* latitudes */}
            {[-0.72, -0.4, 0, 0.4, 0.72].map((k, i) => (
              <ellipse
                key={i}
                cx={CX}
                cy={CY + k * R}
                rx={R * Math.sqrt(Math.max(0.02, 1 - k * k))}
                ry={R * 0.13 * Math.sqrt(Math.max(0.02, 1 - k * k))}
                fill="none"
                stroke={C.cutDim}
                strokeWidth={1.6}
                opacity={0.75}
              />
            ))}

            {/* longitudes — the sphere turns */}
            {[0, 1, 2, 3, 4, 5].map((k) => {
              const phase = (t * 0.16 + k / 6) % 1;
              const rx = Math.abs(Math.cos(phase * Math.PI * 2)) * R;
              return (
                <ellipse
                  key={k}
                  cx={CX}
                  cy={CY}
                  rx={Math.max(1, rx)}
                  ry={R}
                  fill="none"
                  stroke={C.cutDim}
                  strokeWidth={1.6}
                  opacity={0.28 + 0.5 * (rx / R)}
                />
              );
            })}
          </g>

          {/* --- rays out to the sources ------------------------------------ */}
          {NODES.map((n, i) => {
            const at = 0.45 + i * 0.11;
            const p = ramp(t, at, at + 0.35) * (1 - cutP);
            if (p <= 0) return null;
            const travel = ((t * 1.6 + i * 0.31) % 1);
            const mx = (CX + n.x) / 2 + (n.y - CY) * 0.16;
            const my = (CY + n.y) / 2 - (n.x - CX) * 0.16;
            const d = `M ${CX} ${CY} Q ${mx} ${my} ${n.x} ${n.y}`;
            const len = Math.hypot(n.x - CX, n.y - CY) * 1.12;
            return (
              <g key={i} opacity={p}>
                <path d={d} fill="none" stroke={C.gold} strokeWidth={1.6} opacity={0.3} />
                {/* the packet, running out along the ray */}
                <path
                  d={d}
                  fill="none"
                  stroke={C.goldBright}
                  strokeWidth={3.4}
                  strokeLinecap="round"
                  strokeDasharray={`46 ${len}`}
                  strokeDashoffset={len * (1 - travel)}
                />
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={9 + 5 * Math.abs(Math.sin(t * 4 + i))}
                  fill="none"
                  stroke={C.goldBright}
                  strokeWidth={2.4}
                />
              </g>
            );
          })}

          {/* --- the cut ----------------------------------------------------- */}
          {cutP > 0 ? (
            <g opacity={cutP}>
              <line
                x1={CX - R * 0.95}
                y1={CY - R * 0.95}
                x2={CX - R * 0.95 + R * 1.9 * cutP}
                y2={CY - R * 0.95 + R * 1.9 * cutP}
                stroke={C.red}
                strokeWidth={10}
                strokeLinecap="round"
              />
              <line
                x1={CX + R * 0.95}
                y1={CY - R * 0.95}
                x2={CX + R * 0.95 - R * 1.9 * cutP}
                y2={CY - R * 0.95 + R * 1.9 * cutP}
                stroke={C.red}
                strokeWidth={10}
                strokeLinecap="round"
              />
              <circle
                cx={CX}
                cy={CY}
                r={R + 30 + cutKick * 60}
                fill="none"
                stroke={C.red}
                strokeWidth={3}
                opacity={cutKick * 0.9}
              />
            </g>
          ) : null}
        </svg>
      </AbsoluteFill>

      {/* --- the counter ---------------------------------------------------- */}
      <div
        style={{
          position: 'absolute',
          top: 240,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: build,
        }}
      >
        <Label size={22} track={10} color={live ? C.cutDim : C.red} style={{ textAlign: 'center' }}>
          live tool calls this stage
        </Label>
        <div
          style={{
            marginTop: 10,
            fontFamily: FONT_MONO,
            fontWeight: 700,
            fontSize: 92,
            color: live ? C.goldBright : C.red,
            letterSpacing: 4,
            transform: `scale(${(1 + cutKick * 0.2).toFixed(3)})`,
          }}
        >
          {String(calls).padStart(2, '0')}
        </div>
      </div>

      {/* --- the refusal ----------------------------------------------------- */}
      {stamp > 0 ? (
        <div
          style={{
            position: 'absolute',
            top: 1080,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'center',
            opacity: stamp,
            transform: `scale(${(1.35 - 0.35 * stamp + stampKick * 0.12).toFixed(3)}) rotate(-4deg)`,
          }}
        >
          <div
            style={{
              border: `7px solid ${C.red}`,
              padding: '18px 40px',
              color: C.red,
              fontFamily: FONT_UI,
              fontWeight: 900,
              fontSize: 66,
              letterSpacing: 4,
              textTransform: 'uppercase',
              background: 'rgba(10,8,6,0.72)',
              boxShadow: `0 0 ${50 * stampKick + 10}px rgba(194,64,47,0.45)`,
            }}
          >
            build halted
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
