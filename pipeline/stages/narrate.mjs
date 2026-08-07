// Stage 7 — narration synthesis.
//
// This stage does not synthesize anything itself. scripts/tts.mjs already does
// per-sentence Kokoro synthesis with content-hash caching, pause insertion and
// measured (not estimated) timing, and it is the file the render pipeline was
// built around. Reimplementing it would mean maintaining two subtly different
// timelines.
//
// The only thing standing in the way of reusing it is that it imports its
// script from a fixed path and writes its output to a fixed path — both
// derived from its own location on disk. So instead of editing it, the stage
// materialises a *runtime overlay*: a throwaway mirror of scripts/ under
// pipeline/work/<slug>/rt/, with the generated script in place of the
// hand-authored one. Running the mirrored copy makes every path it computes
// land inside the overlay.
//
// The consequences are worth stating plainly, because they are the reason for
// the design: the repository's public/timing.json and public/audio/ are never
// touched, the Troy video keeps building, two topics can be produced
// concurrently without colliding, and scripts/tts.mjs stays the single
// implementation of the timeline. The overlay is rebuilt from scripts/ on
// every run, so it cannot drift from the original.

import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, writeFileSync, symlinkSync, rmSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { runStage } from '../core/cache.mjs';
import { info, step, warn, PipelineError } from '../core/log.mjs';
import {
  ROOT, REPO_SCRIPTS, SHARED_CACHE, ensureDir, rel,
  overlayDir, overlayScripts, overlayPublic, overlayTiming, overlayAudio,
} from '../core/paths.mjs';
import { PAUSE as REPO_PAUSE } from '../../scripts/script-data.mjs';

export const NARRATE_VERSION = 3;

/** Files mirrored into the overlay, verbatim, on every run. */
const MIRRORED = ['tts.mjs', 'voices.mjs', 'kokoro_worker.py', 'validate-build.mjs'];

// ---------------------------------------------------------------------------
// Emitting the generated script module
// ---------------------------------------------------------------------------

const q = (s) => JSON.stringify(s);

/**
 * Renders script.json + visuals.json into the exact module shape
 * scripts/tts.mjs consumes: SECTIONS, PAUSE, IMAGES, STYLE_SUFFIX.
 */
export function renderScriptDataModule({ script, visuals, topic }) {
  // The pause table is the shared contract between the written script and the
  // audio timeline. Generating a copy that has silently drifted from the one
  // scripts/tts.mjs was tuned against would desynchronise every cut.
  const pause = { ...REPO_PAUSE };

  const sections = script.sections.map((sec) => {
    const paragraphs = sec.paragraphs.map((par) => {
      const sentences = par.sentences.map((s) =>
        s.tts ? `      S(${q(s.text)}, ${q(s.tts)}),` : `      S(${q(s.text)}),`
      );
      return [
        '    {',
        `      image: ${q(par.shot)},`,
        '      sentences: [',
        ...sentences.map((l) => `  ${l}`),
        '      ],',
        `      pauseAfter: ${q(par.pauseAfter)},`,
        '    },',
      ].join('\n');
    });
    return [
      '  {',
      `    id: ${q(sec.id)},`,
      `    title: ${q(sec.title)},`,
      '    paragraphs: [',
      ...paragraphs,
      '    ],',
      '  },',
    ].join('\n');
  });

  const images = visuals.shots.map((s) =>
    ['  {', `    id: ${q(s.id)},`, `    prompt: ${q(s.prompt)},`, '  },'].join('\n')
  );

  return `// GENERATED FILE — do not edit.
//
// Produced by pipeline/stages/narrate.mjs for topic ${q(topic)}.
// Same shape as scripts/script-data.mjs, which is the contract the TTS and
// render machinery consumes. Regenerate by re-running the pipeline.

const S = (text, tts = null) => ({ text, ...(tts ? { tts } : {}) });

export const TOPIC = ${q(topic)};
export const TITLE = ${q(script.title)};
export const STYLE = ${q(visuals.style)};

export const PAUSE = ${JSON.stringify(pause, null, 2)};

export const SECTIONS = [
${sections.join('\n')}
];

export const STYLE_SUFFIX = ${q(visuals.artDirection)};

export const IMAGES = [
${images.join('\n')}
];
`;
}

// ---------------------------------------------------------------------------
// Overlay
// ---------------------------------------------------------------------------

function link(target, linkPath) {
  if (existsSync(linkPath)) rmSync(linkPath, { recursive: true, force: true });
  symlinkSync(target, linkPath);
}

export function materializeOverlay({ slug, script, visuals, topic }) {
  const dir = ensureDir(overlayDir(slug));
  const scripts = ensureDir(overlayScripts(slug));

  for (const file of MIRRORED) {
    const src = path.join(REPO_SCRIPTS, file);
    if (!existsSync(src)) {
      throw new PipelineError(
        `scripts/${file} is missing, so the narration pipeline cannot be reused.`,
        'This pipeline invokes the repository\'s existing TTS machinery rather than duplicating it. ' +
          'Restore the file or check out a complete tree.'
      );
    }
    copyFileSync(src, path.join(scripts, file));
  }

  const generated = renderScriptDataModule({ script, visuals, topic });
  writeFileSync(path.join(scripts, 'script-data.mjs'), generated);

  // Share the Kokoro model weights and the per-utterance cache with the repo,
  // so a re-run costs nothing for sentences that have not changed.
  ensureDir(SHARED_CACHE);
  link(SHARED_CACHE, path.join(dir, '.cache'));
  // validate-build.mjs shells out to `npx remotion ffprobe`.
  link(path.join(ROOT, 'node_modules'), path.join(dir, 'node_modules'));
  ensureDir(overlayPublic(slug));

  return { dir, scriptsDir: scripts };
}

// ---------------------------------------------------------------------------
// Running the mirrored TTS
// ---------------------------------------------------------------------------

function run(cmd, args, cwd, { capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { cwd, stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit' });
    let out = '';
    if (capture) {
      child.stdout.on('data', (d) => (out += d.toString()));
      child.stderr.on('data', (d) => (out += d.toString()));
    }
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, out }));
  });
}

/**
 * Runs the overlay's validate-build.mjs. Image artwork is optional for this
 * pipeline — the composition renders procedural scenes rather than stills — so
 * artwork problems are reported as warnings while everything else still fails
 * the build.
 */
async function validateOverlay(slug) {
  const { code, out } = await run('node', ['scripts/validate-build.mjs'], overlayDir(slug), { capture: true });
  if (code === 0) {
    for (const line of out.split('\n').filter((l) => l.trim().startsWith('  ') && l.trim())) step(line.trim());
    return { ok: true, imageOnly: false };
  }
  const problems = out
    .split('--- PROBLEMS ---')[1]
    ?.split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !/^\d+ problem/.test(l)) ?? [];
  const imageRe = /image|artwork|public\/images/i;
  const nonImage = problems.filter((p) => !imageRe.test(p));
  if (nonImage.length === 0 && problems.length) {
    warn(`validate-build reported only artwork gaps (${problems.length}); this pipeline renders procedural scenes, so they are not blocking.`);
    return { ok: true, imageOnly: true, problems };
  }
  throw new PipelineError(
    'The reused validate-build gate rejected the generated narration.',
    (nonImage.length ? nonImage : problems).map((p) => `  ${p}`).join('\n') || out.slice(-1500)
  );
}

// ---------------------------------------------------------------------------
// Timing enrichment
// ---------------------------------------------------------------------------

/**
 * Adds the additive fields the scene layer needs. scripts/tts.mjs owns the
 * schema; this only appends to it, so anything reading the old shape still
 * works. See docs/CONTRACT.md §5.
 */
export function enrichTiming({ slug, script, visuals, topic, styleId, effectiveStyleId }) {
  const p = overlayTiming(slug);
  const timing = JSON.parse(readFileSync(p, 'utf8'));
  const sceneById = new Map(visuals.shots.map((s) => [s.id, s.scene]));

  let missing = 0;
  timing.shots = timing.shots.map((shot) => {
    const scene = sceneById.get(shot.imageId);
    if (!scene) missing += 1;
    return { ...shot, scene: scene ?? { kind: 'atmosphere', options: { mood: 'dusk' } } };
  });
  timing.style = effectiveStyleId;
  timing.requestedStyle = styleId;
  timing.topic = topic;
  timing.title = script.title;
  timing.thesis = script.thesis;

  writeFileSync(p, JSON.stringify(timing, null, 2));
  if (missing) warn(`${missing} shot(s) had no visual assignment and fell back to atmosphere.`);
  return timing;
}

// ---------------------------------------------------------------------------
// Stage
// ---------------------------------------------------------------------------

export async function narrateStage({
  slug, topic, script, scriptKey, visuals, visualsKey, styleId, effectiveStyleId, voice, force = false,
}) {
  return runStage({
    slug,
    stage: 'narrate',
    version: NARRATE_VERSION,
    inputs: { topic, scriptKey, visualsKey, voice, effectiveStyleId },
    force,
    detail: `voice ${voice}`,
    async produce() {
      materializeOverlay({ slug, script, visuals, topic });
      step(`overlay materialized at ${rel(overlayDir(slug))}`);

      const { code } = await run('node', ['scripts/tts.mjs', `--voice=${voice}`], overlayDir(slug));
      if (code !== 0) {
        throw new PipelineError(
          `Narration synthesis failed (scripts/tts.mjs exited ${code}).`,
          'The Kokoro model weights live in .cache/kokoro/. If they are missing, run the Troy build once ' +
            '(`node scripts/tts.mjs`) to populate them, or see README.md → Requirements.'
        );
      }

      if (!existsSync(overlayTiming(slug)) || !existsSync(overlayAudio(slug))) {
        throw new PipelineError('Narration completed but produced no timing.json or narration.wav.');
      }

      const timing = enrichTiming({ slug, script, visuals, topic, styleId, effectiveStyleId });
      const validation = await validateOverlay(slug);

      const mins = Math.floor(timing.durationSec / 60);
      info(
        `narration ${mins}:${String(Math.round(timing.durationSec % 60)).padStart(2, '0')} · ` +
          `${timing.sentences.length} sentences · ${timing.shots.length} shots · style "${timing.style}"`
      );

      return {
        durationSec: timing.durationSec,
        fps: timing.fps,
        sentenceCount: timing.sentences.length,
        shotCount: timing.shots.length,
        sectionCount: timing.sections.length,
        style: timing.style,
        voice,
        timingPath: rel(overlayTiming(slug)),
        audioPath: rel(overlayAudio(slug)),
        validation,
      };
    },
  });
}
