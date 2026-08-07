import React, { useMemo } from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import type { SectionTiming } from '../types';
import {
  TITLE_CARD_FADE_IN_SEC,
  TITLE_CARD_FADE_OUT_SEC,
  TITLE_CARD_DURATION_SEC,
  MAIN_TITLE_FADE_IN_SEC,
  MAIN_TITLE_FADE_OUT_SEC,
  MAIN_TITLE_DURATION_SEC,
  GOLD,
  GOLD_BRIGHT,
} from '../constants';

type SectionTitlesProps = {
  sections: SectionTiming[];
  fps: number;
};

export const SectionTitles: React.FC<SectionTitlesProps> = ({ sections, fps }) => {
  const frame = useCurrentFrame();
  const t = frame / fps;

  const active = useMemo(() => {
    for (let i = 0; i < sections.length; i++) {
      const isMain = i === 0;
      const duration = isMain ? MAIN_TITLE_DURATION_SEC : TITLE_CARD_DURATION_SEC;
      const cardEnd = Math.min(sections[i].start + duration, sections[i].end);
      if (t >= sections[i].start && t <= cardEnd) {
        return { section: sections[i], isMain, cardEnd };
      }
    }
    return null;
  }, [sections, t]);

  if (!active) {
    return null;
  }

  const { section, isMain, cardEnd } = active;
  const fadeIn = isMain ? MAIN_TITLE_FADE_IN_SEC : TITLE_CARD_FADE_IN_SEC;
  const fadeOut = isMain ? MAIN_TITLE_FADE_OUT_SEC : TITLE_CARD_FADE_OUT_SEC;

  const opacity = interpolate(
    t,
    [
      section.start,
      section.start + fadeIn,
      Math.max(section.start + fadeIn, cardEnd - fadeOut),
      cardEnd,
    ],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // A gentle upward drift as the card fades, so it feels placed rather than
  // static — restrained, a few pixels only.
  const driftPx = interpolate(t, [section.start, cardEnd], [10, -6], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const fontSize = isMain ? 88 : 52;
  const letterSpacing = isMain ? 6 : 5;
  const ruleWidth = isMain ? 220 : 140;

  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          opacity,
          transform: `translateY(${driftPx}px)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: isMain ? 28 : 20,
          maxWidth: '80%',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: ruleWidth,
            height: 1,
            background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
          }}
        />
        <div
          style={{
            fontFamily: "'Cinzel', serif",
            fontWeight: isMain ? 700 : 600,
            fontSize,
            letterSpacing,
            color: isMain ? GOLD_BRIGHT : GOLD,
            textTransform: 'uppercase',
            lineHeight: 1.3,
            textShadow:
              '0 2px 28px rgba(0,0,0,0.75), 0 1px 4px rgba(0,0,0,0.9)',
          }}
        >
          {section.title}
        </div>
        <div
          style={{
            width: ruleWidth,
            height: 1,
            background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
