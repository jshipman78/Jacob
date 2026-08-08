// Narration + timing for the 30-second vertical short.
//
// Produces:
//   public/audio/short-vo.wav   the narration, one continuous mono 24kHz PCM
//   public/audio/short-bed.wav  a procedural under-score, same length
//   public/audio/short-mix.wav  the mastered mix of the two — what renders
//   public/short-timing.json    line/word timing the composition animates to
//
// Same Kokoro worker as scripts/tts.mjs — see the header there for why the
// model is loaded out-of-process from local weights rather than via kokoro-js.
// This script differs in one way that matters: the short has a HARD 30.000s
// duration, so after measuring the real synthesized length of every line it
// distributes the leftover time into the pauses between them. The film is cut
// to the voice; the voice is never stretched to the cut.
//
// Run with: npm run short:tts

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  LINES,
  VOICE_NAME,
  TOTAL_SEC,
  LEAD_IN_SEC,
  MIN_TAIL_SEC,
  MIN_GAP_SEC,
  MAX_GAP_SEC,
} from './short-script.mjs';
import { resolveVoice } from './voices.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const CACHE_DIR = path.join(ROOT, '.cache', 'tts');
const KOKORO_DIR = path.join(ROOT, '.cache', 'kokoro');
const MODEL_PATH = path.join(KOKORO_DIR, 'kokoro-v1.0.onnx');
const VOICES_PATH = path.join(KOKORO_DIR, 'voices-v1.0.bin');
const OUT_VO = path.join(ROOT, 'public', 'audio', 'short-vo.wav');
const OUT_BED = path.join(ROOT, 'public', 'audio', 'short-bed.wav');
const OUT_MIX = path.join(ROOT, 'public', 'audio', 'short-mix.wav');
const OUT_TIMING = path.join(ROOT, 'public', 'short-timing.json');

const SAMPLE_RATE = 24000;
const FPS = 30;

// Same venv-first interpreter search as scripts/tts.mjs.
function resolvePython() {
  if (process.env.PYTHON) return process.env.PYTHON;
  for (let dir = __dirname; ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, '.venv', 'bin', 'python3');
    if (existsSync(candidate)) return candidate;
    if (path.dirname(dir) === dir) return 'python3';
  }
}
const PYTHON = resolvePython();

const voiceArg = process.argv.find((a) => a.startsWith('--voice='))?.slice('--voice='.length);
const SELECTED_VOICE = resolveVoice(voiceArg || process.env.VOICE || VOICE_NAME);

// A short is not a fourteen-minute film. The channel narrator's deliberate
// pace is right for long form and soporific at this length, so the short runs
// him a touch quicker. Overridable, and part of the cache key.
const SPEED = Number(
  process.argv.find((a) => a.startsWith('--speed='))?.slice('--speed='.length) ?? 1.08
);
const VOICE = SELECTED_VOICE.model;
const LANG = SELECTED_VOICE.lang;

// ---------------------------------------------------------------------------
// Synthesis (persistent worker, disk cache keyed on voice+speed+text)
// ---------------------------------------------------------------------------

function cachePathFor(text) {
  const hash = createHash('sha256').update(`${VOICE}|${SPEED}|${text}`).digest('hex');
  return path.join(CACHE_DIR, `${hash}.wav`);
}

async function fileExistsNonEmpty(p) {
  try {
    return (await stat(p)).size > 44;
  } catch {
    return false;
  }
}

async function synthesizeMissing(lines) {
  const jobs = [];
  for (const line of lines) {
    line.spokenText = line.tts ?? line.text;
    line.cachePath = cachePathFor(line.spokenText);
    // eslint-disable-next-line no-await-in-loop
    if (!(await fileExistsNonEmpty(line.cachePath))) {
      jobs.push({ id: line.id, text: line.spokenText, outPath: line.cachePath });
    }
  }

  if (jobs.length === 0) {
    console.log('All lines already cached — skipping synthesis.');
    return;
  }

  console.log(`Synthesizing ${jobs.length}/${lines.length} line(s) with ${PYTHON}...`);
  await mkdir(CACHE_DIR, { recursive: true });

  const worker = spawn(
    PYTHON,
    [
      path.join(__dirname, 'kokoro_worker.py'),
      '--model', MODEL_PATH,
      '--voices', VOICES_PATH,
      '--voice', VOICE,
      '--speed', String(SPEED),
      '--lang', LANG,
    ],
    { cwd: ROOT, stdio: ['pipe', 'pipe', 'inherit'] }
  );

  let buffer = '';
  const pending = new Map();
  let readyResolve;
  const readyPromise = new Promise((res) => {
    readyResolve = res;
  });

  worker.stdout.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    let idx;
    // eslint-disable-next-line no-cond-assign
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      const msg = JSON.parse(line);
      if (msg.ready) {
        readyResolve();
        continue;
      }
      const p = pending.get(msg.id);
      if (!p) continue;
      pending.delete(msg.id);
      if (msg.ok) p.resolve(msg);
      else p.reject(new Error(`Kokoro worker error for ${msg.id}: ${msg.error}`));
    }
  });

  worker.on('exit', (code, signal) => {
    const err = new Error(`kokoro_worker.py exited code=${code} signal=${signal}`);
    for (const [, p] of pending) p.reject(err);
  });

  await readyPromise;

  for (const job of jobs) {
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve, reject) => {
      pending.set(job.id, { resolve, reject });
      worker.stdin.write(`${JSON.stringify(job)}\n`);
    });
    console.log(`  ${job.id}`);
  }

  worker.stdin.end();
  await new Promise((resolve) => worker.on('close', resolve));
}

// ---------------------------------------------------------------------------
// Minimal mono 16-bit WAV IO
// ---------------------------------------------------------------------------

async function readWavMono16(filePath) {
  const buf = await readFile(filePath);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error(`${filePath} is not a RIFF/WAVE file`);
  }
  let offset = 12;
  let fmt = null;
  let dataStart = -1;
  let dataLength = 0;
  while (offset + 8 <= buf.length) {
    const chunkId = buf.toString('ascii', offset, offset + 4);
    const chunkSize = buf.readUInt32LE(offset + 4);
    const bodyStart = offset + 8;
    if (chunkId === 'fmt ') {
      fmt = {
        numChannels: buf.readUInt16LE(bodyStart + 2),
        sampleRate: buf.readUInt32LE(bodyStart + 4),
        bitsPerSample: buf.readUInt16LE(bodyStart + 14),
      };
    } else if (chunkId === 'data') {
      dataStart = bodyStart;
      dataLength = chunkSize;
    }
    offset = bodyStart + chunkSize + (chunkSize % 2);
  }
  if (!fmt || dataStart < 0) throw new Error(`${filePath}: missing fmt/data chunk`);
  if (fmt.numChannels !== 1 || fmt.bitsPerSample !== 16) {
    throw new Error(`${filePath}: expected mono 16-bit PCM`);
  }
  const pcm = buf.subarray(dataStart, dataStart + dataLength);
  return { sampleRate: fmt.sampleRate, numSamples: pcm.length / 2, pcm };
}

function wavHeader(dataLength, sampleRate) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataLength, 40);
  return header;
}

const silence = (sec) => Buffer.alloc(Math.round(sec * SAMPLE_RATE) * 2);

// ---------------------------------------------------------------------------
// Word timing
// ---------------------------------------------------------------------------

/**
 * Kokoro returns audio for a whole line, not per-word alignment, so word
 * boundaries inside a line are apportioned rather than measured. Weight is
 * letters plus a syllable-ish bonus for long words, plus a hold on any word
 * carrying terminal punctuation — which is where a reader actually slows.
 * The line's measured start and end are exact; only the divisions inside it
 * are estimates, and at caption size the eye cannot see the difference.
 */
function wordTimes(text, start, end) {
  const words = text.split(/\s+/).filter(Boolean);
  const weights = words.map((w) => {
    const letters = w.replace(/[^A-Za-z0-9']/g, '').length;
    const pausey = /[.,;:?!—-]$/.test(w) ? 2.2 : 0;
    return Math.max(1.6, letters * 0.85) + pausey;
  });
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let cursor = start;
  return words.map((word, i) => {
    const dur = ((end - start) * weights[i]) / total;
    const w = { word, start: cursor, end: cursor + dur };
    cursor = w.end;
    return w;
  });
}

const normalize = (w) => w.toLowerCase().replace(/[^a-z0-9']/g, '');

// ---------------------------------------------------------------------------
// Procedural under-score
// ---------------------------------------------------------------------------

/**
 * A bed, not a track: a low sustained chord, one soft pulse per spoken line,
 * a breath of filtered noise, and a rise into the end card. Procedural, so
 * there is no licensed asset to ship and the same script always produces the
 * same bed.
 *
 * THE RULE THAT MATTERS HERE: every oscillator advances a PHASE ACCUMULATOR.
 * Nothing computes `sin(2π·f(t)·t)`. That formula looks like a swept tone and
 * is not one — when f changes, the whole argument jumps, so the waveform tears
 * (an audible click on every change) and its instantaneous frequency is
 * f + t·df/dt, which runs past Nyquist and aliases into noise. Both of those
 * were audible in the first cut of this bed. Accumulating `phase += 2πf/sr`
 * is continuous by construction at any f.
 *
 * Every envelope also opens over a few milliseconds rather than instantly: a
 * step from silence into a running oscillator is itself a click.
 */
function buildBed(durationSec, lines) {
  const n = Math.round(durationSec * SAMPLE_RATE);
  const out = new Float32Array(n);

  const inc = (f) => (2 * Math.PI * f) / SAMPLE_RATE;

  // Deterministic noise source.
  let seed = 12345;
  const white = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed / 4294967296) * 2 - 1;
  };

  // E2 and B2 — high enough to survive a phone speaker, low enough to stay
  // under a voice. A1 was inaudible on anything but headphones, where it
  // read as rumble.
  let pA = 0;
  let pB = 0;
  let pRise = 0;
  let lp1 = 0;
  let lp2 = 0;

  const beats = lines.map((l) => l.start);
  const riseStart = durationSec - 3.4;

  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;

    // --- sustained chord, amplitude-modulated only ------------------------
    pA += inc(82.41);
    pB += inc(123.47);
    const swell = 0.85 + 0.15 * Math.sin(2 * Math.PI * 0.14 * t);
    const chord = (Math.sin(pA) * 0.6 + Math.sin(pB) * 0.28) * swell;

    // --- one pulse per line, struck at the downbeat ------------------------
    let pulse = 0;
    for (let b = 0; b < beats.length; b++) {
      const dt = t - beats[b];
      if (dt < 0 || dt > 0.9) continue;
      // 6ms attack so it opens rather than snaps; 180ms decay.
      const env = (1 - Math.exp(-dt / 0.006)) * Math.exp(-dt / 0.18);
      pulse += Math.sin(2 * Math.PI * 54 * dt) * env;
    }

    // --- air: two-pole low-passed noise -----------------------------------
    const w = white();
    lp1 += (w - lp1) * 0.02;
    lp2 += (lp1 - lp2) * 0.02;
    const air = lp2 * 3.5;

    // --- rise into the end card -------------------------------------------
    let riser = 0;
    if (t >= riseStart) {
      const k = Math.min(1, (t - riseStart) / 3.4);
      pRise += inc(180 + 420 * k * k); // accumulated, so no aliasing
      riser = Math.sin(pRise) * 0.22 * k * k;
    }

    const fadeIn = Math.min(1, t / 0.9);
    const fadeOut = Math.min(1, Math.max(0, (durationSec - t) / 0.7));
    out[i] = (chord * 0.5 + pulse * 0.5 + air * 0.35 + riser) * fadeIn * fadeOut;
  }

  // --- duck under the voice ------------------------------------------------
  // A bed that holds its level through a line fights the narration for the
  // same few hundred Hz. Drop it while anyone is speaking and let it back up
  // in the pauses, smoothed so the recovery is not itself audible.
  const speaking = new Uint8Array(n);
  for (const l of lines) {
    const a = Math.max(0, Math.round((l.start - 0.12) * SAMPLE_RATE));
    const b = Math.min(n, Math.round((l.end + 0.12) * SAMPLE_RATE));
    speaking.fill(1, a, b);
  }
  let g = 1;
  for (let i = 0; i < n; i++) {
    const target = speaking[i] ? 0.42 : 1;
    g += (target - g) * 0.00012; // ~200ms time constant at 24kHz
    out[i] *= g;
  }

  // --- soft limit, then set the level --------------------------------------
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const s = Math.tanh(out[i] * 1.4) / 1.4; // rounds transients, no hard edges
    out[i] = s;
    const a = Math.abs(s);
    if (a > peak) peak = a;
  }
  // -24 dBFS: with the voice normalized to -3, the worst-case sum still has
  // better than 2dB of headroom, so nothing downstream has to clip.
  const gain = (peak > 0 ? dbToLin(-24) / peak : 0);

  const buf = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, out[i] * gain));
    buf.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  return buf;
}

const dbToLin = (db) => Math.pow(10, db / 20);
const linToDb = (x) => 20 * Math.log10(x || 1e-9);

/**
 * Mixes the voice and the bed down to one mastered track.
 *
 * Two reasons this happens here rather than as two <Audio> tags in the
 * composition. First, Remotion attenuates when it sums multiple tracks, so the
 * balance decided here would not be the balance that reached the file — the
 * first cut of this short left the mix peaking at -6 dBFS, which on a phone is
 * inaudibly quiet next to everything else in the feed. Second, mastering wants
 * to measure what it is doing, and only this script can.
 *
 * Loudness target is set by where this ends up: platforms normalize toward
 * roughly -14 LUFS and only ever turn loud material DOWN, so quiet material
 * simply plays quiet. Speech-region RMS is the practical stand-in for a full
 * LUFS meter at this length.
 */
function mixAndMaster(voPcm, bedPcm, lines, durationSec) {
  const n = Math.max(voPcm.length, bedPcm.length) / 2;
  const mix = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = i * 2 < voPcm.length ? voPcm.readInt16LE(i * 2) / 32768 : 0;
    const b = i * 2 < bedPcm.length ? bedPcm.readInt16LE(i * 2) / 32768 : 0;
    mix[i] = v + b;
  }

  // RMS across spoken regions only — silence between lines would drag the
  // measurement down and the gain up.
  let sum = 0;
  let count = 0;
  for (const l of lines) {
    const a = Math.max(0, Math.round(l.start * SAMPLE_RATE));
    const b = Math.min(n, Math.round(l.end * SAMPLE_RATE));
    for (let i = a; i < b; i++) {
      sum += mix[i] * mix[i];
      count++;
    }
  }
  const speechRms = Math.sqrt(sum / Math.max(1, count));

  const TARGET_SPEECH_RMS_DB = -19;
  const CEILING = dbToLin(-1);
  // Capped: past about 9dB the limiter starts shaping the voice rather than
  // catching it, and synthesized speech shows that as a hard, flat tone.
  const gain = Math.min(dbToLin(9), dbToLin(TARGET_SPEECH_RMS_DB) / (speechRms || 1));

  let peak = 0;
  for (let i = 0; i < n; i++) {
    // Soft limit: linear well below the ceiling, asymptotic at it. Nothing can
    // exceed CEILING by construction, so no sample ever wraps or squares off.
    const y = CEILING * Math.tanh((mix[i] * gain) / CEILING);
    mix[i] = y;
    const a = Math.abs(y);
    if (a > peak) peak = a;
  }

  const buf = Buffer.alloc(n * 2);
  let outSum = 0;
  let outCount = 0;
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix[i])) * 32767), i * 2);
  }
  for (const l of lines) {
    const a = Math.max(0, Math.round(l.start * SAMPLE_RATE));
    const b = Math.min(n, Math.round(l.end * SAMPLE_RATE));
    for (let i = a; i < b; i++) {
      outSum += mix[i] * mix[i];
      outCount++;
    }
  }

  return {
    pcm: buf,
    gainDb: linToDb(gain),
    peakDb: linToDb(peak),
    speechRmsDb: linToDb(Math.sqrt(outSum / Math.max(1, outCount))),
  };
}

/** Scales 16-bit PCM in place so its loudest sample sits at `targetDb`. */
function normalizePcm(pcm, targetDb) {
  const n = pcm.length / 2;
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.abs(pcm.readInt16LE(i * 2)) / 32768;
    if (a > peak) peak = a;
  }
  if (peak === 0) return { peak, gain: 1 };
  const gain = dbToLin(targetDb) / peak;
  for (let i = 0; i < n; i++) {
    const v = (pcm.readInt16LE(i * 2) / 32768) * gain;
    pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2);
  }
  return { peak, gain };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const lines = LINES.map((l) => ({ ...l }));
  await synthesizeMissing(lines);

  for (const line of lines) {
    // eslint-disable-next-line no-await-in-loop
    const { sampleRate, numSamples } = await readWavMono16(line.cachePath);
    if (sampleRate !== SAMPLE_RATE) {
      throw new Error(`${line.id}: sampleRate=${sampleRate}, expected ${SAMPLE_RATE}`);
    }
    line.durationSec = numSamples / SAMPLE_RATE;
  }

  // --- Fit the measured speech to the fixed 30s slot ------------------------
  const speech = lines.reduce((a, l) => a + l.durationSec, 0);
  const gapCount = lines.length - 1;
  const fixed = LEAD_IN_SEC + MIN_TAIL_SEC + speech + gapCount * MIN_GAP_SEC;
  if (fixed > TOTAL_SEC) {
    throw new Error(
      `Script does not fit: ${speech.toFixed(2)}s of speech needs ${fixed.toFixed(2)}s with ` +
        `minimum pauses, budget is ${TOTAL_SEC}s. Cut words from scripts/short-script.mjs ` +
        `or raise --speed (currently ${SPEED}).`
    );
  }

  let slack = TOTAL_SEC - fixed;
  const weightTotal = lines.slice(0, -1).reduce((a, l) => a + l.gapWeight, 0) || 1;
  for (let i = 0; i < gapCount; i++) {
    const share = (slack * lines[i].gapWeight) / weightTotal;
    lines[i].gapSec = Math.min(MAX_GAP_SEC, MIN_GAP_SEC + share);
  }
  // Anything the per-gap cap refused lands in the tail, where a held end card
  // is exactly what a short wants anyway.
  const gapsUsed = lines.slice(0, -1).reduce((a, l) => a + l.gapSec, 0);
  const tail = TOTAL_SEC - LEAD_IN_SEC - speech - gapsUsed;

  // --- Assemble the voice track and the timeline ----------------------------
  const chunks = [silence(LEAD_IN_SEC)];
  let cursor = LEAD_IN_SEC;
  const timedLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const start = cursor;
    const end = start + line.durationSec;

    // eslint-disable-next-line no-await-in-loop
    const { pcm } = await readWavMono16(line.cachePath);
    chunks.push(pcm);
    cursor = end;

    const gap = i < gapCount ? line.gapSec : tail;
    chunks.push(silence(gap));
    cursor += gap;

    const emphasis = new Set((line.emphasis ?? []).map(normalize));
    timedLines.push({
      id: line.id,
      scene: line.scene,
      text: line.text,
      start,
      end,
      // The scene owns the screen until the next line starts, so it covers its
      // own pause rather than cutting to black in the silence.
      sceneStart: i === 0 ? 0 : start - Math.min(0.35, lines[i - 1].gapSec ?? 0.2),
      sceneEnd: cursor,
      words: wordTimes(line.text, start, end).map((w) => ({
        ...w,
        emphasis: emphasis.has(normalize(w.word)),
      })),
    });
  }

  const durationSec = cursor;
  const pcm = Buffer.concat(chunks);

  // Kokoro comes out within a decibel of full scale, which leaves nothing for
  // the bed to sit in. Normalize to -3 dBFS so the mix has real headroom.
  const vo = normalizePcm(pcm, -3);

  await mkdir(path.dirname(OUT_VO), { recursive: true });
  await writeFile(OUT_VO, Buffer.concat([wavHeader(pcm.length, SAMPLE_RATE), pcm]));

  const bed = buildBed(durationSec, timedLines);
  await writeFile(OUT_BED, Buffer.concat([wavHeader(bed.length, SAMPLE_RATE), bed]));

  // What the composition actually plays. The stems above are kept so the
  // balance can be inspected, or re-cut without re-synthesizing.
  const master = mixAndMaster(pcm, bed, timedLines, durationSec);
  await writeFile(OUT_MIX, Buffer.concat([wavHeader(master.pcm.length, SAMPLE_RATE), master.pcm]));

  const timing = {
    fps: FPS,
    sampleRate: SAMPLE_RATE,
    voice: SELECTED_VOICE.name,
    speed: SPEED,
    durationSec,
    durationInFrames: Math.round(durationSec * FPS),
    lines: timedLines,
  };
  await writeFile(OUT_TIMING, `${JSON.stringify(timing, null, 2)}\n`);

  console.log('');
  console.log(`voice       normalized ${linToDb(vo.peak).toFixed(2)} → -3.00 dBFS peak`);
  console.log(`bed         -24.00 dBFS peak, ducked to 42% under speech`);
  console.log(
    `mix         ${master.gainDb >= 0 ? '+' : ''}${master.gainDb.toFixed(2)}dB → ` +
      `${master.peakDb.toFixed(2)} dBFS peak, ${master.speechRmsDb.toFixed(2)} dBFS speech RMS`
  );
  console.log('');
  console.log(`speech      ${speech.toFixed(2)}s`);
  console.log(`pauses      ${gapsUsed.toFixed(2)}s across ${gapCount} gaps`);
  console.log(`tail        ${tail.toFixed(2)}s`);
  console.log(`total       ${durationSec.toFixed(3)}s (${timing.durationInFrames} frames @ ${FPS}fps)`);
  console.log('');
  console.log(`wrote ${path.relative(ROOT, OUT_VO)}`);
  console.log(`wrote ${path.relative(ROOT, OUT_BED)}`);
  console.log(`wrote ${path.relative(ROOT, OUT_MIX)}`);
  console.log(`wrote ${path.relative(ROOT, OUT_TIMING)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
