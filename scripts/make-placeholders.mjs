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
  // A primary "light source" glow (brighter, with a small hot core) plus a
  // few softer secondary glows, so every composition has a clear focal point
  // rather than reading as a flat blur.
  const glowCount = template === 'central-glow' ? 2 + Math.floor(rng() * 2) : 3 + Math.floor(rng() * 3);
  const glows = [];
  let primaryGx = 50;
  let primaryGy = 45;
  for (let i = 0; i < glowCount; i++) {
    const gx =
      template === 'central-glow'
        ? between(rng, 32, 68)
        : template === 'trench-cut'
        ? between(rng, 40, 60)
        : between(rng, 5, 95);
    const gy = template === 'central-glow' ? between(rng, 26, 58) : between(rng, 5, 95);
    const size = template === 'central-glow' ? between(rng, 40, 68) : between(rng, 16, 38);
    const glowHue = hue + between(rng, -10, 10);
    const glowSat = between(rng, 58, 88);
    const isPrimary = i === 0;
    const glowLight = isPrimary ? between(rng, 52, 68) : between(rng, 34, 54);
    const glowAlpha = isPrimary ? between(rng, 0.32, 0.55) : between(rng, 0.14, 0.32);
    if (isPrimary) {
      primaryGx = gx;
      primaryGy = gy;
      // bright hot core at the light source, fading fast into the wider glow
      glows.push(
        `radial-gradient(circle at ${gx.toFixed(1)}% ${gy.toFixed(1)}%, ${hsla(
          glowHue + 6,
          Math.min(95, glowSat + 8),
          Math.min(88, glowLight + 22),
          between(rng, 0.35, 0.55)
        )} 0%, transparent 14%)`
      );
    }
    glows.push(
      `radial-gradient(circle at ${gx.toFixed(1)}% ${gy.toFixed(1)}%, ${hsla(
        glowHue,
        glowSat,
        glowLight,
        glowAlpha
      )} 0%, ${hsla(glowHue, glowSat, glowLight, 0)} ${size.toFixed(0)}%)`
    );
  }

  // --- ember / dust motes ----------------------------------------------------
  // Small bright specks scattered mostly above the midline — reads as rising
  // embers or dust in a lantern beam, and breaks up any flat gradient areas.
  const emberCount = 8 + Math.floor(rng() * 10);
  const embers = [];
  for (let i = 0; i < emberCount; i++) {
    const ex = between(rng, 2, 98);
    const ey = between(rng, 2, 72);
    const er = between(rng, 0.12, 0.55);
    const emberHue = hue + between(rng, -6, 14);
    const emberAlpha = between(rng, 0.25, 0.6);
    embers.push(
      `radial-gradient(circle at ${ex.toFixed(2)}% ${ey.toFixed(2)}%, ${hsla(
        emberHue,
        75,
        between(rng, 62, 85),
        emberAlpha
      )} 0%, transparent ${er.toFixed(2)}%)`
    );
  }

  // --- soft godrays -----------------------------------------------------------
  // A repeating-conic-gradient spoke pattern centered on the primary glow,
  // blended with 'screen' so it only ever brightens — a soft suggestion of
  // light breaking through dust/haze, used on most (not all) compositions.
  const hasRays = rng() < 0.55;
  const rayCount = 8 + Math.floor(rng() * 6);
  const raySpread = 360 / rayCount;
  const rayWidth = raySpread * between(rng, 0.18, 0.35);
  const rayRotation = Math.floor(between(rng, 0, 360));
  const rayAlpha = between(rng, 0.045, 0.09);
  const rayReach = between(rng, 32, 55); // % radius before rays fade to nothing
  const rays = hasRays
    ? {
        cx: primaryGx,
        cy: primaryGy,
        css: `repeating-conic-gradient(from ${rayRotation}deg at ${primaryGx.toFixed(
          1
        )}% ${primaryGy.toFixed(1)}%, ${hsla(hue + 8, 60, 75, rayAlpha)} 0deg ${rayWidth.toFixed(
          1
        )}deg, transparent ${rayWidth.toFixed(1)}deg ${raySpread.toFixed(1)}deg)`,
        maskCss: `radial-gradient(circle at ${primaryGx.toFixed(1)}% ${primaryGy.toFixed(
          1
        )}%, black 0%, black ${(rayReach * 0.4).toFixed(1)}%, transparent ${rayReach.toFixed(1)}%)`,
      }
    : null;

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

  // --- faint horizon line ------------------------------------------------
  // Even templates without full strata bands get a single soft horizon line
  // — a quiet nod to the dig-site/strata motif that ties the whole set
  // together without repeating the same layout everywhere.
  let horizon = null;
  if (template === 'central-glow' || template === 'scatter-glow' || (template === 'trench-cut' && rng() < 0.6)) {
    horizon = {
      top: between(rng, 62, 82),
      color: hsla(hue - 4, 30, between(rng, 10, 16), between(rng, 0.4, 0.65)),
      glow: hsla(hue + 4, 60, 55, between(rng, 0.1, 0.2)),
    };
  }

  // --- vignette ---------------------------------------------------------------
  const vignetteCx = between(rng, 35, 65);
  const vignetteCy = between(rng, 30, 60);
  const vignetteStrength = between(rng, 0.58, 0.8);

  // --- grain --------------------------------------------------------------
  // Two passes: a fine monochrome film-grain pass, and a larger, warm-tinted
  // "canvas" turbulence pass for a painterly texture (nods to the video's
  // "painterly brushwork" style cue) blended with soft-light.
  const grainFreq = between(rng, 0.55, 1.4);
  const grainOpacity = between(rng, 0.08, 0.16);
  const grainSeed = Math.floor(rng() * 1000);
  const canvasFreq = between(rng, 0.012, 0.035);
  const canvasOpacity = between(rng, 0.14, 0.26);
  const canvasSeed = Math.floor(rng() * 1000);
  const canvasHue = hue + between(rng, -6, 10);

  return {
    template,
    hue,
    bgAngle,
    bgDark1,
    bgDark2,
    glows,
    embers,
    rays,
    bands,
    trench,
    horizon,
    vignetteCx,
    vignetteCy,
    vignetteStrength,
    grainFreq,
    grainOpacity,
    grainSeed,
    canvasFreq,
    canvasOpacity,
    canvasSeed,
    canvasHue,
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
  const emberLayer = comp.embers.join(',\n      ');

  const horizonDiv = comp.horizon
    ? `
    <div style="
      position:absolute; left:0; width:100%; top:${comp.horizon.top.toFixed(2)}%; height:2px;
      background: ${comp.horizon.color};
      box-shadow: 0 -22px 40px -10px ${comp.horizon.glow}, 0 1px 0 rgba(0,0,0,0.5);
    "></div>`
    : '';

  const raysDiv = comp.rays
    ? `<div class="rays" style="background-image: ${comp.rays.css}; mask-image: ${comp.rays.maskCss}; -webkit-mask-image: ${comp.rays.maskCss};"></div>`
    : '';

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
  .rays {
    position: absolute; inset: 0;
    mix-blend-mode: screen;
  }
  .glows {
    position: absolute; inset: 0;
    background-image:
      ${glowLayer};
  }
  .embers {
    position: absolute; inset: 0;
    background-image:
      ${emberLayer};
    mix-blend-mode: screen;
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
  .canvas-texture {
    position: absolute; inset: -5%;
    opacity: ${comp.canvasOpacity.toFixed(3)};
    mix-blend-mode: soft-light;
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
    ${horizonDiv}
    ${bandDivs}
    ${trenchDiv}
    ${raysDiv}
    <div class="glows"></div>
    <div class="embers"></div>
    <svg class="canvas-texture" width="100%" height="100%">
      <filter id="c">
        <feTurbulence type="fractalNoise" baseFrequency="${comp.canvasFreq.toFixed(
          4
        )}" numOctaves="3" seed="${comp.canvasSeed}" stitchTiles="stitch" />
        <feColorMatrix type="matrix" values="
          0 0 0 0 ${(0.5 + comp.canvasHue / 360).toFixed(2)}
          0 0 0 0 ${(0.32).toFixed(2)}
          0 0 0 0 ${(0.12).toFixed(2)}
          0 0 0 1 0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#c)" />
    </svg>
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
