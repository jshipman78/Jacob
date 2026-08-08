import React from 'react';
import type { Stroke } from './ink';
import { drawOn, hatchReveal } from './ink';
import { clamp01 } from './rand';
import { PLATE } from './Plate';

/**
 * Reusable drawn marks. These are the pieces every engraved scene assembles
 * from, so that thirty different compositions read as one hand.
 */

// ---------------------------------------------------------------------------

export const InkPath: React.FC<{
  d: string;
  len: number;
  /** 0..1 draw-on. */
  t?: number;
  color?: string;
  width?: number;
  opacity?: number;
  fill?: string;
  linecap?: 'butt' | 'round';
}> = ({ d, len, t = 1, color = PLATE.cut, width = 1.1, opacity = 1, fill = 'none', linecap = 'round' }) => {
  if (t <= 0 || !d) return null;
  const dash = t >= 1 ? {} : drawOn(len, t);
  return (
    <path
      d={d}
      fill={fill}
      stroke={color}
      strokeWidth={width}
      strokeLinecap={linecap}
      strokeLinejoin="round"
      opacity={opacity}
      {...dash}
    />
  );
};

/**
 * A whole hatch field, revealed in passes.
 *
 * `t` is the field's overall progress; each stroke works out its own local
 * reveal from `hatchReveal`, so the field lays down in bursts with holds
 * between rather than as a uniform wipe.
 */
export const HatchField: React.FC<{
  strokes: Stroke[];
  t?: number;
  color?: string;
  /** Multiplier on each stroke's suggested width. */
  weight?: number;
  /** Multiplier on each stroke's suggested opacity. */
  alpha?: number;
  passes?: number;
  /** Extra per-stroke opacity modulation, e.g. for a light sweep. */
  modulate?: (stroke: Stroke) => number;
}> = ({ strokes, t = 1, color = PLATE.cut, weight = 1, alpha = 1, passes = 5, modulate }) => {
  return (
    <>
      {strokes.map((s, i) => {
        const local = t >= 1 ? 1 : hatchReveal(s, t, passes);
        if (local <= 0.001) return null;
        const m = modulate ? modulate(s) : 1;
        const o = clamp01(s.o * alpha * m);
        if (o <= 0.004) return null;
        const dash = local >= 1 ? {} : drawOn(s.len, local);
        return (
          <path
            key={i}
            d={s.d}
            fill="none"
            stroke={color}
            strokeWidth={s.w * weight}
            strokeLinecap="round"
            opacity={o}
            {...dash}
          />
        );
      })}
    </>
  );
};

/** A stipple field. Cheap; used for grain, distance and soil. */
export const StippleField: React.FC<{
  dots: { x: number; y: number; r: number; o: number; k: number }[];
  t?: number;
  color?: string;
  alpha?: number;
  modulate?: (d: { x: number; y: number; k: number }) => number;
}> = ({ dots, t = 1, color = PLATE.cut, alpha = 1, modulate }) => {
  return (
    <>
      {dots.map((d, i) => {
        // Dots arrive scattered through the reveal, not in reading order.
        const own = ((i * 2654435761) % 1000) / 1000;
        const local = clamp01((clamp01(t) - own * 0.7) / 0.3);
        if (local <= 0.02) return null;
        const m = modulate ? modulate(d) : 1;
        const o = clamp01(d.o * alpha * m * local);
        if (o <= 0.004) return null;
        return <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={color} opacity={o} />;
      })}
    </>
  );
};

// ---------------------------------------------------------------------------
// Type set in the engraved idiom
// ---------------------------------------------------------------------------

/**
 * A plate caption — the small-caps line an engraver's shop set beneath a
 * figure. Sits wherever it is placed; the caller keeps it clear of the
 * subtitle band.
 */
export const PlateCaption: React.FC<{
  x: number;
  y: number;
  title: string;
  sub?: string;
  t?: number;
  align?: 'left' | 'center' | 'right';
  width?: number;
  color?: string;
  scale?: number;
}> = ({ x, y, title, sub, t = 1, align = 'left', width = 520, color = PLATE.gold, scale = 1 }) => {
  const o = clamp01(t);
  if (o <= 0.005) return null;
  const ruleW = Math.min(width, 120 + 260 * o) * scale;
  const justify = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        display: 'flex',
        flexDirection: 'column',
        alignItems: justify,
        textAlign: align,
        opacity: o,
        // Overlapping action: the caption drifts the last few px into place
        // slightly after its rule has drawn.
        transform: `translateY(${((1 - o) * 7).toFixed(2)}px)`,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: ruleW,
          height: 1,
          background: `linear-gradient(90deg, ${align === 'right' ? 'transparent, ' : ''}${color}, ${align === 'left' ? 'transparent' : align === 'center' ? 'transparent' : color})`,
          opacity: 0.65,
          marginBottom: 10 * scale,
        }}
      />
      <div
        style={{
          fontFamily: "'Cinzel', serif",
          fontWeight: 600,
          fontSize: 25 * scale,
          letterSpacing: 4.2 * scale,
          color,
          textTransform: 'uppercase',
          lineHeight: 1.25,
          textShadow: '0 2px 14px rgba(0,0,0,0.8)',
        }}
      >
        {title}
      </div>
      {sub ? (
        <div
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 500,
            fontSize: 17 * scale,
            letterSpacing: 1.5 * scale,
            color: PLATE.cutDim,
            marginTop: 7 * scale,
            lineHeight: 1.4,
            textShadow: '0 2px 12px rgba(0,0,0,0.85)',
          }}
        >
          {sub}
        </div>
      ) : null}
    </div>
  );
};

/**
 * Marginalia: a small annotation with a leader line that draws itself out to
 * the thing it names. The label always trails its leader, which is what
 * overlapping action buys us.
 */
export const Marginalia: React.FC<{
  /** Where the leader starts (on the subject). */
  fromX: number;
  fromY: number;
  /** Where the label sits. */
  toX: number;
  toY: number;
  label: string;
  note?: string;
  t?: number;
  color?: string;
  anchor?: 'start' | 'end';
  fontSize?: number;
}> = ({ fromX, fromY, toX, toY, label, note, t = 1, color = PLATE.cut, anchor = 'start', fontSize = 19 }) => {
  const leaderT = clamp01(t / 0.55);
  // The label trails the leader — it does not appear until the line has
  // most of the way arrived.
  const labelT = clamp01((t - 0.45) / 0.4);
  if (leaderT <= 0.01) return null;

  const elbowX = anchor === 'start' ? toX - 18 : toX + 18;
  const px = fromX + (elbowX - fromX) * leaderT;
  const py = fromY + (toY - fromY) * leaderT;

  return (
    <>
      <line
        x1={fromX}
        y1={fromY}
        x2={px}
        y2={py}
        stroke={color}
        strokeWidth={0.9}
        opacity={0.42}
      />
      <circle cx={fromX} cy={fromY} r={2.1} fill={color} opacity={0.7 * leaderT} />
      {labelT > 0.01 ? (
        <g opacity={labelT} transform={`translate(${((1 - labelT) * (anchor === 'start' ? 8 : -8)).toFixed(2)}, 0)`}>
          <text
            x={toX}
            y={toY}
            textAnchor={anchor}
            fill={color}
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 600,
              fontSize,
              letterSpacing: 1.6,
            }}
          >
            {label}
          </text>
          {note ? (
            <text
              x={toX}
              y={toY + fontSize + 6}
              textAnchor={anchor}
              fill={PLATE.cutDim}
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 500,
                fontSize: fontSize * 0.78,
                letterSpacing: 0.9,
              }}
            >
              {note}
            </text>
          ) : null}
        </g>
      ) : null}
    </>
  );
};
