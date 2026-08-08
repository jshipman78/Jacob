import React from 'react';
import { AbsoluteFill } from 'remotion';
import {
  VIGNETTE_EDGE_OPACITY,
  GRADE_WARMTH_OPACITY,
  GRADE_DARKEN_OPACITY,
} from '../constants';

/**
 * Cohesive grade + vignette overlay sat above the imagery and below the
 * text layers. Keeps the varied AI artwork feeling like one graded piece,
 * and darkens the edges/bottom just enough to keep subtitles legible
 * without ever reading as a heavy filter.
 */
export const Vignette: React.FC = () => {
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {/* Warm, slightly desaturating overall tint. */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, rgba(20,14,8,${GRADE_DARKEN_OPACITY * 0.6}) 0%, rgba(20,14,8,0) 30%, rgba(20,14,8,0) 60%, rgba(10,7,4,${GRADE_DARKEN_OPACITY}) 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 42%, rgba(120,80,30,0) 0%, rgba(120,80,30,${GRADE_WARMTH_OPACITY}) 100%)`,
          mixBlendMode: 'multiply',
        }}
      />
      {/* Edge vignette. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,${VIGNETTE_EDGE_OPACITY}) 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
