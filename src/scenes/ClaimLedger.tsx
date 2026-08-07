import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/cinzel/600.css';
import type { SceneProps } from './types';
import { SAFE_AREA, PALETTE } from './types';

/**
 * ClaimLedger — the spine of the whole film: Schliemann's stories don't
 * survive scrutiny. A two-column ledger, CLAIMED against THE RECORD, with
 * each row arriving in its own choreographed beat: the claim writes on and
 * holds, then the record lands a beat later while a strike-through DRAWS
 * across the claim (not a hard cut). Rows stagger so the rhythm can sit
 * under narration; a faint, continuously drifting paper-grain layer keeps
 * the frame from ever feeling frozen between rows.
 *
 * options:
 *   rows?: { claimed: string; record: string }[] — defaults to three
 *     claims from the script: the childhood vow, Sophia at the discovery,
 *     and the gold belonging to Priam.
 */

function mulberry32(seed: number) {
  let a = (seed >>> 0) || 1;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const remap01 = (p: number, a: number, b: number) => clamp01((p - a) / Math.max(1e-6, b - a));

type LedgerRow = { claimed: string; record: string };

type ClaimLedgerOptions = {
  rows?: LedgerRow[];
};

const DEFAULT_ROWS: LedgerRow[] = [
  { claimed: 'Vowed as a boy to dig up Troy', record: 'The story appears only in his own retelling' },
  { claimed: 'Sophia at his side when the gold was found', record: "Her own family: she was away in Greece" },
  { claimed: 'The gold belonged to King Priam', record: 'The layer predates the war by ~1,200 years' },
];

// Ledger occupies the SAFE_AREA "top pocket" only — small type, low
// contrast, plenty of air, entirely clear of the title band and subtitles.
const LEDGER_TOP = SAFE_AREA.edge + 30; // 150
const LEDGER_BOTTOM = SAFE_AREA.titleBandTop - 14; // 366
const LEDGER_LEFT = SAFE_AREA.edge;
const LEDGER_RIGHT = 1920 - SAFE_AREA.edge;
const GUTTER_X = (LEDGER_LEFT + LEDGER_RIGHT) / 2;

export const ClaimLedger: React.FC<SceneProps> = ({ progress, frame, fps, seed, options }) => {
  const opts = (options ?? {}) as ClaimLedgerOptions;
  const rows = opts.rows && opts.rows.length > 0 ? opts.rows : DEFAULT_ROWS;

  const seedInt = Math.floor(seed * 1e9) + 1;

  // Static paper speckle, each with its own slow, independent twinkle
  // phase/speed — the aggregate reads as organic film-grain flicker rather
  // than one discrete repeating event, and it never runs out of new-looking
  // motion even across a very long hold. Positions are fixed (seeded once);
  // only opacity and a whole-layer drift move per frame.
  const grain = useMemo(() => {
    const rand = mulberry32(seedInt + 29);
    return Array.from({ length: 90 }, () => ({
      x: rand() * 1920,
      y: rand() * 1080,
      r: 0.5 + rand() * 1,
      o: 0.02 + rand() * 0.045,
      phase: rand() * Math.PI * 2,
      speed: 0.25 + rand() * 0.4,
    }));
  }, [seedInt]);
  const driftT = frame / fps;
  const grainDriftX = Math.sin(driftT * ((Math.PI * 2) / 6.5)) * 5;
  const grainDriftY = Math.cos(driftT * ((Math.PI * 2) / 8)) * 3.5;

  const n = rows.length;
  const headerFade = easeOutCubic(remap01(progress, 0, 0.12));

  // Available height budget, degrading row height gracefully as more rows
  // are supplied so this stays robust to whatever the registry passes in.
  const headerH = 34;
  const availH = LEDGER_BOTTOM - LEDGER_TOP - headerH;
  const rowH = Math.min(58, availH / Math.max(1, n));
  const fontScale = clamp01((rowH - 30) / 28) * 0.25 + 0.85; // 0.85–1.1

  // Row choreography is staggered across the first ~78% of progress,
  // leaving a settled tail. Each row: claim writes on -> holds a beat ->
  // record lands while the strike-through draws across the claim.
  const revealSpan = 0.78;
  const perRow = n > 0 ? revealSpan / n : revealSpan;
  const overlap = perRow * 0.5; // rows begin arriving before the previous fully settles

  return (
    <AbsoluteFill style={{ backgroundColor: PALETTE.ink, overflow: 'hidden' }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 1200px 500px at 50% 8%, ${PALETTE.soilWarm}28 0%, transparent 72%)`,
        }}
      />

      {/* Paper grain — fixed positions, slow whole-layer drift plus a
          per-dot twinkle so the texture is always quietly alive. */}
      <svg width={1920} height={1080} viewBox="0 0 1920 1080" style={{ position: 'absolute', inset: 0 }}>
        <g transform={`translate(${grainDriftX},${grainDriftY})`}>
          {grain.map((g, i) => (
            <circle
              key={i}
              cx={g.x}
              cy={g.y}
              r={g.r}
              fill={PALETTE.bone}
              opacity={g.o * (0.55 + 0.45 * Math.sin(driftT * g.speed + g.phase))}
            />
          ))}
        </g>
      </svg>

      <div
        style={{
          position: 'absolute',
          left: LEDGER_LEFT,
          top: LEDGER_TOP,
          width: LEDGER_RIGHT - LEDGER_LEFT,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            opacity: 0.6 * headerFade,
            transform: `translateY(${(1 - headerFade) * 8}px)`,
          }}
        >
          <div style={headerStyle(false)}>CLAIMED</div>
          <div style={headerStyle(true)}>THE RECORD</div>
        </div>
        <div
          style={{
            height: 1,
            marginTop: 8,
            background: `linear-gradient(90deg, transparent, ${PALETTE.ash}, transparent)`,
            opacity: 0.4 * headerFade,
            transform: `scaleX(${0.3 + 0.7 * headerFade})`,
          }}
        />

        {rows.map((row, i) => {
          const start = i * (perRow - overlap * 0.35);
          // Claim phase: writes on, then holds a beat.
          const claimIn = easeOutCubic(remap01(progress, start, start + perRow * 0.32));
          // Beat, then the record lands while the strike-through draws.
          const recordStart = start + perRow * 0.5;
          const recordIn = easeOutCubic(remap01(progress, recordStart, recordStart + perRow * 0.4));
          const strikeStart = start + perRow * 0.58;
          const strikeT = easeOutCubic(remap01(progress, strikeStart, strikeStart + perRow * 0.32));

          const rowTop = headerH + i * rowH;

          return (
            <div key={i} style={{ position: 'absolute', left: 0, top: rowTop, width: '100%', height: rowH }}>
              {/* Row divider */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: 1,
                  background: PALETTE.ash,
                  opacity: 0.12 * claimIn,
                }}
              />
              {/* Centre gutter connector */}
              <div
                style={{
                  position: 'absolute',
                  left: GUTTER_X - LEDGER_LEFT - 10,
                  top: rowH / 2 - 6,
                  width: 20,
                  textAlign: 'center',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 11 * fontScale,
                  color: PALETTE.bronze,
                  opacity: 0.5 * recordIn,
                }}
              >
                →
              </div>

              {/* Claimed cell */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: GUTTER_X - LEDGER_LEFT - 26,
                  height: rowH,
                  display: 'flex',
                  alignItems: 'center',
                  opacity: claimIn,
                  transform: `translateY(${(1 - claimIn) * 8}px)`,
                }}
              >
                <span
                  style={{
                    position: 'relative',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 500,
                    fontSize: 15 * fontScale,
                    letterSpacing: 0.1,
                    color: PALETTE.bone,
                    opacity: 0.8,
                  }}
                >
                  {row.claimed}
                  {/* Strike-through that DRAWS across the claim, left to right */}
                  <span
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: '52%',
                      height: 1,
                      width: `${strikeT * 100}%`,
                      background: PALETTE.ember,
                      opacity: 0.85,
                    }}
                  />
                </span>
              </div>

              {/* Record cell */}
              <div
                style={{
                  position: 'absolute',
                  left: GUTTER_X - LEDGER_LEFT + 14,
                  top: 0,
                  width: LEDGER_RIGHT - GUTTER_X - 14,
                  height: rowH,
                  display: 'flex',
                  alignItems: 'center',
                  opacity: recordIn,
                  transform: `translateY(${(1 - recordIn) * 8}px)`,
                }}
              >
                <span
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 500,
                    fontSize: 14 * fontScale,
                    letterSpacing: 0.1,
                    color: PALETTE.goldBright,
                    opacity: 0.92,
                  }}
                >
                  {row.record}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

function headerStyle(gold: boolean): React.CSSProperties {
  return {
    fontFamily: '"Cinzel", serif',
    fontWeight: 600,
    fontSize: 15,
    letterSpacing: 3,
    color: gold ? PALETTE.gold : PALETTE.ash,
    textTransform: 'uppercase',
  };
}

export default ClaimLedger;
