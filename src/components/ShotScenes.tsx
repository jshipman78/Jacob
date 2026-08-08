import React, { useMemo } from 'react';
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { ShotTiming } from '../types';
import { SHOT_CROSSFADE_SEC } from '../constants';
import { hashStringToUnitFloat } from '../lib/hash';
import { resolveScene, sceneForShotInStyle } from '../scenes/styles/registry';

type ShotLayerProps = {
  shot: ShotTiming;
  index: number;
  /**
   * Frame (relative to this layer's own <Sequence from=...>) at which the
   * shot's true start falls — the sequence itself begins earlier, during the
   * crossfade lead-in.
   */
  localStartFrame: number;
  shotDurationFrames: number;
  crossfadeFrames: number;
  /**
   * The run's visual style, in either vocabulary ('hand-drawn' from the
   * pipeline, 'handdrawn' from the comparison reels). Omitted on the
   * hand-authored film, which renders in the base style.
   */
  style?: string;
};

/**
 * Renders one shot's background scene.
 *
 * Only fades ITSELF in (0 → full opacity, ending exactly at its own true
 * start) and otherwise stays fully opaque — it never fades itself out. The
 * next shot's fade-in is what visually covers this one, which keeps the
 * dissolve a clean linear cross-blend instead of two independently-fading
 * translucent layers double-darkening against the black backdrop underneath.
 */
const ShotLayer: React.FC<ShotLayerProps> = ({
  shot,
  index,
  localStartFrame,
  shotDurationFrames,
  crossfadeFrames,
  style,
}) => {
  const sequenceLocalFrame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const frame = sequenceLocalFrame - localStartFrame;

  const opacity = interpolate(frame, [-crossfadeFrames, 0], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // A shot carrying a `scene` came from the pipeline, which chose a scene
  // *kind* for it; one without came from the hand-authored script, whose shots
  // are placed by id. Preferring `shot.scene` is what lets --style reach a
  // generated topic at all — its shot ids are its own, so the by-id tables
  // would miss every one of them and the whole film would render as one look.
  const { Component, options } = shot.scene
    ? resolveScene(shot.scene, style)
    : sceneForShotInStyle(shot.imageId, style);

  // Scenes animate themselves against their own progress, so a shot that runs
  // 5s and one that runs 55s each reveal fully over their own duration.
  const progress = Math.min(1, Math.max(0, frame / Math.max(1, shotDurationFrames)));

  // Distinct per placement, so a scene reused later doesn't repeat verbatim.
  const seed = hashStringToUnitFloat(`${shot.imageId}:${index}`);

  return (
    <AbsoluteFill style={{ opacity }}>
      <Component
        progress={progress}
        frame={frame}
        durationInFrames={shotDurationFrames}
        fps={fps}
        seed={seed}
        options={options}
      />
    </AbsoluteFill>
  );
};

type ShotScenesProps = {
  shots: ShotTiming[];
  fps: number;
  totalDurationInFrames: number;
  /** Either vocabulary; see ShotLayerProps.style. */
  style?: string;
};

export const ShotScenes: React.FC<ShotScenesProps> = ({
  shots,
  fps,
  totalDurationInFrames,
  style,
}) => {
  const crossfadeFrames = Math.round(SHOT_CROSSFADE_SEC * fps);

  const layers = useMemo(() => {
    return shots.map((shot, index) => {
      const startFrame = Math.round(shot.start * fps);
      const endFrame = Math.min(totalDurationInFrames, Math.round(shot.end * fps));
      // Extend backward only, so this shot's fade-in can begin before its
      // official start — it never needs to render past its own true end,
      // because the following shot's fade-in fully covers it by then.
      const seqFrom = Math.max(0, startFrame - crossfadeFrames);
      const seqDuration = Math.max(1, endFrame - seqFrom);

      return (
        <Sequence
          key={`${shot.imageId}-${index}`}
          from={seqFrom}
          durationInFrames={seqDuration}
          layout="none"
        >
          <ShotLayer
            shot={shot}
            index={index}
            localStartFrame={startFrame - seqFrom}
            shotDurationFrames={endFrame - startFrame}
            crossfadeFrames={crossfadeFrames}
            style={style}
          />
        </Sequence>
      );
    });
  }, [shots, fps, crossfadeFrames, totalDurationInFrames, style]);

  return <AbsoluteFill style={{ backgroundColor: '#000' }}>{layers}</AbsoluteFill>;
};
