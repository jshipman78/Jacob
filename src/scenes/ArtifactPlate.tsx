import React, { useId, useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import type { SceneProps } from './types';
import {
  Plate, PLATE, HatchField, StippleField, InkPath, PlateCaption,
  hatch, crossHatch, stipple, contour, segment, wobblyEllipse, wobblyRect,
  rngFor, makeFbm1D, lerp, clamp01,
  onNs, rakingLight, ramp, stagger, settle, pulse,
  easeOutCubic, easeInOutCubic, easeOutQuint,
} from './engraving';

/**
 * ArtifactPlate — the gold, drawn the way the gold was actually published: as
 * a numbered figure on a museum plate, cross-hatched, with a scale bar and a
 * catalogue caption.
 *
 * The engraved convention for metal is specific and worth getting right: the
 * form is modelled in tight curved hatching that follows the surface, the
 * highlights are left completely uncut, and the reflections are hard-edged.
 * That is what makes a drawn object read as gold rather than as a yellow
 * shape — and here it also carries the story, because the plate's neat
 * catalogue authority is exactly the authority Schliemann was borrowing.
 *
 * options:
 *   artifact: 'diadem' | 'hoard'
 *   label?: string
 */

const W = 1920;
const H = 1080;
const CX = 960;
const CY = 400;

type Artifact = 'diadem' | 'hoard';
const ARTIFACTS: Artifact[] = ['diadem', 'hoard'];
type Options = { artifact?: Artifact; label?: string; sub?: string };

export const ArtifactPlate: React.FC<SceneProps> = ({
  progress, frame, fps, seed, options,
}) => {
  // Unique per mounted instance: during a crossfade two scenes share the
  // document, and a seed-derived id can collide (see ExcavatorRelay).
  const uid = useId().replace(/:/g, '');
  const opts = (options ?? {}) as Options;

  // Only two plates are drawn, and `resolveScene` is the boundary that keeps
  // anything else from reaching this component — a generated topic asking for
  // "scroll fragment" is degraded there, before a frame is rendered. Warn
  // rather than throw if one slips through anyway: a scene that throws takes
  // the whole render down at frame 14,402, which is how this file first failed.
  if (opts.artifact !== undefined && !ARTIFACTS.includes(opts.artifact)) {
    console.warn(
      `ArtifactPlate: unknown artifact "${opts.artifact}" — this scene draws only ` +
        `${ARTIFACTS.join(' | ')}. resolveScene should have degraded this request.`
    );
  }
  const artifact = ARTIFACTS.includes(opts.artifact as Artifact) ? (opts.artifact as Artifact) : 'diadem';
  const label = opts.label ?? 'GOLD DIADEM · TROY II';
  // No default. This line used to read "From the plates published by
  // H. Schliemann" for every film that used the scene — true of the Troy gold,
  // false and defamatory anywhere else. It appeared under a lost Greek epic and
  // under a Hittite tablet, putting a real archaeologist's name on finds he
  // never published. Provenance is per-shot or it is absent.
  const sub = opts.sub;

  const geo = useMemo(() => {
    const rand = rngFor(seed, 'artifact');
    const fbm = makeFbm1D(seed, 'artf');

    // --- the diadem: a band with pendant chains, as published -------------
    const bandTop: { x: number; y: number }[] = [];
    const bandBot: { x: number; y: number }[] = [];
    for (let i = 0; i <= 60; i++) {
      const u = i / 60;
      const x = CX - 400 + u * 800;
      const sag = Math.sin(u * Math.PI) * 44;
      bandTop.push({ x, y: CY - 90 + sag * 0.55 + fbm(u * 8) * 3 });
      bandBot.push({ x, y: CY - 42 + sag + fbm(u * 8 + 30) * 3 });
    }
    const bandT = contour(seed, 'bandT', bandTop, 1.2, 160);
    const bandB = contour(seed, 'bandB', bandBot, 1.2, 160);

    // The band has to read as a solid strip of beaten gold, not as two rules.
    // Filled with tight hatching running along its length, with the highlight
    // left uncut — the engraved convention for metal.
    const bandFill =
      `M ${bandTop.map((q) => `${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' L ')} ` +
      `L ${bandBot.slice().reverse().map((q) => `${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join(' L ')} Z`;
    const bandTone = hatch(seed, 'bandtone', {
      x: CX - 410, y: CY - 100, w: 820, h: 130,
      angle: 6, pitch: 3.6, amp: 0.7, coverage: 0.94, jitter: 0.25,
      width: 0.85, samples: 14,
      density: (u, v) => {
        // Uncut highlight along the upper third; darker toward the lower edge.
        const hl = 1 - Math.exp(-Math.pow((v - 0.28) / 0.13, 2));
        return clamp01(hl * (0.45 + v * 0.85));
      },
    });

    // Pendant chains hanging from the band — the diadem's whole character.
    const chains = Array.from({ length: 27 }, (_, i) => {
      const u = (i + 0.5) / 27;
      const x = CX - 400 + u * 800;
      const yTop = CY - 42 + Math.sin(u * Math.PI) * 44;
      // Longer in the middle, as on the real object.
      const len = 90 + Math.sin(u * Math.PI) * 150 + rand() * 26;
      const links = Math.round(len / 15);
      return { x, yTop, len, links, u, sway: 0.6 + rand() * 0.8, phase: rand() * 6.28 };
    });

    // --- the hoard: a heaped mass of vessels and small objects -------------
    const hoard = Array.from({ length: 22 }, (_, i) => {
      const u = i / 22;
      const ang = u * Math.PI * 2 * 1.7;
      const r = 60 + rand() * 280;
      return {
        x: CX + Math.cos(ang) * r * 1.35,
        y: CY + 40 + Math.sin(ang) * r * 0.46,
        rx: 26 + rand() * 62,
        ry: 20 + rand() * 48,
        kind: Math.floor(rand() * 3),
        rot: (rand() - 0.5) * 40,
        k: u,
      };
    }).sort((a, b) => a.y - b.y);

    const hoardShapes = hoard.map((h, i) => ({
      ...h,
      ring: wobblyEllipse(seed, `h${i}`, h.x, h.y, h.rx, h.ry, 1.0, 34),
      tone: hatch(seed, `ht${i}`, {
        x: h.x - h.rx, y: h.y - h.ry, w: h.rx * 2, h: h.ry * 2,
        angle: 62 + h.rot, pitch: 5.5, amp: 0.8, coverage: 0.85, jitter: 0.4,
        width: 0.85, samples: 6,
        density: (u, v) => {
          const dx = u - 0.42;
          const dy = v - 0.34;
          const rr = Math.hypot(dx, dy) * 2;
          // Highlight left completely uncut at upper-left — the metal's gleam.
          return clamp01((1 - Math.pow(rr, 1.9)) * clamp01((rr - 0.22) * 3.2));
        },
      }),
    }));

    // --- the plate's own furniture -----------------------------------------
    const frame = wobblyRect(seed, 'aframe', 150, 96, W - 300, 660, 1.5);
    const scaleBar = contour(seed, 'scale',
      segment({ x: CX - 130, y: 706 }, { x: CX + 130, y: 707 }, 10), 0.9, 120);

    const ground = crossHatch(seed, 'aground', {
      x: 160, y: 106, w: W - 320, h: 640,
      angle: 33, pitch: 26, amp: 2.2, coverage: 0.4, jitter: 1.3, width: 0.85, samples: 6,
      crossAngle: 87, crossPitch: 38,
      density: (u, v) => clamp01(1 - Math.hypot((u - 0.5) * 1.7, (v - 0.42) * 2.0)) * 0.85,
    });

    const motes = stipple(seed, 'amotes', {
      x: 160, y: 106, w: W - 320, h: 640, count: 300, minR: 0.5, maxR: 2.0,
      density: (u, v) => clamp01(1 - Math.hypot((u - 0.5) * 1.5, (v - 0.42) * 1.9)),
    });

    return { bandT, bandB, bandFill, bandTone, chains, hoardShapes, frame, scaleBar, ground, motes };
  }, [seed]);

  const p = clamp01(progress);
  const t = frame / fps;

  const tFrame = ramp(p, 0.0, 0.16);
  const tGround = ramp(p, 0.04, 0.34);
  const tObject = ramp(p, 0.10, 0.58);
  const tDetail = ramp(p, 0.28, 0.76);
  const tCaption = ramp(p, 0.44, 0.66);

  // The object turns very slightly under the light, as a held object does.
  // Quantised to fours so it reads as a drawn rotation, not a 3D tween.
  const turn = Math.sin(onNs(frame, 4) * 0.0125 + seed * 6) * 1.5;
  const push = easeInOutCubic(ramp(p, 0.02, 1.0));
  const camScale = 1.02 + push * 0.09;

  // The gleam: a hard-edged highlight travelling across the metal. This is the
  // element that does the most work in selling the material.
  const gleam = rakingLight(frame, fps, 12, seed);
  const gleamU = lerp(-0.25, 1.25, gleam);
  const metal = (u: number) => 0.72 + 1.1 * Math.exp(-Math.pow((u - gleamU) / 0.15, 2));

  return (
    <Plate seed={seed} frame={frame} fps={fps} tone="warm" lightPeriodSec={22} lightStrength={0.95}>
      <AbsoluteFill
        style={{
          transform: `scale(${camScale.toFixed(4)}) rotate(${turn.toFixed(3)}deg)`,
          transformOrigin: '50% 38%',
        }}
      >
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute' }}>
          <HatchField strokes={geo.ground.first} t={tGround} color={PLATE.cut} alpha={0.32} passes={5} />
          <HatchField strokes={geo.ground.second} t={ramp(p, 0.14, 0.5)} color={PLATE.cutDim} alpha={0.18} passes={4} />
          <StippleField dots={geo.motes} t={tGround} color={PLATE.cut} alpha={0.24} />
          <InkPath d={geo.frame.d} len={geo.frame.len} t={tFrame} color={PLATE.cutDim} width={1.2} opacity={0.5} />

          {artifact === 'diadem' ? (
            <g>
              <defs>
                <clipPath id={`band-${uid}`}>
                  <path d={geo.bandFill} />
                </clipPath>
              </defs>
              <g clipPath={`url(#band-${uid})`}>
                <HatchField
                  strokes={geo.bandTone}
                  t={clamp01((tObject - 0.1) / 0.9)}
                  color={PLATE.goldBright}
                  alpha={0.9}
                  passes={4}
                  modulate={(st) => metal(st.k)}
                />
              </g>
              <InkPath d={geo.bandT.d} len={geo.bandT.len} t={tObject} color={PLATE.gold} width={2.4} opacity={0.95} />
              <InkPath d={geo.bandB.d} len={geo.bandB.len} t={clamp01((tObject - 0.08) / 0.92)} color={PLATE.gold} width={2.4} opacity={0.95} />

              {/* The pendant chains. Each hangs from the band, sways on its own
                  slow period, and the ones nearer the centre are longer and
                  lag further behind — overlapping action across 27 elements. */}
              {geo.chains.map((c, i) => {
                const ct = stagger(tDetail, i, geo.chains.length, 0.022, 0.24);
                if (ct <= 0.02) return null;
                const swing = Math.sin(t * 0.55 * c.sway + c.phase) * 6 * c.sway;
                const links = Math.max(2, Math.round(c.links * easeOutCubic(ct)));
                return (
                  <g key={i} opacity={Math.min(1, metal(c.u) * 0.9)}>
                    {Array.from({ length: links }, (_, k) => {
                      const f = k / Math.max(1, c.links - 1);
                      // The sway increases down the chain — a pendulum, not a
                      // rigid rotation.
                      const dx = swing * f * f;
                      return (
                        <circle
                          key={k}
                          cx={c.x + dx}
                          cy={c.yTop + 12 + f * c.len}
                          r={3.4}
                          fill="none"
                          stroke={PLATE.goldBright}
                          strokeWidth={1.5}
                          opacity={0.9}
                        />
                      );
                    })}
                    {/* The leaf-shaped terminal. */}
                    <path
                      d={`M ${c.x + swing} ${c.yTop + 12 + c.len} l -7 10 l 7 15 l 7 -15 Z`}
                      fill={PLATE.goldBright}
                      opacity={0.75 * clamp01((ct - 0.7) / 0.3)}
                    />
                  </g>
                );
              })}
            </g>
          ) : (
            <g>
              {geo.hoardShapes.map((h, i) => {
                const ht = stagger(tObject, i, geo.hoardShapes.length, 0.03, 0.28);
                if (ht <= 0.02) return null;
                const s = settle(ht, 0.14);
                return (
                  <g key={i} opacity={clamp01(ht * 1.5)} transform={`translate(0, ${((1 - s) * -18).toFixed(1)})`}>
                    <HatchField
                      strokes={h.tone}
                      t={ht}
                      color={PLATE.gold}
                      alpha={0.75}
                      passes={4}
                      modulate={() => metal(h.x / W)}
                    />
                    <InkPath d={h.ring.d} len={h.ring.len} t={ht} color={PLATE.goldBright} width={1.8} opacity={0.9} />
                  </g>
                );
              })}
            </g>
          )}

          {/* Scale bar — the catalogue's claim to objectivity. */}
          <g opacity={tCaption}>
            <InkPath d={geo.scaleBar.d} len={geo.scaleBar.len} t={tCaption} color={PLATE.cut} width={1.6} opacity={0.7} />
            <path
              d={`M ${CX - 130} 698 L ${CX - 130} 714 M ${CX} 700 L ${CX} 712 M ${CX + 130} 698 L ${CX + 130} 714`}
              stroke={PLATE.cut} strokeWidth={1.4} opacity={0.7}
            />
            <text
              x={CX} y={738} textAnchor="middle" fill={PLATE.cutDim}
              style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 16, letterSpacing: 2.4 }}
            >
              10 CM
            </text>
          </g>
        </svg>
      </AbsoluteFill>

      <PlateCaption
        x={0}
        y={772}
        width={W}
        align="center"
        title={label}
        sub={sub}
        t={tCaption}
        scale={0.86}
      />
    </Plate>
  );
};
