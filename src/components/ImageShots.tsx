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
  // frame), independent of any crossfade sequence-extension offset.
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
  // Both expressed relative to this layer's own <Sequence from=...>, i.e.
  // the frame at which the shot's true (non-crossfade-extended) window
  // starts/ends within this sequence's local time.
  localStartFrame: number;
  localEndFrame: number;
  crossfadeFrames: number;
};

const ShotLayer: React.FC<ShotLayerProps> = ({
  shot,
  index,
  localStartFrame,
  localEndFrame,
  crossfadeFrames,
}) => {
  // useCurrentFrame() inside a <Sequence> is already relative to that
  // sequence's `from` — shift it again so 0 lands on the shot's true start.
  const sequenceLocalFrame = useCurrentFrame();
  const frame = sequenceLocalFrame - localStartFrame;
  const shotDurationFrames = localEndFrame - localStartFrame;

  const opacity = interpolate(
    frame,
    [
      -crossfadeFrames / 2,
      crossfadeFrames / 2,
      shotDurationFrames - crossfadeFrames / 2,
      shotDurationFrames + crossfadeFrames / 2,
    ],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

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
  const halfCrossfadeFrames = Math.round(crossfadeFrames / 2);

  const layers = useMemo(() => {
    return shots.map((shot, index) => {
      const startFrame = Math.round(shot.start * fps);
      const endFrame = Math.round(shot.end * fps);
      const seqFrom = Math.max(0, startFrame - halfCrossfadeFrames);
      const seqEnd = Math.min(totalDurationInFrames, endFrame + halfCrossfadeFrames);
      const seqDuration = Math.max(1, seqEnd - seqFrom);

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
            localEndFrame={endFrame - seqFrom}
            crossfadeFrames={crossfadeFrames}
          />
        </Sequence>
      );
    });
  }, [shots, fps, crossfadeFrames, halfCrossfadeFrames, totalDurationInFrames]);

  return <AbsoluteFill style={{ backgroundColor: '#000' }}>{layers}</AbsoluteFill>;
};
