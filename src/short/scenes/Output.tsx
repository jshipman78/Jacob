/**
 * 7 — "Fourteen minutes. Cited line by line."
 *
 * The film and the citations file arrive together, and the citations are
 * timecoded to the sentence that speaks them — so the two are drawn coupled:
 * the playhead runs, the ledger scrolls with it, and the row being spoken is
 * the row that lights.
 */

import React from 'react';
import { AbsoluteFill } from 'remotion';
import { C, FONT_MONO, FONT_UI } from '../theme';
import { useT, ramp, easeOutCubic, Label } from '../kit';

type Row = { tc: string; verdict: 'established' | 'disputed'; claim: string; source: string };

const ROWS: Row[] = [
  { tc: '00:41', verdict: 'established', claim: 'The siege ran three years.', source: 'Polybius, Histories XXXVIII' },
  { tc: '02:14', verdict: 'disputed', claim: 'The fields were sown with salt.', source: 'Ridley 1986 — later invention' },
  { tc: '03:47', verdict: 'established', claim: 'Byrsa hill held out last.', source: 'Appian, Punica 127' },
  { tc: '05:02', verdict: 'established', claim: 'Scipio wept at the burning.', source: 'Appian, Punica 132' },
  { tc: '07:38', verdict: 'established', claim: '50,000 were sold into slavery.', source: 'Orosius IV.23' },
  { tc: '09:55', verdict: 'disputed', claim: 'The city burned seventeen days.', source: 'Appian — single source' },
  { tc: '11:06', verdict: 'established', claim: 'The walls were levelled by decree.', source: 'Polybius XXXVIII.22' },
  { tc: '12:20', verdict: 'established', claim: 'The site was resettled in 122 BCE.', source: 'Plutarch, C. Gracchus 11' },
];

const ROW_H = 132;
const HEADER_H = 74;
const PAGE_H = 880;

export const Output: React.FC = () => {
  const t = useT();

  const page = easeOutCubic(ramp(t, 0.05, 0.5));
  const play = ramp(t, 0.3, 3.6);
  // Scroll exactly the overflow, so the ledger neither stalls early nor runs
  // off the end into empty paper.
  const scroll = play * Math.max(0, ROWS.length * ROW_H - (PAGE_H - HEADER_H));
  const active = Math.min(ROWS.length - 1, Math.floor(play * ROWS.length));

  const clock = (() => {
    const total = Math.floor(play * 842); // 14:02 in seconds
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  })();

  return (
    <AbsoluteFill>
      {/* --- the film ------------------------------------------------------- */}
      <div
        style={{
          position: 'absolute',
          top: 250,
          left: 90,
          width: 900,
          opacity: page,
          transform: `translateY(${((1 - page) * -30).toFixed(1)}px)`,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Label size={26} track={6} color={C.goldBright} weight={800}>
            carthage.mp4
          </Label>
          <span style={{ fontFamily: FONT_MONO, fontSize: 30, color: C.goldBright }}>
            {clock} / 14:02
          </span>
        </div>
        <div style={{ position: 'relative', height: 14, marginTop: 16, background: 'rgba(207,195,176,0.16)' }}>
          <div style={{ position: 'absolute', inset: 0, width: `${(play * 100).toFixed(1)}%`, background: C.gold }} />
          <div
            style={{
              position: 'absolute',
              top: -13,
              left: `${(play * 100).toFixed(1)}%`,
              width: 6,
              height: 40,
              background: C.goldBright,
              transform: 'translateX(-3px)',
            }}
          />
        </div>
      </div>

      {/* --- the citations file --------------------------------------------- */}
      <div
        style={{
          position: 'absolute',
          top: 400,
          left: 70,
          width: 940,
          height: PAGE_H,
          overflow: 'hidden',
          background: C.paper,
          opacity: page,
          transform: `translateY(${((1 - page) * 60).toFixed(1)}px)`,
          boxShadow: '0 26px 70px rgba(0,0,0,0.55)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            height: HEADER_H,
            boxSizing: 'border-box',
            padding: '20px 32px',
            borderBottom: `2px solid rgba(26,19,13,0.35)`,
            fontFamily: FONT_MONO,
            fontSize: 26,
            color: C.paperInk,
            letterSpacing: 3,
          }}
        >
          <span>citations.md</span>
          <span style={{ opacity: 0.65 }}>38 claims · 6 cut · 41 sources</span>
        </div>

        {/* The rows scroll inside their own clip, or they ride up over the
            file header on the way past. */}
        <div style={{ height: PAGE_H - HEADER_H, overflow: 'hidden' }}>
          <div style={{ transform: `translateY(${(-scroll).toFixed(1)}px)` }}>
          {ROWS.map((r, i) => {
            const isActive = i === active;
            return (
              <div
                key={r.tc}
                style={{
                  height: ROW_H,
                  boxSizing: 'border-box',
                  padding: '20px 32px',
                  borderBottom: '1px solid rgba(26,19,13,0.18)',
                  background: isActive ? 'rgba(217,184,114,0.42)' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
                  <span style={{ fontFamily: FONT_MONO, fontSize: 26, color: C.paperInk, opacity: 0.75 }}>
                    {r.tc}
                  </span>
                  <span
                    style={{
                      fontFamily: FONT_UI,
                      fontSize: 20,
                      fontWeight: 800,
                      letterSpacing: 3,
                      textTransform: 'uppercase',
                      padding: '3px 10px',
                      border: `2px solid ${r.verdict === 'disputed' ? '#8a5a12' : '#2f4a24'}`,
                      color: r.verdict === 'disputed' ? '#8a5a12' : '#2f4a24',
                    }}
                  >
                    {r.verdict}
                  </span>
                  <span style={{ fontFamily: FONT_UI, fontSize: 30, fontWeight: 700, color: C.paperInk }}>
                    {r.claim}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 10,
                    fontFamily: FONT_UI,
                    fontSize: 25,
                    fontStyle: 'italic',
                    color: 'rgba(26,19,13,0.72)',
                  }}
                >
                  {r.source}
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
