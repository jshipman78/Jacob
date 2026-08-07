// Per-stage, content-addressed, resumable caching.
//
// Modelled directly on how scripts/tts.mjs caches individual utterances: hash
// the inputs, and if a artifact for that hash already exists on disk, skip the
// work. Applied at stage granularity here, because the expensive stages
// (research, fact-check, script writing, synthesis, render) are minutes each
// and a crash at render time must never cost a re-run of research.
//
// A stage's cache key covers: the topic, the stage's own declared version, and
// the resolved keys of every upstream stage it consumed. So editing a prompt
// (bump the version) or re-running research invalidates exactly the downstream
// stages that depended on it, and nothing else.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { stagePath, workDir, ensureDir, rel } from './paths.mjs';
import { cached, stageStart, stageEnd } from './log.mjs';

const stableStringify = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
    .join(',')}}`;
};

export const hashOf = (value) => createHash('sha256').update(stableStringify(value)).digest('hex').slice(0, 16);

/** Reads a stage artifact, or null when absent/corrupt. */
export function readStage(slug, stage) {
  const p = stagePath(slug, stage);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

export function writeStage(slug, stage, envelope) {
  const p = stagePath(slug, stage);
  ensureDir(path.dirname(p));
  writeFileSync(p, JSON.stringify(envelope, null, 2));
  return p;
}

export function clearStage(slug, stage) {
  const p = stagePath(slug, stage);
  if (existsSync(p)) rmSync(p);
}

/**
 * Run a stage, or return its cached artifact.
 *
 * @param {object} o
 * @param {string} o.slug
 * @param {string} o.stage      Stage id, e.g. 'research'.
 * @param {number} o.version    Bump when the stage's logic or prompt changes.
 * @param {object} o.inputs     Anything the output depends on (topic, flags, upstream keys).
 * @param {boolean} [o.force]   Ignore any cached artifact.
 * @param {string} [o.detail]   Extra text for the stage banner.
 * @param {() => Promise<any>} o.produce
 * @returns {Promise<{key:string, data:any, fromCache:boolean, path:string}>}
 */
export async function runStage({ slug, stage, version, inputs, force = false, detail = '', produce }) {
  const key = hashOf({ stage, version, inputs });
  const existing = readStage(slug, stage);

  if (!force && existing && existing.key === key) {
    cached(`${stage} (${rel(stagePath(slug, stage))})`);
    return { key, data: existing.data, fromCache: true, path: stagePath(slug, stage) };
  }
  if (!force && existing && existing.key !== key) {
    stageStart(stage, `inputs changed — regenerating${detail ? ` · ${detail}` : ''}`);
  } else {
    stageStart(stage, detail);
  }

  const data = await produce();
  const envelope = { stage, version, key, generatedAt: new Date().toISOString(), slug, data };
  const p = writeStage(slug, stage, envelope);
  stageEnd(stage, rel(p));
  return { key, data, fromCache: false, path: p };
}

/** Every stage artifact currently on disk, for `--status`. */
export function stageStatus(slug, stages) {
  return stages.map((stage) => {
    const e = readStage(slug, stage);
    return { stage, present: Boolean(e), key: e?.key ?? null, generatedAt: e?.generatedAt ?? null };
  });
}

export const workDirFor = workDir;
