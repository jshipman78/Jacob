/**
 * 1 — "I built a machine that makes documentaries."
 *
 * The literal reading, drawn as a press: topics drop into the hopper, three
 * meshing gears turn, film comes out the bottom. Everything on screen is a
 * stroke on the block, and the only things that move per frame are rotations
 * and translations.
 */

import React from 'react';
import { AbsoluteFill } from 'remotion';
import { C, FONT_DISPLAY, FONT_UI } from '../theme';
import { useT, ramp, band, springy, strike, easeOutCubic, Draw, Hatch, Label } from '../kit';

/** A square-toothed gear outline, drawn as one closed path. */
function gearPath(cx: number, cy: number, r: number, teeth: number, th: number) {
  const n = teeth * 4;
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = i % 4 < 2 ? r + th : r;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `M ${pts.join(' L ')} Z`;
}

const Gear: React.FC<{
  cx: number;
  cy: number;
  r: number;
  teeth: number;
  rot: number;
  p: number;
  stroke?: string;
  width?: number;
}> = ({ cx, cy, r, teeth, rot, p, stroke = C.cut, width = 3 }) => (
  <g transform={`rotate(${rot.toFixed(2)} ${cx} ${cy})`} opacity={p}>
    <Draw d={gearPath(cx, cy, r, teeth, r * 0.16)} p={p} len={r * 9} stroke={stroke} width={width} />
    <circle cx={cx} cy={cy} r={r * 0.62} fill="none" stroke={stroke} strokeWidth={1.4} opacity={0.55} />
    <circle cx={cx} cy={cy} r={r * 0.17} fill="none" stroke={stroke} strokeWidth={2.2} />
    {[0, 1, 2, 3, 4].map((i) => {
      const a = (i / 5) * Math.PI * 2;
      return (
        <line
          key={i}
          x1={cx + Math.cos(a) * r * 0.19}
          y1={cy + Math.sin(a) * r * 0.19}
          x2={cx + Math.cos(a) * r * 0.6}
          y2={cy + Math.sin(a) * r * 0.6}
          stroke={stroke}
          strokeWidth={2}
          opacity={0.7}
        />
      );
    })}
  </g>
);

const TOPICS = ['THE FALL OF CARTHAGE', 'THE DEATH OF POMPEII', 'APOLLO 1'];

export const Hook: React.FC = () => {
  const t = useT();

  const build = easeOutCubic(ramp(t, 0.05, 0.9));
  const spin = t * 46;
  const stampT = 0.5;
  const stamp = ramp(t, stampT, stampT + 0.18);
  const stampKick = strike(t, stampT, 13);
  const shake = stampKick * 9;

  // The film pays out of the press once the gears are up to speed.
  const filmOut = ramp(t, 1.5, 2.2);
  const filmScroll = (Math.max(0, t - 1.5) * 300) % 96;

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{ transform: `translateY(${(Math.sin(t * 3.1) * 3 - shake).toFixed(2)}px)` }}
      >
        <svg viewBox="0 0 1080 1920" width="100%" height="100%">
          {/* --- hopper: topics fall in ------------------------------------ */}
          <Draw d="M 320 560 L 760 560 L 655 690 L 425 690 Z" p={build} len={1300} width={3} />
          <Hatch x={320} y={560} w={440} h={130} pitch={16} angle={-40} p={build} opacity={0.16} seed={7} />

          {/* --- the press body -------------------------------------------- */}
          <Draw d="M 250 706 L 830 706 L 830 1180 L 250 1180 Z" p={build} len={2200} width={4} />
          <Draw d="M 274 730 L 806 730 L 806 1156 L 274 1156 Z" p={build} len={2000} width={1.4} opacity={0.5} />
          {[[292, 748], [788, 748], [292, 1138], [788, 1138]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={6} fill="none" stroke={C.gold} strokeWidth={2} opacity={build * 0.8} />
          ))}

          {/* --- the works -------------------------------------------------- */}
          <Gear cx={424} cy={880} r={116} teeth={14} rot={spin} p={build} />
          <Gear cx={648} cy={958} r={84} teeth={11} rot={-spin * 1.35 + 12} p={build} stroke={C.gold} />
          <Gear cx={444} cy={1084} r={64} teeth={9} rot={-spin * 1.7} p={build} width={2.4} />

          {/* piston: the beat you can see */}
          <g opacity={build}>
            <line
              x1={648}
              y1={748}
              x2={648}
              y2={800 + Math.sin(t * 6.2) * 30}
              stroke={C.cut}
              strokeWidth={7}
              strokeLinecap="round"
            />
            <rect
              x={614}
              y={794 + Math.sin(t * 6.2) * 30}
              width={68}
              height={20}
              fill="none"
              stroke={C.cut}
              strokeWidth={3}
            />
          </g>

          {/* --- film paying out -------------------------------------------- */}
          <g opacity={filmOut} clipPath="url(#filmclip)">
            <defs>
              <clipPath id="filmclip">
                <rect x={452} y={1180} width={176} height={170 * filmOut} />
              </clipPath>
            </defs>
            <g transform={`translate(0 ${filmScroll})`}>
              {[-1, 0, 1, 2].map((i) => (
                <g key={i} transform={`translate(0 ${i * 96})`}>
                  <rect x={452} y={1180} width={176} height={96} fill="none" stroke={C.cut} strokeWidth={2.5} />
                  <rect x={478} y={1196} width={124} height={64} fill="rgba(217,184,114,0.07)" stroke={C.cutDim} strokeWidth={1.4} />
                  {[0, 1].map((j) => (
                    <React.Fragment key={j}>
                      <rect x={458 + j * 152} y={1196} width={12} height={12} fill={C.cutFaint} />
                      <rect x={458 + j * 152} y={1246} width={12} height={12} fill={C.cutFaint} />
                    </React.Fragment>
                  ))}
                </g>
              ))}
            </g>
          </g>

          {/* --- exhaust rings: the machine is running ---------------------- */}
          {[0, 1, 2].map((i) => {
            const phase = ((t * 0.75 + i / 3) % 1);
            return (
              <ellipse
                key={i}
                cx={868}
                cy={720 - phase * 150}
                rx={16 + phase * 40}
                ry={6 + phase * 13}
                fill="none"
                stroke={C.cutDim}
                strokeWidth={2}
                opacity={build * (1 - phase) * 0.5}
              />
            );
          })}
        </svg>
      </AbsoluteFill>

      {/* --- topics dropping into the hopper ------------------------------- */}
      {TOPICS.map((topic, i) => {
        const at = 0.95 + i * 0.42;
        const p = ramp(t, at, at + 0.5);
        if (p <= 0 || p >= 1) return null;
        return (
          <div
            key={topic}
            style={{
              position: 'absolute',
              top: 400 + p * 190,
              left: 0,
              right: 0,
              textAlign: 'center',
              opacity: Math.min(1, (1 - p) * 2.4) * Math.min(1, p * 6),
              transform: `scale(${(1 - p * 0.42).toFixed(3)})`,
              fontFamily: FONT_UI,
              fontWeight: 700,
              fontSize: 34,
              letterSpacing: 4,
              color: C.gold,
            }}
          >
            {topic}
          </div>
        );
      })}

      {/* --- the stamp ------------------------------------------------------ */}
      <div
        style={{
          position: 'absolute',
          top: 150,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: stamp,
          transform: `scale(${(1 + stampKick * 0.22).toFixed(3)}) rotate(${(-1.4 + stampKick * 1.6).toFixed(2)}deg)`,
        }}
      >
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 92,
            lineHeight: 0.98,
            letterSpacing: 2,
            color: C.goldBright,
            textShadow: `0 0 ${40 * stampKick + 8}px rgba(217,184,114,0.5)`,
          }}
        >
          THE DOCUMENTARY
          <br />
          MACHINE
        </div>
        <div style={{ marginTop: 22, display: 'flex', justifyContent: 'center' }}>
          <Label size={24} track={9} color={C.cutDim}>
            <span style={{ opacity: band(t, 1.5, 1.9, 99, 99) }}>a repository, not a metaphor</span>
          </Label>
        </div>
      </div>
    </AbsoluteFill>
  );
};
