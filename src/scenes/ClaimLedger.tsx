import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import type { SceneProps } from './types';
import {
  Plate, PLATE, PaperPanel, HatchField, StippleField, InkPath, PlateCaption,
  hatch, stipple, contour, segment, wobblyRect,
  rngFor, makeFbm1D, lerp, clamp01,
  onNs, rakingLight, ramp, stagger, settle, pulse, anticipate,
  easeOutCubic, easeInOutCubic, easeOutQuint,
} from './engraving';

/**
 * ClaimLedger — what Schliemann said, set against what the record shows.
 *
 * Cut in the film's second register: instead of white lines on the dark block,
 * this is a PRINTED SHEET tipped into the page — cream laid paper, dark ink,
 * ruled columns, the double-entry look of a ledger. That contrast is doing
 * real work: the rest of the film is the world as engraved illustration, and
 * this is the paper trail, the documentary evidence, a different kind of
 * object entirely.
 *
 * Every row is a claim and its correction. The claim is written first in a
 * confident hand; the record arrives after it, in a second colour, and then a
 * rule is struck through the claim. The strike-through is the whole gag, and
 * it lands with a snap rather than a fade.
 *
 * options:
 *   rows?: { claimed: string; record: string }[]
 */

const W = 1920;
const H = 1080;

const SHEET = { x: 150, y: 118, w: 1620, h: 618 };

const DEFAULT_ROWS = [
  { claimed: 'Read Homer as a boy and vowed to find Troy', record: 'The vow appears only in his own later memoirs' },
  { claimed: 'Found the site by following the Iliad', record: 'Frank Calvert identified the mound, and told him' },
  { claimed: 'Sophia was at his side when the gold appeared', record: 'She was in Athens that day' },
  { claimed: 'Carried the treasure out in his wife’s shawl', record: 'Written in afterwards, for the telling' },
  { claimed: '“Priam’s Treasure” — the gold of Homer’s king', record: 'Troy II gold, older than any Trojan War by ~1,300 years' },
];

type Options = { rows?: { claimed: string; record: string }[] };

export const ClaimLedger: React.FC<SceneProps> = ({ progress, frame, fps, seed, options }) => {
  const opts = (options ?? {}) as Options;
  const rows = opts.rows ?? DEFAULT_ROWS;

  const geo = useMemo(() => {
    const rand = rngFor(seed, 'ledger');
    const fbm = makeFbm1D(seed, 'ledgerf');

    // Ruled lines on the sheet, in the sheet's own coordinates.
    const rowH = (SHEET.h - 150) / rows.length;
    const rules = rows.map((_, i) =>
      contour(seed, `rule${i}`,
        segment({ x: 46, y: 150 + (i + 1) * rowH }, { x: SHEET.w - 46, y: 150 + (i + 1) * rowH + fbm(i * 3) * 2 }, 16),
        0.9, 220)
    );
    const divider = contour(seed, 'div',
      segment({ x: SHEET.w * 0.5, y: 92 }, { x: SHEET.w * 0.5 + 3, y: SHEET.h - 34 }, 12), 1.0, 200);
    const header = contour(seed, 'hdr',
      segment({ x: 46, y: 138 }, { x: SHEET.w - 46, y: 139 }, 16), 1.0, 240);

    // Foxing — age spots on the sheet. Static, and part of why it reads as an
    // object rather than a UI panel.
    const foxing = stipple(seed, 'fox', {
      x: 0, y: 0, w: SHEET.w, h: SHEET.h, count: 260, minR: 1.2, maxR: 7,
      density: (u, v) => clamp01(Math.pow(Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)) * 2, 2.2)),
    });

    // The dark block behind the sheet still gets worked, so the sheet sits ON
    // something rather than floating.
    const ground = hatch(seed, 'lground', {
      x: -40, y: 60, w: W + 80, h: 960,
      angle: 62, pitch: 26, amp: 2.0, coverage: 0.45, jitter: 1.2, width: 0.9, samples: 6,
      density: (u, v) => clamp01(0.45 + fbm(u * 4 + v * 2) * 0.8) * clamp01(1.2 - v * 1.1),
    });

    return { rules, divider, header, foxing, ground, rowH };
  }, [seed, rows]);

  const p = clamp01(progress);

  const tGround = ramp(p, 0.0, 0.18);
  // The sheet is laid down first, with a small settle.
  const tSheet = ramp(p, 0.04, 0.22);
  const sheetIn = settle(tSheet, 0.05);
  const tRules = ramp(p, 0.14, 0.36);

  // Each row: the claim is written, then the record answers it, then the
  // claim is struck through. Three beats per row, staggered down the page.
  const rowT = (i: number) => stagger(ramp(p, 0.20, 0.94), i, rows.length, 0.135, 0.30);

  const sweep = rakingLight(frame, fps, 33, seed);

  // Camera: the sheet is examined. A small push, a hold, then a drift down
  // the page as the later rows fill in.
  const push = easeOutCubic(ramp(p, 0.04, 0.26));
  const drift = easeInOutCubic(ramp(p, 0.45, 1.0));
  const camScale = 1.0 + push * 0.045 + drift * 0.035;
  const camY = -drift * 30;

  const colL = 46;
  const colR = SHEET.w * 0.5 + 34;
  const colW = SHEET.w * 0.5 - 92;

  return (
    <Plate seed={seed} frame={frame} fps={fps} tone="neutral" lightPeriodSec={33} lightStrength={0.7}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute' }}>
        <HatchField strokes={geo.ground} t={tGround} color={PLATE.cut} alpha={0.2} passes={5} />
      </svg>

      <AbsoluteFill
        style={{
          transform: `scale(${camScale.toFixed(4)}) translateY(${camY.toFixed(2)}px)`,
          transformOrigin: '50% 40%',
        }}
      >
        <PaperPanel x={SHEET.x} y={SHEET.y} w={SHEET.w} h={SHEET.h} seed={seed} reveal={sheetIn}>
          <svg width={SHEET.w} height={SHEET.h} viewBox={`0 0 ${SHEET.w} ${SHEET.h}`} style={{ position: 'absolute' }}>
            {/* Age. */}
            <StippleField dots={geo.foxing} t={1} color="#8a6a3a" alpha={0.18} />

            {/* Ruling. */}
            <InkPath d={geo.header.d} len={geo.header.len} t={tRules} color={PLATE.paperInk} width={1.6} opacity={0.7} />
            <InkPath d={geo.divider.d} len={geo.divider.len} t={tRules} color={PLATE.paperInk} width={1.2} opacity={0.45} />
            {geo.rules.map((r, i) => (
              <InkPath
                key={i}
                d={r.d} len={r.len}
                t={stagger(tRules, i, geo.rules.length, 0.09, 0.5)}
                color={PLATE.paperInk} width={0.9} opacity={0.28}
              />
            ))}

            {/* Column heads. */}
            <text x={colL} y={104} fill={PLATE.paperInk} opacity={0.85 * clamp01(tRules * 2)}
              style={{ fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: 27, letterSpacing: 4 }}>
              WHAT HE SAID
            </text>
            <text x={colR} y={104} fill="#6d2f14" opacity={0.85 * clamp01(tRules * 2)}
              style={{ fontFamily: "'Cinzel', serif", fontWeight: 700, fontSize: 27, letterSpacing: 4 }}>
              WHAT THE RECORD SHOWS
            </text>

            {rows.map((row, i) => {
              const t = rowT(i);
              if (t <= 0.01) return null;
              // Three beats within the row.
              const tClaim = clamp01(t / 0.36);
              const tRecord = clamp01((t - 0.40) / 0.34);
              const tStrike = clamp01((t - 0.76) / 0.16);
              const y = 150 + i * geo.rowH + geo.rowH * 0.62;

              // The strike-through is drawn as a real ruled line, and it lands
              // fast: an engraver striking out a line does not fade it.
              const strikeW = colW * easeOutQuint(tStrike);

              return (
                <g key={i}>
                  <g opacity={tClaim} transform={`translate(${((1 - tClaim) * -12).toFixed(2)}, 0)`}>
                    <Wrapped
                      x={colL} y={y} width={colW} text={row.claimed}
                      fill={PLATE.paperInk} size={25} weight={600} opacity={tStrike > 0.5 ? 0.42 : 0.95}
                    />
                  </g>
                  {tStrike > 0.01 ? (
                    <line
                      x1={colL} y1={y - 8} x2={colL + strikeW} y2={y - 6}
                      stroke="#7a2f12" strokeWidth={2.6} opacity={0.9}
                    />
                  ) : null}
                  <g opacity={tRecord} transform={`translate(${((1 - tRecord) * 12).toFixed(2)}, 0)`}>
                    <Wrapped
                      x={colR} y={y} width={colW} text={row.record}
                      fill="#6d2f14" size={25} weight={600} opacity={0.95}
                    />
                  </g>
                </g>
              );
            })}
          </svg>
        </PaperPanel>
      </AbsoluteFill>

      {/* A raking gleam travelling across the sheet — light on paper. */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(104deg, rgba(255,240,210,0) ${(sweep * 120 - 30).toFixed(1)}%, rgba(255,240,210,0.10) ${(sweep * 120 - 12).toFixed(1)}%, rgba(255,240,210,0) ${(sweep * 120 + 8).toFixed(1)}%)`,
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />
    </Plate>
  );
};

/**
 * Naive word-wrapper for SVG text. SVG has no flow layout, and these strings
 * are known and short, so an estimate from the average glyph width is both
 * sufficient and deterministic.
 */
const Wrapped: React.FC<{
  x: number; y: number; width: number; text: string;
  fill: string; size: number; weight: number; opacity?: number;
}> = ({ x, y, width, text, fill, size, weight, opacity = 1 }) => {
  const lines = useMemo(() => {
    const perChar = size * 0.5;
    const maxChars = Math.max(8, Math.floor(width / perChar));
    const words = text.split(' ');
    const out: string[] = [];
    let line = '';
    for (const w of words) {
      if (line.length === 0) line = w;
      else if ((line + ' ' + w).length <= maxChars) line += ' ' + w;
      else { out.push(line); line = w; }
    }
    if (line) out.push(line);
    return out;
  }, [text, width, size]);

  return (
    <>
      {lines.map((l, i) => (
        <text
          key={i}
          x={x}
          y={y + i * (size * 1.32)}
          fill={fill}
          opacity={opacity}
          style={{ fontFamily: "'Inter', sans-serif", fontWeight: weight, fontSize: size, letterSpacing: 0.2 }}
        >
          {l}
        </text>
      ))}
    </>
  );
};
