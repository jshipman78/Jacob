import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';

import type { Timing } from './types';
import { ShotScenes } from './components/ShotScenes';
import { Vignette } from './components/Vignette';
import { Subtitles } from './components/Subtitles';
import { SectionTitles } from './components/SectionTitles';
import type { StyleId } from './scenes/styles/registry';
import { STYLE_LABELS } from './scenes/styles/registry';

/**
 * A one-minute excerpt of the real film in one of the candidate visual
 * directions, for side-by-side comparison.
 *
 * Everything except the background treatment is held identical across the four
 * reels — same narration, same timing, same subtitles, same section titles,
 * same window — so what you are comparing is only the style.
 *
 * The window is expressed as a start frame on the MASTER timeline; the whole
 * layer stack is shifted by a negative-offset Sequence so that master frame
 * `startFrame` plays as frame 0 of the reel, and the audio is offset to match.
 */

export type StyleReelProps = {
  timing: Timing;
  style: StyleId;
  /** Frame on the master timeline where this excerpt begins. */
  startFrame: number;
  /** Total frames on the master timeline, so shot layout is unchanged. */
  masterDurationInFrames: number;
};

export const StyleReel: React.FC<StyleReelProps> = ({
  timing, style, startFrame, masterDurationInFrames,
}) => {
  const { durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      {/*
        Negative offset: children see (reelFrame + startFrame), i.e. their real
        position on the master timeline. Shot boundaries, subtitle timings and
        each scene's own progress are therefore byte-identical to the full
        film — the excerpt is a window onto it, not a re-cut.
      */}
      <Sequence
        from={-startFrame}
        durationInFrames={masterDurationInFrames}
        layout="none"
      >
        <AbsoluteFill>
          <ShotScenes
            shots={timing.shots}
            fps={timing.fps}
            totalDurationInFrames={masterDurationInFrames}
            style={style}
          />
          <Vignette />
          <SectionTitles sections={timing.sections} fps={timing.fps} />
          <Subtitles sentences={timing.sentences} fps={timing.fps} />
        </AbsoluteFill>
      </Sequence>

      <Audio src={staticFile('audio/narration.wav')} startFrom={startFrame} />

      {/* Style slate, so a reel is never ambiguous about what it is showing. */}
      <div
        style={{
          position: 'absolute',
          left: 40,
          top: 34,
          padding: '9px 18px',
          background: 'rgba(0,0,0,0.62)',
          borderLeft: '3px solid #d9b872',
          fontFamily: "'Inter', sans-serif",
          fontWeight: 700,
          fontSize: 22,
          letterSpacing: 2.4,
          color: '#f0d38f',
          textTransform: 'uppercase',
        }}
      >
        {STYLE_LABELS[style]}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 40,
          top: 78,
          fontFamily: "'Inter', sans-serif",
          fontWeight: 600,
          fontSize: 15,
          letterSpacing: 1.6,
          color: 'rgba(255,255,255,0.55)',
          textShadow: '0 2px 8px rgba(0,0,0,0.9)',
        }}
      >
        {style === 'handdrawn'
          ? 'Finished direction'
          : 'Comparison sketch — this window only'}
      </div>

      {/* Fade the reel up and out so it plays as a clip, not a hard cut. */}
      <FadeEdges durationInFrames={durationInFrames} />
    </AbsoluteFill>
  );
};

const FadeEdges: React.FC<{ durationInFrames: number }> = ({ durationInFrames }) => {
  const { fps } = useVideoConfig();
  return (
    <Sequence from={0} durationInFrames={durationInFrames} layout="none">
      <EdgeOverlay durationInFrames={durationInFrames} fps={fps} />
    </Sequence>
  );
};

const EdgeOverlay: React.FC<{ durationInFrames: number; fps: number }> = ({
  durationInFrames, fps,
}) => {
  const frame = useCurrentFrame();
  const fade = Math.round(fps * 0.5);
  const o =
    frame < fade
      ? 1 - frame / fade
      : frame > durationInFrames - fade
      ? (frame - (durationInFrames - fade)) / fade
      : 0;
  if (o <= 0.001) return null;
  return (
    <AbsoluteFill
      style={{ backgroundColor: '#000', opacity: Math.min(1, o), pointerEvents: 'none' }}
    />
  );
};
