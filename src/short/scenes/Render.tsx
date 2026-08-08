/**
 * 6 — "Then it narrates, animates, and renders itself."
 *
 * Three lanes, lit in the order the words arrive: the synthesized narration
 * and its measured waveform, the procedural scene layer drawing itself, and
 * the frame counter. The numbers are the real shape of a fourteen-minute
 * render at 30fps.
 */

import React from 'react';
import { AbsoluteFill } from 'remotion';
import { C, FONT_MONO, FONT_UI } from '../theme';
import { useT, ramp, springy, easeOutCubic, Label } from '../kit';
import { rngFor } from '../../scenes/engraving/rand';

const TOTAL_FRAMES = 25236;

/** A fixed waveform envelope — same every render, like a real measured one. */
const WAVE = (() => {
  const rand = rngFor(0.577, 'short-wave');
  return Array.from({ length: 58 }, (_, i) => {
    const speech = 0.45 + 0.55 * Math.abs(Math.sin(i * 0.55));
    return Math.max(0.08, speech * (0.5 + rand() * 0.7));
  });
})();

const Lane: React.FC<{
  y: number;
  at: number;
  title: string;
  meta: string;
  t: number;
  children: React.ReactNode;
}> = ({ y, at, title, meta, t, children }) => {
  const p = ramp(t, at, at + 0.3);
  const pop = springy(t - at, 13, 18);
  const lit = ramp(t, at, at + 0.5);
  return (
    <div
      style={{
        position: 'absolute',
        top: y,
        left: 90,
        width: 900,
        height: 290,
        boxSizing: 'border-box',
        padding: '24px 30px',
        border: `2px solid ${lit > 0.5 ? C.gold : C.cutFaint}`,
        background: 'linear-gradient(180deg, rgba(32,22,13,0.86), rgba(10,8,6,0.86))',
        opacity: p,
        transform: `translateY(${((1 - pop) * 40).toFixed(1)}px)`,
        boxShadow: `0 0 ${44 * lit}px rgba(217,184,114,${(0.16 * lit).toFixed(3)})`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Label size={26} track={8} color={C.goldBright} weight={800}>
          {title}
        </Label>
        <span style={{ fontFamily: FONT_MONO, fontSize: 22, color: C.cutDim }}>{meta}</span>
      </div>
      {children}
    </div>
  );
};

export const Render: React.FC = () => {
  const t = useT();

  const playhead = ramp(t, 0.35, 1.5);
  const drawP = easeOutCubic(ramp(t, 1.25, 2.35));
  const renderP = ramp(t, 2.0, 3.5);
  const frames = Math.floor(renderP * TOTAL_FRAMES);

  return (
    <AbsoluteFill>
      <Lane y={330} at={0.15} title="narrate" meta="kokoro · voice1" t={t}>
        <div style={{ display: 'flex', alignItems: 'center', height: 170, gap: 4, marginTop: 14 }}>
          {WAVE.map((a, i) => {
            const passed = i / WAVE.length <= playhead;
            const wobble = passed ? 1 + 0.14 * Math.sin(t * 12 + i) : 1;
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${(a * 100 * wobble).toFixed(1)}%`,
                  background: passed ? C.goldBright : C.cutFaint,
                  opacity: passed ? 0.95 : 0.5,
                }}
              />
            );
          })}
        </div>
      </Lane>

      <Lane y={660} at={1.05} title="animate" meta="archival · procedural" t={t}>
        <svg width={840} height={180} style={{ marginTop: 16 }}>
          {/* strata building upward — the scene layer drawing itself */}
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const p = Math.max(0, Math.min(1, (drawP - i * 0.1) * 3));
            const h = 26;
            return (
              <g key={i}>
                <rect
                  x={20}
                  y={150 - i * h}
                  width={(500 - i * 26) * p}
                  height={h - 5}
                  fill="none"
                  stroke={i === 3 ? C.ember : C.cut}
                  strokeWidth={2}
                />
                <line
                  x1={540}
                  y1={150 - i * h + 10}
                  x2={540 + 240 * p}
                  y2={150 - i * h + 10}
                  stroke={C.cutFaint}
                  strokeWidth={1.4}
                  strokeDasharray="6 8"
                />
              </g>
            );
          })}
          {/* the trench cut down through them */}
          <path
            d="M 300 8 L 300 152 L 420 152 L 420 8"
            fill="none"
            stroke={C.gold}
            strokeWidth={3}
            strokeDasharray={420}
            strokeDashoffset={420 * (1 - drawP)}
          />
        </svg>
      </Lane>

      <Lane y={990} at={1.85} title="render" meta="1080×1920 · 30fps" t={t}>
        <div
          style={{
            marginTop: 34,
            height: 46,
            border: `2px solid ${C.cutFaint}`,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 2,
              width: `calc(${(renderP * 100).toFixed(1)}% - 4px)`,
              background: `repeating-linear-gradient(90deg, ${C.gold} 0 14px, ${C.goldBright} 14px 28px)`,
              opacity: 0.9,
            }}
          />
        </div>
        <div
          style={{
            marginTop: 26,
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: FONT_MONO,
            fontSize: 40,
            color: C.goldBright,
          }}
        >
          <span>{frames.toLocaleString('en-US')} / {TOTAL_FRAMES.toLocaleString('en-US')}</span>
          <span style={{ color: C.cutDim, fontFamily: FONT_UI, fontSize: 34 }}>
            {Math.round(renderP * 100)}%
          </span>
        </div>
      </Lane>
    </AbsoluteFill>
  );
};
