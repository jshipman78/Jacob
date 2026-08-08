// Canonical filesystem layout for the documentary pipeline.
//
// Everything the pipeline generates lives under pipeline/work/<slug>/ (working
// state, cached per stage) and out/<slug>/ (deliverables). Nothing outside
// those two trees is ever written to, which is what lets this pipeline run in
// the same repo as the hand-authored Troy video without disturbing it.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Repository root. */
export const ROOT = path.resolve(__dirname, '..', '..');

/** The hand-authored scripts we reuse (never edit, only invoke/materialize). */
export const REPO_SCRIPTS = path.join(ROOT, 'scripts');

/** Where all generated working state lives. */
export const WORK_ROOT = path.join(ROOT, 'pipeline', 'work');

/** Shared TTS utterance cache — deliberately the same one scripts/tts.mjs uses. */
export const SHARED_CACHE = path.join(ROOT, '.cache');

/**
 * Turns a free-text topic into a stable directory-safe slug.
 * "The Fall of Carthage" -> "the-fall-of-carthage"
 */
export function slugify(topic) {
  const slug = String(topic)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  if (!slug) throw new Error(`Topic "${topic}" does not contain any usable characters for a slug.`);
  return slug;
}

/** pipeline/work/<slug>/ — cached stage outputs, the render overlay, logs. */
export const workDir = (slug) => path.join(WORK_ROOT, slug);

/** pipeline/work/<slug>/stages/<stage>.json — one resumable stage artifact. */
export const stagePath = (slug, stage) => path.join(workDir(slug), 'stages', `${stage}.json`);

/**
 * pipeline/work/<slug>/rt/ — the "runtime overlay".
 *
 * A throwaway mirror of scripts/ with the generated script-data.mjs dropped in
 * place of the hand-authored one. scripts/tts.mjs computes all of its paths
 * from its own location, so running the mirrored copy makes it write its
 * narration.wav and timing.json into the overlay instead of the repo's public/
 * directory. That is how this pipeline reuses the TTS machinery verbatim
 * without ever clobbering the Troy build.
 */
export const overlayDir = (slug) => path.join(workDir(slug), 'rt');
export const overlayScripts = (slug) => path.join(overlayDir(slug), 'scripts');
export const overlayPublic = (slug) => path.join(overlayDir(slug), 'public');
export const overlayTiming = (slug) => path.join(overlayPublic(slug), 'timing.json');
export const overlayAudio = (slug) => path.join(overlayPublic(slug), 'audio', 'narration.wav');

/** out/<slug>/ — the deliverables: the mp4, citations, the script transcript. */
export const outDir = (slug) => path.join(ROOT, 'out', slug);

export function ensureDir(p) {
  mkdirSync(p, { recursive: true });
  return p;
}

/** Path relative to the repo root, for readable log lines. */
export const rel = (p) => path.relative(ROOT, p) || '.';
