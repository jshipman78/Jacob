import React from 'react';
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';

import type { Timing } from './types';
import { ShotScenes } from './components/ShotScenes';
import { Vignette } from './components/Vignette';
import { Subtitles } from './components/Subtitles';
import { SectionTitles } from './components/SectionTitles';
import { OPEN_FADE_SEC, CLOSE_FADE_SEC } from './constants';

export type TroyVideoProps = {
  timing: Timing;
};

export const TroyVideo: React.FC<TroyVideoProps> = ({ timing }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const openFadeFrames = OPEN_FADE_SEC * fps;
  const closeFadeFrames = CLOSE_FADE_SEC * fps;

  const blackOverlayOpacity = interpolate(
    frame,
    [
      0,
      openFadeFrames,
      durationInFrames - closeFadeFrames,
      durationInFrames,
    ],
    [1, 0, 0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <ShotScenes
        shots={timing.shots}
        fps={timing.fps}
        totalDurationInFrames={durationInFrames}
        style={timing.style}
      />
      <Vignette />
      <SectionTitles sections={timing.sections} fps={timing.fps} />
      <Subtitles sentences={timing.sentences} fps={timing.fps} />
      <AbsoluteFill
        style={{ backgroundColor: '#000', opacity: blackOverlayOpacity, pointerEvents: 'none' }}
      />
      <Audio src={staticFile('audio/narration.wav')} />
    </AbsoluteFill>
  );
};
