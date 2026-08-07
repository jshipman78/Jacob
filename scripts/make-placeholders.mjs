#!/usr/bin/env node
// Generates atmospheric, on-theme placeholder artwork for all 29 shots of
// "The Man Who Lied His Way to Troy" into public/images/<id>.jpg at
// 1920x1080. These stand in for the real AI-generated stills until a
// provider credential is available (see scripts/gen-images.mjs) — they are
// what the editor sees on every draft render in the meantime, so they're
// built to read as deliberate art direction, not broken-asset boxes.
//
// Each id gets a different but fully deterministic composition: a hash of
// the id picks a layout template (diagonal strata / horizontal strata /
// central glow / vertical trench cut / scattered glow), a hue position
// within the shared gold-amber-bronze palette, and the placement, size and
// intensity of every gradient, band, and the grain/vignette overlays. Same
// id -> same image, every time this script runs.
//
// Rendered via headless Chromium (Playwright, devDependency only) using the
// browser already preinstalled in this environment — no `playwright install`
// needed, no other new dependency.
//
// Usage:
//   node scripts/make-placeholders.mjs             # generate all 29, skip existing
//   node scripts/make-placeholders.mjs --force      # regenerate everything
//   node scripts/make-placeholders.mjs --only=id,id # regenerate specific ids

import { mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

import { IMAGES } from './script-data.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const OUTPUT_DIR = join(ROOT_DIR, 'public', 'images');
const CHROMIUM_PATH = '/opt/pw-browsers/chromium';

const WIDTH = 1920;
const HEIGHT = 1080;

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const onlyArg = args.find((a) => a.startsWith('--only='));
const ONLY = onlyArg ? new Set(onlyArg.slice('--only='.length).split(',').map((s) => s.trim())) : null;

// ---------------------------------------------------------------------------
// Deterministic PRNG: FNV-1a hash of the id seeds a mulberry32 generator, so
// every random choice below is reproducible per id across runs.
// ---------------------------------------------------------------------------
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (rng, min, max) => min + rng() * (max - min);
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// ---------------------------------------------------------------------------
// Palette: deep near-black shadow through burnt umber, bronze, and warm
// gold/amber. Every color used on the page is generated from this one warm
// hue band so nothing ever drifts toward blue/green/teal.
// ---------------------------------------------------------------------------
function hsla(h, s, l, a) {
  return `hsla(${h.toFixed(1)}, ${s.toFixed(0)}%, ${l.toFixed(0)}%, ${a.toFixed(3)})`;
}

const TEMPLATES = ['diagonal-strata', 'horizontal-strata', 'central-glow', 'trench-cut', 'scatter-glow'];

function buildComposition(id) {
  const rng = mulberry32(fnv1a(id));
  const section = id.split('-')[0];
  const sectionHueSeed = fnv1a(section) % 1000;
  // Warm hue band: 18 (burnt red-bronze) .. 46 (bright gold). Section gives a
  // loose family hue, per-id rng jitters within it for individual variety.
  const sectionHue = 18 + (sectionHueSeed / 1000) * 28;
  const hue = Math.max(14, Math.min(48, sectionHue + between(rng, -8, 8)));

  const template = pick(rng, TEMPLATES);

  // --- base vignette-corner gradient (very dark) --------------------------
  const bgAngle = Math.floor(between(rng, 0, 360));
  const bgDark1 = hsla(hue, between(rng, 25, 45), between(rng, 2, 5), 1);
  const bgDark2 = hsla(hue - 6, between(rng, 30, 50), between(rng, 6, 11), 1);

  // --- glow blobs -----------------------------------------------------------
  const glowCount = template === 'central-glow' ? 1 + Math.floor(rng() * 2) : 2 + Math.floor(rng() * 3);
  const glows = [];
  for (let i = 0; i < glowCount; i++) {
    const gx =
      template === 'central-glow'
        ? between(rng, 35, 65)
        : template === 'trench-cut'
        ? between(rng, 40, 60)
        : between(rng, 5, 95);
    const gy = template === 'central-glow' ? between(rng, 30, 55) : between(rng, 5, 95);
    const size = template === 'central-glow' ? between(rng, 45, 75) : between(rng, 18, 42);
    const glowHue = hue + between(rng, -10, 10);
    const glowSat = between(rng, 55, 85);
    const glowLight = between(rng, 38, 60);
    const glowAlpha = between(rng, 0.16, 0.4);
    glows.push(
      `radial-gradient(circle at ${gx.toFixed(1)}% ${gy.toFixed(1)}%, ${hsla(
        glowHue,
        glowSat,
        glowLight,
        glowAlpha
      )} 0%, ${hsla(glowHue, glowSat, glowLight, 0)} ${size.toFixed(0)}%)`
    );
  }

  // --- strata / trench bands ------------------------------------------------
  const bands = [];
  if (template === 'diagonal-strata' || template === 'horizontal-strata') {
    const bandCount = 3 + Math.floor(rng() * 4);
    const skew = template === 'diagonal-strata' ? between(rng, -9, 9) : 0;
    let cursor = between(rng, 45, 62); // strata start somewhere in the lower half
    for (let i = 0; i < bandCount && cursor < 100; i++) {
      const bandHeight = between(rng, 5, 11);
      const bandLight = between(rng, 6, 20) + i * 1.2;
      const bandHue = hue + between(rng, -12, 6);
      const bandSat = between(rng, 20, 45);
      bands.push({
        top: cursor,
        height: bandHeight,
        color: hsla(bandHue, bandSat, bandLight, between(rng, 0.5, 0.85)),
        edgeColor: hsla(bandHue + 10, bandSat + 10, bandLight + 18, 0.35),
        skew,
      });
      cursor += bandHeight + between(rng, 0.5, 2.5);
    }
  }

  // --- trench-cut vertical slice ---------------------------------------------
  let trench = null;
  if (template === 'trench-cut') {
    const cx = between(rng, 38, 62);
    const w = between(rng, 10, 22);
    trench = {
      cx,
      w,
      angle: between(rng, -4, 4),
      color: hsla(hue - 4, 20, between(rng, 2, 6), 0.92),
      edgeGlow: hsla(hue + 6, 70, 55, between(rng, 0.2, 0.35)),
    };
  }

  // --- vignette ---------------------------------------------------------------
  const vignetteCx = between(rng, 35, 65);
  const vignetteCy = between(rng, 30, 60);
  const vignetteStrength = between(rng, 0.55, 0.78);

  // --- grain --------------------------------------------------------------
  const grainFreq = between(rng, 0.55, 1.4);
  const grainOpacity = between(rng, 0.05, 0.1);
  const grainSeed = Math.floor(rng() * 1000);

  return {
    template,
    hue,
    bgAngle,
    bgDark1,
    bgDark2,
    glows,
    bands,
    trench,
    vignetteCx,
    vignetteCy,
    vignetteStrength,
    grainFreq,
    grainOpacity,
    grainSeed,
  };
}

function humanLabel(id) {
  const [section, ...rest] = id.split('-');
  const shot = rest.join(' ');
  return { section: section.toUpperCase(), shot: shot.toUpperCase() };
}

function buildHtml(img) {
  const comp = buildComposition(img.id);
  const { section, shot } = humanLabel(img.id);

  const bandDivs = comp.bands
    .map(
      (b) => `
    <div style="
      position:absolute; left:-10%; width:120%; top:${b.top.toFixed(2)}%; height:${b.height.toFixed(2)}%;
      background: linear-gradient(180deg, ${b.edgeColor} 0%, ${b.color} 18%, ${b.color} 100%);
      transform: skewY(${b.skew.toFixed(2)}deg);
      box-shadow: 0 1px 0 ${b.edgeColor};
    "></div>`
    )
    .join('\n');

  const trenchDiv = comp.trench
    ? `
    <div style="
      position:absolute; top:-10%; height:130%; left:${comp.trench.cx.toFixed(2)}%;
      width:${comp.trench.w.toFixed(2)}%; transform: translateX(-50%) rotate(${comp.trench.angle.toFixed(
        2
      )}deg);
      background: linear-gradient(90deg,
        ${comp.trench.edgeGlow} 0%, transparent 12%,
        ${comp.trench.color} 50%,
        transparent 88%, ${comp.trench.edgeGlow} 100%);
    "></div>`
    : '';

  const glowLayer = comp.glows.join(',\n      ');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:${WIDTH}px; height:${HEIGHT}px; overflow:hidden; background:#000; }
  @font-face { font-family: 'PageSerif'; src: local('Georgia'); }
  .stage {
    position: relative;
    width: ${WIDTH}px; height: ${HEIGHT}px;
    background-image: linear-gradient(${comp.bgAngle}deg, ${comp.bgDark1} 0%, ${comp.bgDark2} 100%);
    overflow: hidden;
  }
  .glows {
    position: absolute; inset: 0;
    background-image:
      ${glowLayer};
  }
  .vignette {
    position: absolute; inset: 0;
    background: radial-gradient(ellipse at ${comp.vignetteCx.toFixed(1)}% ${comp.vignetteCy.toFixed(
      1
    )}%, transparent 32%, rgba(0,0,0,${comp.vignetteStrength.toFixed(3)}) 100%);
  }
  .grain {
    position: absolute; inset: -5%;
    opacity: ${comp.grainOpacity.toFixed(3)};
    mix-blend-mode: overlay;
  }
  .label {
    position: absolute; left: 56px; bottom: 46px;
    font-family: Georgia, 'Times New Roman', serif;
    color: hsla(${comp.hue.toFixed(1)}, 55%, 78%, 0.55);
    letter-spacing: 0.22em;
    text-transform: uppercase;
    font-size: 14px;
    line-height: 1.6;
    text-shadow: 0 1px 2px rgba(0,0,0,0.8);
  }
  .label .id {
    display:block;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    letter-spacing: 0.08em;
    color: hsla(${comp.hue.toFixed(1)}, 30%, 60%, 0.4);
    margin-top: 4px;
  }
  .label .tick {
    display:inline-block; width: 22px; height: 1px;
    background: hsla(${comp.hue.toFixed(1)}, 55%, 70%, 0.45);
    margin-bottom: 6px;
  }
</style>
</head>
<body>
  <div class="stage">
    ${bandDivs}
    ${trenchDiv}
    <div class="glows"></div>
    <svg class="grain" width="100%" height="100%">
      <filter id="n">
        <feTurbulence type="fractalNoise" baseFrequency="${comp.grainFreq.toFixed(
          3
        )}" numOctaves="2" seed="${comp.grainSeed}" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#n)" />
    </svg>
    <div class="vignette"></div>
    <div class="label">
      <span class="tick"></span><br />
      ${section} &middot; ${shot}
      <span class="id">${img.id}</span>
    </div>
  </div>
</body>
</html>`;
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  let images = IMAGES;
  if (ONLY) {
    images = IMAGES.filter((img) => ONLY.has(img.id));
    const missing = [...ONLY].filter((id) => !IMAGES.some((img) => img.id === id));
    if (missing.length) {
      console.error(`Unknown id(s) passed to --only: ${missing.join(', ')}`);
      process.exit(1);
    }
  }

  const toRender = images.filter((img) => FORCE || !existsSync(join(OUTPUT_DIR, `${img.id}.jpg`)));
  const skipped = images.length - toRender.length;

  console.log(`Placeholder generation: ${images.length} requested, ${skipped} already exist (skipped), ${toRender.length} to render.`);
  if (toRender.length === 0) {
    console.log('Nothing to do. Pass --force to regenerate.');
    return;
  }

  const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
  const CONCURRENCY = 4;
  let cursor = 0;
  const done = [];

  async function worker() {
    const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
    while (cursor < toRender.length) {
      const img = toRender[cursor++];
      const html = buildHtml(img);
      await page.setContent(html, { waitUntil: 'load' });
      const outPath = join(OUTPUT_DIR, `${img.id}.jpg`);
      await page.screenshot({ path: outPath, type: 'jpeg', quality: 92 });
      done.push(img.id);
      console.log(`  rendered: ${img.id}`);
    }
    await page.close();
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, toRender.length) }, worker));
  await browser.close();

  console.log(`\nDone. Rendered ${done.length} placeholder(s) into ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error('Fatal error generating placeholders:', err);
  process.exit(1);
});
