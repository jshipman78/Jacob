// Stage 8 — render.
//
// Remotion is invoked, not wrapped. The composition, its components and its
// scene layer all belong to src/ and are consumed as they are; the only thing
// this stage controls is which public directory Remotion reads, which is what
// lets a generated topic render from its own overlay while the repository's
// Troy build stays exactly where it is.
//
// Style comparison works the same way. A style only changes the scene
// assignment and the `style` field in timing.json — never the narration, never
// the audio — so a comparison run reuses one synthesis and renders the same
// span of the same film once per style, into its own public directory.

import { spawn } from 'node:child_process';
import { existsSync, writeFileSync, readFileSync, symlinkSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { info, step, warn, PipelineError, dim } from '../core/log.mjs';
import { ROOT, ensureDir, rel, overlayDir, overlayPublic, overlayTiming, outDir } from '../core/paths.mjs';
import { STYLES } from '../core/styles.mjs';

export const DEFAULT_COMPOSITION = 'TroyVideo';

function run(cmd, args, { cwd = ROOT, capture = false } = {}) {
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

/** Confirms the composition the pipeline is about to render actually exists. */
export async function assertComposition(id) {
  const { code, out } = await run('npx', ['remotion', 'compositions', 'src/index.ts'], { capture: true });
  if (code !== 0) {
    warn('Could not enumerate Remotion compositions; proceeding and letting the render report any problem.');
    return;
  }
  // Remotion prints a banner, then "The following compositions are available:",
  // then one "<id> <fps> <WxH> <frames>" row per composition.
  const table = out.split(/The following compositions are available:/i)[1] ?? '';
  const ids = table
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^[A-Za-z][\w-]*\s+\d+\s+\d+x\d+/.test(l))
    .map((l) => l.split(/\s+/)[0]);
  if (!ids.includes(id)) {
    throw new PipelineError(
      `The Remotion composition "${id}" does not exist in src/index.ts.`,
      `Available compositions: ${ids.join(', ') || '(none found)'}.\n` +
        'Pass --composition=<id> to target a different one. The composition and its scenes belong to ' +
        'src/, which this pipeline consumes but does not own.'
    );
  }
}

// ---------------------------------------------------------------------------
// Full render
// ---------------------------------------------------------------------------

export async function renderVideo({
  slug, composition = DEFAULT_COMPOSITION, publicDir, outPath, frames = null, concurrency = null, label = 'render',
}) {
  ensureDir(path.dirname(outPath));
  const args = ['remotion', 'render', composition, outPath, `--public-dir=${publicDir}`];
  if (frames) args.push(`--frames=${frames[0]}-${frames[1]}`);
  if (concurrency) args.push(`--concurrency=${concurrency}`);

  step(`${label}: ${dim(`npx ${args.join(' ')}`)}`);
  const started = Date.now();
  const { code } = await run('npx', args);
  if (code !== 0) {
    throw new PipelineError(
      `Remotion exited ${code} while rendering ${label}.`,
      'The composition and its scenes live in src/, which this pipeline does not own. If the failure is ' +
        'inside a scene component, that is a scene-layer issue; if it is about timing.json, re-run with ' +
        '--refresh=narrate.'
    );
  }
  if (!existsSync(outPath)) throw new PipelineError(`Remotion reported success but ${rel(outPath)} does not exist.`);
  const mb = statSync(outPath).size / 1e6;
  info(`${rel(outPath)} — ${mb.toFixed(1)} MB in ${((Date.now() - started) / 1000).toFixed(0)}s`);
  return { path: outPath, bytes: statSync(outPath).size, seconds: (Date.now() - started) / 1000 };
}

// ---------------------------------------------------------------------------
// Choosing a representative span
// ---------------------------------------------------------------------------

/**
 * Finds the window of `seconds` that shows the most distinct scene kinds, so a
 * style sample demonstrates the style's range rather than whichever scene
 * happens to open the film. Ties break toward the earliest window, which keeps
 * the cold open when nothing else distinguishes it.
 */
export function pickSampleWindow(timing, seconds) {
  const total = timing.durationSec;
  if (total <= seconds) return { start: 0, end: total, reason: 'the whole film is shorter than the sample length' };

  let best = { start: 0, score: -1, kinds: 0 };
  for (const shot of timing.shots) {
    for (const candidate of [shot.start, Math.max(0, shot.end - seconds)]) {
      const start = Math.min(Math.max(0, candidate), total - seconds);
      const end = start + seconds;
      const inWindow = timing.shots.filter((s) => s.end > start && s.start < end);
      const kinds = new Set(inWindow.map((s) => s.scene?.kind ?? 'atmosphere')).size;
      // Prefer variety, then more cuts, then earlier.
      const score = kinds * 100 + inWindow.length - start / total;
      if (score > best.score) best = { start, score, kinds, cuts: inWindow.length };
    }
  }
  return {
    start: best.start,
    end: best.start + seconds,
    reason: `${best.kinds} distinct scene kinds across ${best.cuts} shots`,
  };
}

export const secondsToFrames = (t, fps) => Math.max(0, Math.round(t * fps));

// ---------------------------------------------------------------------------
// Style comparison
// ---------------------------------------------------------------------------

/**
 * Builds a public directory for one style: its own timing.json, and the shared
 * narration audio symlinked in rather than copied.
 */
function styleSandbox(slug, styleId, timing, visualsForStyle) {
  const dir = ensureDir(path.join(overlayDir(slug), 'compare', styleId));
  const sceneById = new Map(visualsForStyle.shots.map((s) => [s.id, s.scene]));
  const patched = {
    ...timing,
    style: styleId,
    shots: timing.shots.map((s) => ({ ...s, scene: sceneById.get(s.imageId) ?? s.scene })),
  };
  writeFileSync(path.join(dir, 'timing.json'), JSON.stringify(patched, null, 2));

  const audioLink = path.join(dir, 'audio');
  if (existsSync(audioLink)) rmSync(audioLink, { recursive: true, force: true });
  symlinkSync(path.join(overlayPublic(slug), 'audio'), audioLink);

  const imagesSrc = path.join(overlayPublic(slug), 'images');
  if (existsSync(imagesSrc)) {
    const imagesLink = path.join(dir, 'images');
    if (existsSync(imagesLink)) rmSync(imagesLink, { recursive: true, force: true });
    symlinkSync(imagesSrc, imagesLink);
  }
  return dir;
}

/**
 * Renders the same span of the same film once per style.
 *
 * @param {object} o
 * @param {(styleId:string) => Promise<object>} o.visualsFor  Resolves per-style scene assignment.
 * @param {string[]} o.styleIds  Styles to render.
 */
export async function compareStyles({
  slug, styleIds, visualsFor, seconds = 60, composition = DEFAULT_COMPOSITION, concurrency = null,
}) {
  const timing = JSON.parse(readFileSync(overlayTiming(slug), 'utf8'));
  const window = pickSampleWindow(timing, seconds);
  const frames = [secondsToFrames(window.start, timing.fps), secondsToFrames(window.end, timing.fps) - 1];
  info(
    `Sampling ${window.start.toFixed(1)}s–${window.end.toFixed(1)}s (frames ${frames[0]}–${frames[1]}) — ` +
      `chosen for ${window.reason}.`
  );

  const dest = ensureDir(path.join(outDir(slug), 'compare'));
  const results = [];
  for (const styleId of styleIds) {
    step(`style "${styleId}" (${STYLES[styleId]?.label ?? styleId})`);
    // eslint-disable-next-line no-await-in-loop
    const visuals = await visualsFor(styleId);
    const publicDir = styleSandbox(slug, styleId, timing, visuals);
    const outPath = path.join(dest, `${styleId}.mp4`);
    try {
      // eslint-disable-next-line no-await-in-loop
      const r = await renderVideo({
        slug, composition, publicDir, outPath, frames, concurrency, label: `compare/${styleId}`,
      });
      results.push({ styleId, ok: true, ...r });
    } catch (err) {
      warn(`style "${styleId}" failed to render: ${err.message}`);
      results.push({ styleId, ok: false, error: err.message });
    }
  }

  const indexPath = path.join(dest, 'index.html');
  writeFileSync(indexPath, contactSheet({ slug, timing, window, results }));
  info(`Contact sheet: ${rel(indexPath)}`);
  return { window, frames, results, indexPath };
}

function contactSheet({ slug, timing, window, results }) {
  const cards = results
    .map((r) => {
      const s = STYLES[r.styleId];
      const body = r.ok
        ? `<video src="${r.styleId}.mp4" controls preload="metadata" playsinline></video>`
        : `<div class="err">Did not render.<br><code>${escapeHtml(r.error ?? '')}</code></div>`;
      return `<figure>
  <figcaption><b>${escapeHtml(s?.label ?? r.styleId)}</b><code>--style=${escapeHtml(r.styleId)}</code></figcaption>
  ${body}
  <p>${escapeHtml(s?.summary ?? '')}</p>
</figure>`;
    })
    .join('\n');

  return `<!doctype html><meta charset="utf-8"><title>Style comparison — ${escapeHtml(timing.title ?? slug)}</title>
<style>
:root{color-scheme:dark;--bg:#0b0a0c;--fg:#e8e2d6;--dim:#8d8477;--gold:#d9b872}
body{margin:0;padding:40px;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,-apple-system,sans-serif}
h1{font-size:26px;margin:0 0 4px}h1 span{color:var(--gold)}
.meta{color:var(--dim);margin:0 0 32px;font-size:14px}
.grid{display:grid;gap:28px;grid-template-columns:repeat(auto-fit,minmax(440px,1fr))}
figure{margin:0;background:#131114;border:1px solid #262227;border-radius:10px;overflow:hidden}
figcaption{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:14px 16px;border-bottom:1px solid #262227}
figcaption code{color:var(--gold);font-size:13px}
video{width:100%;display:block;background:#000}
figure p{margin:0;padding:14px 16px;color:var(--dim);font-size:14px}
.err{padding:28px 16px;color:#e0776b}
</style>
<h1>${escapeHtml(timing.title ?? slug)} — <span>style comparison</span></h1>
<p class="meta">Same narration, same ${(window.end - window.start).toFixed(0)}-second span
(${window.start.toFixed(1)}s–${window.end.toFixed(1)}s), one render per style.
Chosen for ${escapeHtml(window.reason)}. Pick one, then run the full render with that <code>--style</code>.</p>
<div class="grid">
${cards}
</div>
`;
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
