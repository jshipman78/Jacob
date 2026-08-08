/**
 * The 30-second vertical short about this repository.
 *
 * Cut to the voice, exactly like the film: scripts/short-tts.mjs measures the
 * real synthesized length of every line and writes public/short-timing.json,
 * and every scene boundary, caption and word hit here is read from it. Nothing
 * in this file guesses at a duration.
 */

import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/cinzel/700.css';

import type { ShortTiming } from './types';
import { C } from './theme';
import { Plate } from './kit';
import { Captions } from './Captions';
import { Hook } from './scenes/Hook';
import { Command } from './scenes/Command';
import { Research } from './scenes/Research';
import { Claims } from './scenes/Claims';
import { Verdicts } from './scenes/Verdicts';
import { Render } from './scenes/Render';
import { Output } from './scenes/Output';
import { EndCard } from './scenes/EndCard';

const SCENES: Record<string, React.FC> = {
  hook: Hook,
  command: Command,
  research: Research,
  claims: Claims,
  verdicts: Verdicts,
  render: Render,
  output: Output,
  endcard: EndCard,
};

/** A held bar across the top: how much of the thirty seconds is left. */
const Progress: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = Math.min(1, frame / durationInFrames);
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 8, background: 'rgba(207,195,176,0.12)' }}>
      <div style={{ height: '100%', width: `${(p * 100).toFixed(2)}%`, background: C.gold }} />
    </div>
  );
};

export const ShortVideo: React.FC<{ timing: ShortTiming }> = ({ timing }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // A one-frame ink flash on every cut — the join between two engraved plates.
  const cutFlash = timing.lines.reduce((acc, line) => {
    const at = Math.round(line.sceneStart * fps);
    const d = frame - at;
    return d >= 0 && d < 4 ? Math.max(acc, 1 - d / 4) : acc;
  }, 0);

  const openFade = Math.min(1, frame / 6);
  const closeFade = Math.min(1, (durationInFrames - frame) / 9);

  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <Plate />

      {timing.lines.map((line) => {
        const Scene = SCENES[line.scene];
        if (!Scene) return null;
        const from = Math.round(line.sceneStart * fps);
        const duration = Math.max(1, Math.round(line.sceneEnd * fps) - from);
        return (
          <Sequence key={line.id} from={from} durationInFrames={duration} name={line.id}>
            <Scene />
          </Sequence>
        );
      })}

      {/* The caption layer spans the whole piece, so words never cut mid-line. */}
      <Captions lines={timing.lines} />

      <Progress />

      {/* Cut flash and the top/tail fades, above everything. */}
      <AbsoluteFill
        style={{
          background: C.cut,
          opacity: cutFlash * 0.07,
          pointerEvents: 'none',
        }}
      />
      <AbsoluteFill
        style={{
          background: '#000',
          opacity: 1 - Math.min(openFade, closeFade),
          pointerEvents: 'none',
        }}
      />

      {/* One finished track, not two stems. scripts/short-tts.mjs mixes the
          narration with the procedural bed (no licensed asset), ducks the bed
          under the speech, and masters the result to -1 dBFS peak. Passing the
          stems as two <Audio> tags instead hands the balance to Remotion's
          summing, which lands the file ~6dB quieter than anything else in a
          feed — measured, not assumed. */}
      <Audio src={staticFile('audio/short-mix.wav')} />
    </AbsoluteFill>
  );
};
