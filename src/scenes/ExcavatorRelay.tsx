import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import type { SceneProps } from './types';
import {
  Plate, PLATE, PaperPanel, HatchField, StippleField, InkPath, PlateCaption,
  hatch, crossHatch, stipple, contour, segment, wobblyRect, wobblyEllipse,
  rngFor, makeFbm1D, lerp, clamp01,
  onNs, rakingLight, ramp, stagger, settle, pulse, anticipate,
  easeOutCubic, easeInOutCubic, easeOutQuint,
} from './engraving';

/**
 * ExcavatorRelay — four generations of excavators at Hisarlık, and the fact
 * that the popular story keeps only the second of them.
 *
 * Cut as a row of engraved portrait medallions of the kind bound as a
 * frontispiece: each man an oval plate, cross-hatched, with his dates and his
 * contribution set beneath. A ruled baseline runs behind them, and the
 * highlighted figure's medallion comes forward while the others recede into
 * the tone of the page.
 *
 * The four are laid out in time order, and the baseline draws itself from
 * Calvert forward — the point being that the line does not start with
 * Schliemann.
 *
 * options:
 *   highlight?: 'calvert' | 'schliemann' | 'dorpfeld' | 'blegen'
 */

const W = 1920;
const H = 1080;

const ROW_Y = 400;
const MEDALLION_R = 116;

type Person = {
  key: string;
  name: string;
  dates: string;
  role: string;
  note: string;
  /** A crude engraved device standing for the man's method. */
  device: 'spade' | 'sun' | 'square' | 'grid';
};

const PEOPLE: Person[] = [
  {
    key: 'calvert', name: 'FRANK CALVERT', dates: '1865',
    role: 'Diplomat, amateur',
    note: 'Identified the mound. Owned half of it.\nHad no money to dig it.',
    device: 'spade',
  },
  {
    key: 'schliemann', name: 'HEINRICH SCHLIEMANN', dates: '1871–1890',
    role: 'Retired businessman',
    note: 'Funded and drove the dig.\nFast, destructive — and took the credit.',
    device: 'sun',
  },
  {
    key: 'dorpfeld', name: 'WILHELM DÖRPFELD', dates: '1893–1894',
    role: 'Trained architect',
    note: 'Brought method. Found Troy VI —\nthe city Schliemann had dug past.',
    device: 'square',
  },
  {
    key: 'blegen', name: 'CARL BLEGEN', dates: '1932–1938',
    role: 'Archaeologist, Cincinnati',
    note: 'Re-excavated properly. Argued for\nTroy VIIa as the war-era city.',
    device: 'grid',
  },
];

const DEVICES: Record<Person['device'], string> = {
  spade: 'M0,-34 L0,20 M-14,20 L14,20 L10,40 L-10,40 Z M-9,-34 L9,-34',
  sun: 'M0,-30 L0,-46 M0,30 L0,46 M-30,0 L-46,0 M30,0 L46,0 M-21,-21 L-33,-33 M21,21 L33,33 M21,-21 L33,-33 M-21,21 L-33,33',
  square: 'M-34,-30 L34,32 L-34,32 Z M-24,20 L-24,26 M-12,20 L-12,26 M0,20 L0,26',
  grid: 'M-32,-32 L32,-32 M-32,-10 L32,-10 M-32,12 L32,12 M-32,34 L32,34 M-32,-32 L-32,34 M-10,-32 L-10,34 M12,-32 L12,34 M34,-32 L34,34',
};

type Options = { highlight?: string };

export const ExcavatorRelay: React.FC<SceneProps> = ({ progress, frame, fps, seed, options }) => {
  const opts = (options ?? {}) as Options;
  const highlight = opts.highlight;
  const hotIndex = PEOPLE.findIndex((p) => p.key === highlight);

  const geo = useMemo(() => {
    const fbm = makeFbm1D(seed, 'relay');

    const slots = PEOPLE.map((_, i) => 262 + i * 466);

    const medallions = PEOPLE.map((person, i) => {
      const cx = slots[i];
      const ring = wobblyEllipse(seed, `ring${i}`, cx, ROW_Y, MEDALLION_R, MEDALLION_R, 1.2, 52);
      const ringIn = wobblyEllipse(seed, `ring2-${i}`, cx, ROW_Y, MEDALLION_R - 13, MEDALLION_R - 13, 0.9, 46);
      // The medallion's ground: cross-hatched, lit from upper-left, so it
      // reads as a struck plate rather than a circle.
      const tone = crossHatch(seed, `med${i}`, {
        x: cx - MEDALLION_R, y: ROW_Y - MEDALLION_R, w: MEDALLION_R * 2, h: MEDALLION_R * 2,
        angle: 34, pitch: 9, amp: 1.0, coverage: 0.8, jitter: 0.5, width: 0.9, samples: 6,
        crossAngle: 96, crossPitch: 13,
        density: (u, v) => {
          // Radial falloff plus a directional key.
          const dx = u - 0.5;
          const dy = v - 0.5;
          const r = Math.hypot(dx, dy) * 2;
          const key = clamp01(1 - (dx * 0.8 + dy * 1.0 + 0.5));
          return clamp01((1 - Math.pow(r, 2.4)) * (0.25 + key * 0.95));
        },
      });
      const grain = stipple(seed, `medg${i}`, {
        x: cx - MEDALLION_R, y: ROW_Y - MEDALLION_R, w: MEDALLION_R * 2, h: MEDALLION_R * 2,
        count: 300, minR: 0.5, maxR: 1.9,
        density: (u, v) => clamp01(1 - Math.hypot(u - 0.5, v - 0.5) * 2.1),
      });
      return { person, cx, ring, ringIn, tone, grain, index: i };
    });

    // The baseline the four sit on — a ruled chronological thread.
    const basePts: { x: number; y: number }[] = [];
    for (let k = 0; k <= 50; k++) {
      const u = k / 50;
      basePts.push({ x: 80 + u * (W - 160), y: ROW_Y + MEDALLION_R + 56 + fbm(u * 4) * 3 });
    }
    const baseline = contour(seed, 'base', basePts, 1.2, 300);

    const pageTone = hatch(seed, 'page', {
      x: -40, y: 120, w: W + 80, h: 700,
      angle: 8, pitch: 34, amp: 2.4, coverage: 0.4, jitter: 1.3, width: 0.8, samples: 6,
      density: (u, v) => clamp01(0.5 - Math.abs(v - 0.5) * 0.7) * clamp01(0.4 + fbm(u * 5) * 0.8),
    });

    // Motes drifting across the page. Without these the plate is completely
    // frozen once the four medallions have landed — a frame-to-frame diff four
    // frames apart came back at 0.1/255 mean, i.e. visually static, and this
    // scene carries nearly two and a half minutes of the film.
    const motes = stipple(seed, 'relaymotes', {
      x: -60, y: 90, w: W + 120, h: 760, count: 240, minR: 0.5, maxR: 2.4,
    });

    return { medallions, baseline, pageTone, slots, motes };
  }, [seed]);

  const p = clamp01(progress);
  const t = frame / fps;

  const tPage = ramp(p, 0.0, 0.2);
  const tBase = ramp(p, 0.06, 0.44);
  // The four arrive in time order, each landing with a settle.
  const arrive = (i: number) => stagger(ramp(p, 0.10, 0.62), i, 4, 0.14, 0.28);

  // The highlight comes in AFTER all four are on the page, so the viewer sees
  // the whole relay before being told which link the story remembers.
  const tHot = ramp(p, 0.56, 0.70);

  // Camera: holds wide while the four land, then eases across to the
  // highlighted man and holds there. Two moves, two holds — not a drift.
  const slide = easeInOutCubic(ramp(p, 0.60, 0.82));
  const targetX = hotIndex >= 0 ? geo.slots[hotIndex] : W / 2;
  // A continuous slow breath under the staged move, so the plate is never
  // completely still even during the long holds.
  const breath = rakingLight(frame, fps, 44, seed);
  const drift = easeInOutCubic(ramp(p, 0.0, 1.0));
  const camScale = 1.0 + slide * (hotIndex >= 0 ? 0.30 : 0.06) + drift * 0.035;
  const camX =
    (W / 2 - targetX) * (camScale - 1) / camScale + (breath - 0.5) * 26 - drift * 12;
  const camY = slide * (hotIndex >= 0 ? 26 : 0) + (rakingLight(frame, fps, 57, seed * 0.5) - 0.5) * 14;

  const sweep = rakingLight(frame, fps, 17, seed);
  const litness = (u: number) => 1 + 0.5 * Math.exp(-Math.pow((u - lerp(-0.2, 1.2, sweep)) / 0.24, 2));

  return (
    <Plate seed={seed} frame={frame} fps={fps} tone="warm" lightPeriodSec={17} lightStrength={0.85}>
      <AbsoluteFill
        style={{
          transform: `scale(${camScale.toFixed(4)}) translate(${camX.toFixed(2)}px, ${camY.toFixed(2)}px)`,
          transformOrigin: '50% 42%',
        }}
      >
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute' }}>
          <HatchField strokes={geo.pageTone} t={tPage} color={PLATE.cut} alpha={0.18} passes={4} />
          {geo.motes.map((m, i) => {
            const speed = 0.012 + (m.k % 0.29) * 0.04;
            const u = ((t * speed) + m.k * 6.1) % 1;
            const fade = Math.sin(u * Math.PI);
            const o = m.o * fade * 0.34 * tPage;
            if (o <= 0.01) return null;
            return (
              <circle
                key={i}
                cx={m.x + (u - 0.5) * 190 * (0.4 + (m.k % 0.6))}
                cy={m.y - u * 130}
                r={m.r}
                fill={PLATE.cut}
                opacity={o}
              />
            );
          })}
          <InkPath d={geo.baseline.d} len={geo.baseline.len} t={tBase} color={PLATE.cutDim} width={1.2} opacity={0.5} />

          {geo.medallions.map((m) => {
            const a = arrive(m.index);
            if (a <= 0.01) return null;
            const isHot = m.index === hotIndex;
            const recede = hotIndex >= 0 ? lerp(1, isHot ? 1 : 0.3, tHot) : 1;
            const lift = isHot ? settle(tHot, 0.16) : 0;
            const s = settle(a, 0.14) * (1 + lift * 0.09);
            const col = isHot ? PLATE.goldBright : PLATE.cut;

            return (
              <g key={m.index} opacity={recede}>
                <g transform={`translate(${m.cx}, ${ROW_Y}) scale(${s.toFixed(4)}) translate(${-m.cx}, ${-ROW_Y})`}>
                  <defs>
                    <clipPath id={`med-${Math.round(seed * 1e6)}-${m.index}`}>
                      <circle cx={m.cx} cy={ROW_Y} r={MEDALLION_R - 14} />
                    </clipPath>
                  </defs>
                  <g clipPath={`url(#med-${Math.round(seed * 1e6)}-${m.index})`}>
                    <HatchField strokes={m.tone.first} t={a} color={col} alpha={0.5} passes={5} modulate={(st) => litness(st.k)} />
                    <HatchField strokes={m.tone.second} t={clamp01((a - 0.3) / 0.7)} color={col} alpha={0.34} passes={4} />
                    <StippleField dots={m.grain} t={a} color={col} alpha={0.4} />
                  </g>
                  {/* The device: draws itself, then holds. */}
                  <g transform={`translate(${m.cx}, ${ROW_Y})`} opacity={clamp01((a - 0.25) / 0.5)}>
                    <path d={DEVICES[m.person.device]} fill="none" stroke={col} strokeWidth={2.4} strokeLinecap="round" opacity={0.9} />
                  </g>
                  <InkPath d={m.ring.d} len={m.ring.len} t={a} color={col} width={2.4} opacity={0.9} />
                  <InkPath d={m.ringIn.d} len={m.ringIn.len} t={clamp01((a - 0.2) / 0.8)} color={col} width={1.0} opacity={0.5} />
                </g>

                {/* Tick down to the baseline, then the caption below it. */}
                <line
                  x1={m.cx} y1={ROW_Y + MEDALLION_R + 4}
                  x2={m.cx} y2={ROW_Y + MEDALLION_R + 52}
                  stroke={col} strokeWidth={1.2} opacity={0.55 * clamp01((a - 0.4) / 0.4)}
                />
                <circle cx={m.cx} cy={ROW_Y + MEDALLION_R + 56} r={isHot ? 6 : 4} fill={col} opacity={0.9 * clamp01((a - 0.5) / 0.4)} />

                <g opacity={clamp01((a - 0.5) / 0.5)} transform={`translate(0, ${((1 - clamp01((a - 0.5) / 0.5)) * 9).toFixed(2)})`}>
                  <text
                    x={m.cx} y={ROW_Y + MEDALLION_R + 100}
                    textAnchor="middle" fill={PLATE.gold}
                    style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 19, letterSpacing: 2.6 }}
                  >
                    {m.person.dates}
                  </text>
                  <text
                    x={m.cx} y={ROW_Y + MEDALLION_R + 138}
                    textAnchor="middle" fill={col}
                    style={{ fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: isHot ? 30 : 26, letterSpacing: 2 }}
                  >
                    {m.person.name}
                  </text>
                  <text
                    x={m.cx} y={ROW_Y + MEDALLION_R + 166}
                    textAnchor="middle" fill={PLATE.cutDim}
                    style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 17, letterSpacing: 1.2 }}
                  >
                    {m.person.role}
                  </text>
                  {m.person.note.split('\n').map((line, li) => (
                    <text
                      key={li}
                      x={m.cx} y={ROW_Y + MEDALLION_R + 198 + li * 24}
                      textAnchor="middle" fill={isHot ? PLATE.cut : PLATE.cutFaint}
                      style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, fontSize: 17, letterSpacing: 0.6 }}
                    >
                      {line}
                    </text>
                  ))}
                </g>

                {isHot ? (
                  <circle
                    cx={m.cx} cy={ROW_Y}
                    r={MEDALLION_R + 14 + pulse(p, 0.60, 0.05) * 60}
                    fill="none" stroke={PLATE.goldBright} strokeWidth={1.8}
                    opacity={pulse(p, 0.60, 0.05) * 0.7}
                  />
                ) : null}
              </g>
            );
          })}
        </svg>
      </AbsoluteFill>

      <PlateCaption
        x={96}
        y={104}
        title="Four generations at Hisarlık"
        sub="The story keeps only the second"
        t={ramp(p, 0.02, 0.2)}
      />
    </Plate>
  );
};
