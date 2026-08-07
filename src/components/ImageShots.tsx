import React, { useMemo, useState } from 'react';
import { AbsoluteFill, Img, Sequence, interpolate, staticFile, useCurrentFrame } from 'remotion';
import type { ShotTiming } from '../types';
import {
  SHOT_CROSSFADE_SEC,
  KEN_BURNS_RATE_PER_SEC,
  KEN_BURNS_MIN_ZOOM,
  KEN_BURNS_MAX_ZOOM,
  KEN_BURNS_PAN_RATIO,
  KEN_BURNS_VERTICAL_DAMPING,
} from '../constants';
import { hashStringToUnitFloat } from '../lib/hash';

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

type KenBurnsImageProps = {
  imageId: string;
  // Frame relative to the shot's own true start (0 at the shot's first
  // frame), independent of the crossfade lead-in extension.
  frame: number;
  shotDurationFrames: number;
  zoomIn: boolean;
  panAngle: number;
  zoomAmount: number;
};

/**
 * A single Ken-Burns-animated background image. Scale and pan are derived
 * from the shot's own duration (see constants.ts) so short shots don't
 * whip and long shots don't stall or over-reveal edges. Missing image
 * files degrade gracefully to a dark gradient instead of failing the
 * render, since images may still be generating concurrently.
 */
const KenBurnsImage: React.FC<KenBurnsImageProps> = ({
  imageId,
  frame,
  shotDurationFrames,
  zoomIn,
  panAngle,
  zoomAmount,
}) => {
  const [failed, setFailed] = useState(false);

  const progress = clamp(frame / Math.max(1, shotDurationFrames), 0, 1);
  const maxScale = 1 + zoomAmount;
  const scale = zoomIn
    ? 1 + zoomAmount * progress
    : maxScale - zoomAmount * progress;

  // Pan grows with how far into its zoom range we are (0 at the min-scale
  // end, 1 at the max-scale end), independent of zoom direction, and is
  // sized as a small multiple of the zoom amount — comfortably inside the
  // geometric bound required to never reveal the frame edge:
  //   translate% * scale <= (scale - 1) * 50   for all scale in [1, maxScale]
  // With panMax = zoomAmount * KEN_BURNS_PAN_RATIO this holds with a large
  // safety margin across the whole zoom range used here.
  const zoomFraction = zoomIn ? progress : 1 - progress;
  const panMaxPercent = zoomAmount * KEN_BURNS_PAN_RATIO;
  const panX = panMaxPercent * zoomFraction * Math.cos(panAngle);
  const panY =
    panMaxPercent * zoomFraction * Math.sin(panAngle) * KEN_BURNS_VERTICAL_DAMPING;

  if (failed) {
    return (
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 50% 40%, #2a2018 0%, #16110c 60%, #0a0806 100%)',
        }}
      />
    );
  }

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Img
        src={staticFile(`images/${imageId}.jpg`)}
        onError={() => setFailed(true)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transformOrigin: 'center center',
          transform: `scale(${scale}) translate(${panX}%, ${panY}%)`,
        }}
      />
    </AbsoluteFill>
  );
};

type ShotLayerProps = {
  shot: ShotTiming;
  index: number;
  // Frame (relative to this layer's own <Sequence from=...>) at which the
  // shot's true start falls — the sequence itself begins earlier, during
  // the crossfade lead-in.
  localStartFrame: number;
  shotDurationFrames: number;
  crossfadeFrames: number;
};

/**
 * Renders one shot. Only fades ITSELF in (from 0 to full opacity, ending
 * exactly at its own true start) and otherwise stays fully opaque — it
 * never fades itself out. The next shot's fade-in is what visually covers
 * this one, which keeps the dissolve a clean linear cross-blend instead of
 * two independently-fading translucent layers double-darkening against the
 * black backdrop underneath.
 */
const ShotLayer: React.FC<ShotLayerProps> = ({
  shot,
  index,
  localStartFrame,
  shotDurationFrames,
  crossfadeFrames,
}) => {
  const sequenceLocalFrame = useCurrentFrame();
  const frame = sequenceLocalFrame - localStartFrame;

  const opacity = interpolate(frame, [-crossfadeFrames, 0], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const zoomAmount = clamp(
    KEN_BURNS_RATE_PER_SEC * (shot.end - shot.start),
    KEN_BURNS_MIN_ZOOM,
    KEN_BURNS_MAX_ZOOM
  );
  const zoomIn = index % 2 === 0;
  const panAngle = hashStringToUnitFloat(shot.imageId) * Math.PI * 2;

  return (
    <AbsoluteFill style={{ opacity }}>
      <KenBurnsImage
        imageId={shot.imageId}
        frame={frame}
        shotDurationFrames={shotDurationFrames}
        zoomIn={zoomIn}
        panAngle={panAngle}
        zoomAmount={zoomAmount}
      />
    </AbsoluteFill>
  );
};

type ImageShotsProps = {
  shots: ShotTiming[];
  fps: number;
  totalDurationInFrames: number;
};

export const ImageShots: React.FC<ImageShotsProps> = ({
  shots,
  fps,
  totalDurationInFrames,
}) => {
  const crossfadeFrames = Math.round(SHOT_CROSSFADE_SEC * fps);

  const layers = useMemo(() => {
    return shots.map((shot, index) => {
      const startFrame = Math.round(shot.start * fps);
      const endFrame = Math.min(
        totalDurationInFrames,
        Math.round(shot.end * fps)
      );
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
          />
        </Sequence>
      );
    });
  }, [shots, fps, crossfadeFrames, totalDurationInFrames]);

  return <AbsoluteFill style={{ backgroundColor: '#000' }}>{layers}</AbsoluteFill>;
};
