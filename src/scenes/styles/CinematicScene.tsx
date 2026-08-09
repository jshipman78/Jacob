import React, { useId, useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import type { SceneProps } from '../types';
import {
  rngFor, makeFbm1D, lerp, clamp01, clamp,
  ramp, stagger, easeInOutCubic, easeOutCubic, easeOutQuint, rakingLight,
} from '../engraving';

/**
 * CinematicScene — comparison style: LAYERED PARALLAX AND VOLUMETRIC LIGHT.
 *
 * No line work at all. Everything is mass and atmosphere: eight or nine
 * silhouette planes stacked into depth, each one lighter and hazier than the
 * one in front of it, with shafts of light raking through airborne dust and a
 * real camera move — a dolly with perspective divergence between the planes,
 * rather than a scale on a flat image.
 *
 * This is the style that reads as photographed rather than drawn. It buys
 * enormous atmosphere and depth, and it gives up the ability to *label*
 * anything: there is no natural place in it for a leader line or a numeral, so
 * the explanatory beats have to carry their meaning through composition alone.
 *
 * Built for the comparison reel only — it covers the three shots in the
 * one-minute window, not the whole film.
 *
 * options: subject: 'field' | 'trench' | 'strata'
 */

const W = 1920;
const H = 1080;

type Subject = 'field' | 'trench' | 'strata';
type Options = { subject?: Subject };

/** A depth plane: a silhouette ridge at a given distance. */
type Plane = {
  d: string;
  depth: number;      // 0 = far, 1 = near
  tone: string;
  haze: number;
};

export const CinematicScene: React.FC<SceneProps> = ({
  progress, frame, fps, seed, options,
}) => {
  // Unique per mounted instance: during a crossfade two scenes share the
  // document, and a seed-derived id can collide (see ExcavatorRelay).
  const uid = useId().replace(/:/g, '');
  const subject = ((options ?? {}) as Options).subject ?? 'field';

  const geo = useMemo(() => {
    const rand = rngFor(seed, `cine-${subject}`);
    const fbm = makeFbm1D(seed, `cinef-${subject}`);

    const ridge = (
      baseY: number, amp: number, freq: number, phase: number, depth: number
    ): string => {
      let d = `M -400 ${H + 200}`;
      for (let i = 0; i <= 90; i++) {
        const u = i / 90;
        const x = -400 + u * (W + 800);
        const y =
          baseY -
          Math.exp(-Math.pow((u - 0.42 - phase * 0.2) / 0.36, 2)) * amp -
          fbm(u * freq + phase * 10) * amp * 0.32;
        d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      return d + ` L ${W + 400} ${H + 200} Z`;
    };

    const planes: Plane[] = [];
    if (subject === 'field') {
      // Nine ridges receding into haze — the plain of Troy at last light.
      for (let i = 0; i < 9; i++) {
        const depth = i / 8;
        planes.push({
          d: ridge(
            lerp(430, 1010, Math.pow(depth, 1.35)),
            lerp(60, 300, depth),
            lerp(2.4, 6.5, depth),
            i * 0.37,
            depth
          ),
          depth,
          // Nearer planes are darker; distant ones dissolve into the sky.
          tone: `hsl(${lerp(28, 18, depth)}, ${lerp(22, 40, depth).toFixed(0)}%, ${lerp(26, 4, depth).toFixed(0)}%)`,
          haze: 1 - depth,
        });
      }
    } else if (subject === 'trench') {
      // Looking down into the cut: walls converging, the floor far below.
      for (let i = 0; i < 7; i++) {
        const depth = i / 6;
        const inset = lerp(80, 520, depth);
        let d = `M ${-200} ${H + 200} L ${-200} ${lerp(180, 420, depth)}`;
        d += ` L ${inset} ${lerp(300, 560, depth)}`;
        d += ` L ${inset + 40} ${lerp(900, 700, depth)}`;
        d += ` L ${W - inset - 40} ${lerp(900, 700, depth)}`;
        d += ` L ${W - inset} ${lerp(300, 560, depth)}`;
        d += ` L ${W + 200} ${lerp(180, 420, depth)} L ${W + 200} ${H + 200} Z`;
        planes.push({
          d, depth,
          tone: `hsl(${lerp(24, 16, depth)}, ${lerp(26, 34, depth).toFixed(0)}%, ${lerp(22, 3, depth).toFixed(0)}%)`,
          haze: 1 - depth,
        });
      }
    } else {
      // A wall of stratified earth, receding along its own length.
      for (let i = 0; i < 10; i++) {
        const depth = i / 9;
        const y = lerp(150, 860, i / 9);
        let d = `M -300 ${y}`;
        for (let k = 0; k <= 50; k++) {
          const u = k / 50;
          d += ` L ${(-300 + u * (W + 600)).toFixed(1)} ${(y + fbm(u * 5 + i * 9) * 14).toFixed(1)}`;
        }
        d += ` L ${W + 300} ${H + 200} L -300 ${H + 200} Z`;
        planes.push({
          d, depth: 1 - depth,
          tone: `hsl(${lerp(34, 16, depth)}, ${lerp(30, 18, depth).toFixed(0)}%, ${lerp(20, 7, depth).toFixed(0)}%)`,
          haze: depth,
        });
      }
    }

    // Airborne particulate — the thing that makes light shafts visible.
    const dust = Array.from({ length: 340 }, () => ({
      x: rand() * (W + 400) - 200,
      y: rand() * H,
      r: lerp(0.8, 4.2, rand() * rand()),
      depth: rand(),
      speed: 0.006 + rand() * 0.03,
      drift: (rand() - 0.5) * 200,
      phase: rand(),
    }));

    // Light shafts: broad wedges from a single high source.
    const shafts = Array.from({ length: 6 }, (_, i) => ({
      angle: -66 + i * 5.5 + rand() * 3,
      width: 60 + rand() * 130,
      o: 0.05 + rand() * 0.09,
      phase: rand(),
    }));

    return { planes, dust, shafts };
  }, [seed, subject]);

  const p = clamp01(progress);
  const t = frame / fps;

  /**
   * The camera. A real dolly: the planes diverge because each is offset by an
   * amount proportional to its depth, which is parallax rather than a scale
   * applied to a flat picture. Eased at both ends so it starts and stops like
   * a camera on a head, not like a linear tween.
   */
  const dolly = easeInOutCubic(ramp(p, 0.0, 1.0));
  const boom = easeInOutCubic(ramp(p, 0.15, 0.9));
  const push = 1 + dolly * 0.14;

  const srcX = 0.66;
  const srcY = 0.06;
  const sweep = rakingLight(frame, fps, 34, seed);

  return (
    <AbsoluteFill style={{ backgroundColor: '#07070a', overflow: 'hidden' }}>
      {/* Sky: the deepest plane, and the source of everything else's light. */}
      <AbsoluteFill
        style={{
          background:
            `radial-gradient(ellipse 90% 70% at ${(srcX * 100).toFixed(0)}% ${(srcY * 100).toFixed(0)}%, #6b4a24 0%, #2c1f16 34%, #100c10 68%, #06060a 100%)`,
        }}
      />

      {/* Depth planes, back to front. */}
      {geo.planes
        .slice()
        .sort((a, b) => a.depth - b.depth)
        .map((pl, i) => {
          // Parallax: near planes move far more than distant ones.
          const par = Math.pow(pl.depth, 1.2);
          const dx = lerp(6, 96, par) * (dolly - 0.5) * 2;
          const dy = lerp(2, 34, par) * (boom - 0.5) * 2;
          const sc = 1 + (push - 1) * lerp(0.15, 1.25, par);
          return (
            <AbsoluteFill
              key={i}
              style={{
                transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px) scale(${sc.toFixed(4)})`,
                transformOrigin: '50% 70%',
              }}
            >
              <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute' }}>
                <path d={pl.d} fill={pl.tone} />
              </svg>
              {/* Aerial perspective: distant planes are veiled by the air
                  between them and the camera. */}
              <AbsoluteFill
                style={{
                  background: `linear-gradient(180deg, rgba(120,88,52,${(pl.haze * 0.30).toFixed(3)}) 0%, rgba(60,44,30,${(pl.haze * 0.10).toFixed(3)}) 50%, rgba(0,0,0,0) 100%)`,
                  mixBlendMode: 'screen',
                  clipPath: `path('${pl.d}')`,
                }}
              />
            </AbsoluteFill>
          );
        })}

      {/* Volumetric shafts. */}
      <AbsoluteFill style={{ mixBlendMode: 'screen', pointerEvents: 'none' }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute' }}>
          <defs>
            <linearGradient id={`shaft-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffd9a0" stopOpacity="0.85" />
              <stop offset="55%" stopColor="#e0a860" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#c08040" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g transform={`translate(${srcX * W}, ${srcY * H})`}>
            {geo.shafts.map((s, i) => {
              const breathe = 0.7 + 0.3 * Math.sin(t * 0.22 + s.phase * 6.28);
              const ang = s.angle + Math.sin(t * 0.09 + i) * 1.6 + (sweep - 0.5) * 5;
              return (
                <g key={i} transform={`rotate(${ang.toFixed(2)})`}>
                  <path
                    d={`M ${-s.width * 0.14} 0 L ${s.width * 0.14} 0 L ${s.width} 1500 L ${-s.width} 1500 Z`}
                    fill={`url(#shaft-${uid})`}
                    opacity={s.o * breathe * (0.4 + 0.6 * ramp(p, 0.0, 0.3))}
                  />
                </g>
              );
            })}
          </g>
        </svg>
      </AbsoluteFill>

      {/* Dust in the shafts. Nearer motes are bigger, faster and more defocused. */}
      <AbsoluteFill style={{ mixBlendMode: 'screen', pointerEvents: 'none' }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute' }}>
          {geo.dust.map((m, i) => {
            const u = ((t * m.speed + m.phase) % 1);
            const fade = Math.sin(u * Math.PI);
            const par = Math.pow(m.depth, 1.3);
            const x = m.x + m.drift * (u - 0.5) + lerp(6, 96, par) * (dolly - 0.5) * 2;
            const y = m.y - u * 220;
            // Brighter where a shaft would be crossing.
            const inShaft = clamp01(1 - Math.abs((x / W) - lerp(0.34, 0.86, sweep)) * 3.4);
            const o = fade * (0.10 + inShaft * 0.55) * lerp(0.4, 1, m.depth);
            if (o <= 0.015) return null;
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={m.r * lerp(0.6, 1.9, par)}
                fill="#ffe0b0"
                opacity={o}
              />
            );
          })}
        </svg>
      </AbsoluteFill>

      {/* Grade: warm highlight, cool shadow, and a soft bloom around the source. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${(srcX * 100).toFixed(0)}% ${(srcY * 100).toFixed(0)}%, rgba(255,206,140,0.32) 0%, rgba(255,180,100,0.08) 26%, rgba(0,0,0,0) 58%)`,
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />
      <AbsoluteFill
        style={{
          background: 'linear-gradient(180deg, rgba(20,28,48,0.30) 0%, rgba(0,0,0,0) 34%, rgba(0,0,0,0) 56%, rgba(4,4,8,0.72) 100%)',
          pointerEvents: 'none',
        }}
      />
      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse at 50% 48%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.62) 100%)',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};
