import React, { useMemo } from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import type { SentenceTiming } from '../types';
import { chunkSentence } from '../lib/chunkSentence';
import {
  SUBTITLE_FADE_SEC,
  SUBTITLE_HOLD_AFTER_SEC,
  SUBTITLE_FONT_SIZE,
  SUBTITLE_LINE_HEIGHT,
  SUBTITLE_BOTTOM_OFFSET,
  SUBTITLE_MAX_WIDTH,
} from '../constants';

type FlatChunk = {
  text: string;
  start: number;
  end: number;
  // How long this chunk is allowed to keep being displayed (with a fade
  // out) before the next chunk takes over — extended past its own `end`
  // only for the last chunk of a sentence, so a silence holds the text
  // briefly instead of blinking to nothing.
  displayEnd: number;
};

type SubtitlesProps = {
  sentences: SentenceTiming[];
  fps: number;
};

export const Subtitles: React.FC<SubtitlesProps> = ({ sentences, fps }) => {
  const frame = useCurrentFrame();
  const t = frame / fps;

  const chunks = useMemo<FlatChunk[]>(() => {
    const flat: FlatChunk[] = [];
    sentences.forEach((sentence) => {
      const sentenceChunks = chunkSentence(
        sentence.text,
        sentence.start,
        sentence.end
      );
      sentenceChunks.forEach((c, i) => {
        flat.push({
          text: c.text,
          start: c.start,
          end: c.end,
          displayEnd: c.end, // patched below for sentence-final chunks
        });
        void i;
      });
    });

    // Extend the display window of each sentence's final chunk into the
    // following silence (hold), capped so it never overlaps the next
    // chunk's own start.
    for (let i = 0; i < flat.length; i++) {
      const isLastOfItsSentence =
        i === flat.length - 1 || flat[i + 1].start > flat[i].end + 0.001;
      if (isLastOfItsSentence) {
        const nextStart = i + 1 < flat.length ? flat[i + 1].start : Infinity;
        flat[i].displayEnd = Math.min(
          flat[i].end + SUBTITLE_HOLD_AFTER_SEC,
          nextStart
        );
      }
    }

    return flat;
  }, [sentences]);

  const current = useMemo(() => {
    // Chunks are in ascending time order; find the most recent chunk that
    // has actually started (start <= t) and is still within its display
    // window. Deliberately does NOT pre-claim the upcoming chunk's lead-in
    // fade window — that would cut the still-fading-out previous chunk off
    // early whenever chunks are back-to-back. A simple reverse scan is
    // plenty fast for a few hundred chunks evaluated per frame.
    for (let i = chunks.length - 1; i >= 0; i--) {
      const c = chunks[i];
      if (c.start > t) {
        continue;
      }
      // `c` is the nearest chunk that has started by time `t`. If it's
      // still within its display window, show it; otherwise we're in a
      // silence longer than the hold, and no earlier chunk can match
      // either (they all started even earlier), so stop.
      return t <= c.displayEnd ? c : null;
    }
    return null;
  }, [chunks, t]);

  if (!current) {
    return null;
  }

  const fadeOutStart = Math.max(
    current.start + SUBTITLE_FADE_SEC,
    current.displayEnd - SUBTITLE_FADE_SEC
  );

  const opacity = interpolate(
    t,
    [current.start, current.start + SUBTITLE_FADE_SEC, fadeOutStart, current.displayEnd],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: SUBTITLE_BOTTOM_OFFSET,
          transform: 'translateX(-50%)',
          width: SUBTITLE_MAX_WIDTH,
          maxWidth: '86%',
          textAlign: 'center',
          opacity,
        }}
      >
        <span
          style={{
            display: 'inline',
            fontFamily: "'Inter', sans-serif",
            fontWeight: 600,
            fontSize: SUBTITLE_FONT_SIZE,
            lineHeight: SUBTITLE_LINE_HEIGHT,
            color: '#fbf6ec',
            letterSpacing: 0.2,
            boxDecorationBreak: 'clone',
            WebkitBoxDecorationBreak: 'clone',
            padding: '0.15em 0.45em',
            borderRadius: 10,
            background: 'rgba(8, 6, 4, 0.42)',
            boxShadow: '0 2px 24px rgba(0,0,0,0.55)',
            textShadow:
              '0 2px 10px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,0.9)',
          }}
        >
          {current.text}
        </span>
      </div>
    </AbsoluteFill>
  );
};
