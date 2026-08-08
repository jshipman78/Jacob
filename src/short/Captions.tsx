/**
 * Word-synchronised captions.
 *
 * A short is watched muted more often than not, so the captions are not an
 * accessibility afterthought here — they are the primary read, and the voice
 * is what confirms them. Hence: the whole line is on screen from the moment it
 * starts (so the eye can run ahead), the spoken word is lit as it is said, and
 * the words the script marks as load-bearing land in gold with a kick.
 *
 * Word boundaries inside a line are apportioned by scripts/short-tts.mjs, not
 * measured — see the note on wordTimes() there.
 */

import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { clamp01 } from '../scenes/engraving/rand';
import { C, FONT_UI, SHORT_W } from './theme';
import { ramp, springy, strike } from './kit';
import type { ShortLine } from './types';

const CAPTION_BASELINE = 1620;

/** Long lines step down a size or two so the block never runs past four rows. */
function sizeFor(text: string) {
  const n = text.length;
  if (n <= 22) return 108;
  if (n <= 34) return 88;
  if (n <= 48) return 76;
  if (n <= 62) return 68;
  return 60;
}

const Word: React.FC<{
  word: string;
  t: number;
  start: number;
  end: number;
  emphasis: boolean;
  size: number;
}> = ({ word, t, start, end, emphasis, size }) => {
  const spoken = t >= start;
  const active = t >= start && t < end + 0.12;

  // The hit: a fast overshoot as the word is said, settling within ~0.35s.
  const hit = spoken ? springy(t - start, 16, 26) : 0;
  const kick = strike(t, start, 11);
  const scale = 1 + (emphasis ? 0.16 : 0.07) * kick * hit;
  const lift = -10 * kick * (emphasis ? 1.4 : 1);

  // Unspoken words are a read-ahead, not decoration: they have to stay legible
  // on a phone in daylight, which the plate colour at low opacity is not.
  const color = !spoken ? C.cutDim : emphasis ? C.goldBright : C.cut;
  const opacity = !spoken ? 0.62 : 1;

  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-block',
        transform: `translateY(${lift.toFixed(2)}px) scale(${scale.toFixed(3)})`,
        color,
        opacity,
        textShadow: active
          ? `0 0 ${28 * kick + 6}px rgba(217,184,114,${(0.55 * kick).toFixed(3)}), 0 6px 18px rgba(0,0,0,0.75)`
          : '0 6px 18px rgba(0,0,0,0.75)',
        margin: `0 ${size * 0.11}px ${size * 0.3}px`,
        fontSize: size,
        lineHeight: 1.05,
      }}
    >
      {word}
      {emphasis && spoken ? (
        // The emphasis underline is struck under the word as it is spoken,
        // like a reader's pencil. Positioned absolutely so striking it never
        // reflows the line it sits under.
        <span
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: -size * 0.13,
            height: Math.max(4, size * 0.055),
            background: C.gold,
            opacity: 0.85,
            transformOrigin: 'left center',
            transform: `scaleX(${clamp01((t - start) / 0.22).toFixed(3)})`,
          }}
        />
      ) : null}
    </span>
  );
};

export const Captions: React.FC<{ lines: ShortLine[] }> = ({ lines }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  return (
    <>
      {lines.map((line, i) => {
        const next = lines[i + 1];
        const inAt = line.start - 0.16;
        const outAt = next ? next.start - 0.18 : line.end + 1.4;
        if (t < inAt - 0.2 || t > outAt + 0.35) return null;

        const enter = ramp(t, inAt, inAt + 0.18);
        const exit = 1 - ramp(t, outAt, outAt + 0.22);
        const opacity = enter * exit;
        const size = sizeFor(line.text);

        return (
          <div
            key={line.id}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: CAPTION_BASELINE,
              transform: `translateY(${((1 - enter) * 26 + (1 - exit) * -18).toFixed(1)}px)`,
              opacity,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: SHORT_W - 150,
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                alignItems: 'flex-end',
                fontFamily: FONT_UI,
                fontWeight: 800,
                letterSpacing: -1,
                transform: 'translateY(-50%)',
              }}
            >
              {line.words.map((w, j) => (
                <Word
                  key={`${line.id}-${j}`}
                  word={w.word}
                  t={t}
                  start={w.start}
                  end={w.end}
                  emphasis={w.emphasis}
                  size={size}
                />
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
};
