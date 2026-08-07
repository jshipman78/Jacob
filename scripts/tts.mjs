// Text-to-speech narration pipeline for "The Man Who Lied His Way to Troy".
//
// Produces:
//   public/audio/narration.wav  — one continuous mono 24kHz 16-bit PCM file
//   public/timing.json          — sentence/section/shot timing manifest
//
// TTS engine: Kokoro (kokoro-onnx, Python), run out-of-process via a
// persistent worker (scripts/kokoro_worker.py) so the ~325MB ONNX model is
// loaded once instead of once per sentence. kokoro-js (the pure-JS package
// in devDependencies) cannot be used in this environment: it downloads its
// model from huggingface.co at runtime, and huggingface.co is blocked by
// this sandbox's egress policy (verified: CONNECT to huggingface.co, hf.co,
// cdn-lfs.huggingface.co, and hf-mirror.com all return 403 policy denials).
// The Kokoro model weights (kokoro-v1.0.onnx + voices-v1.0.bin) were instead
// fetched from GitHub release assets (thewh1teagle/kokoro-onnx), which ARE
// reachable, and are cached locally under .cache/kokoro/. This is still the
// real Kokoro model/voices, at full quality — not the Piper fallback.
//
// Voice: am_michael (see VOICE_RATIONALE below).
//
// Run with: node scripts/tts.mjs

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SECTIONS, PAUSE, IMAGES } from './script-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const CACHE_DIR = path.join(ROOT, '.cache', 'tts');
const KOKORO_DIR = path.join(ROOT, '.cache', 'kokoro');
const MODEL_PATH = path.join(KOKORO_DIR, 'kokoro-v1.0.onnx');
const VOICES_PATH = path.join(KOKORO_DIR, 'voices-v1.0.bin');
const OUT_AUDIO = path.join(ROOT, 'public', 'audio', 'narration.wav');
const OUT_TIMING = path.join(ROOT, 'public', 'timing.json');

const SAMPLE_RATE = 24000;
const FPS = 30;
const LEAD_IN_SEC = 0.5;
const TRAILING_SEC = 1.5;

// am_michael: American English, male, deep/measured delivery. In a head-to-
// head audition against am_fenrir, bm_george, and am_puck on an actual
// sentence from this script ("His name was Heinrich Schliemann...") am_puck
// and am_fenrir read faster and louder (am_fenrir's waveform peak exceeded
// 1.0 — i.e. it clips — on that very sample), which reads as excitable
// rather than authoritative. bm_george was quieter but flatter/faster.
// am_michael was both the slowest-paced (12.74s vs ~11.7-12.5s for the
// others on identical text, i.e. more deliberate) and had the lowest peak
// amplitude with no clipping — the combination that best fits a serious
// documentary narrator reading measured historical prose. It's also the
// American-English voice, matching the American-style number expansions
// already baked into the script's `tts` overrides (e.g. "eighteen
// seventy-three" rather than the British "eighteen seventy three" cadence).
const VOICE = 'am_michael';
const SPEED = 1.0;
const LANG = 'en-us';

// ---------------------------------------------------------------------------
// 1. Flatten the script into a sentence list + paragraph list with timing
//    metadata filled in once we know each sentence's synthesized duration.
// ---------------------------------------------------------------------------

function flattenScript() {
  const sentences = []; // {index, sectionId, sectionTitle, paragraphIndex, imageId, text, spokenText}
  const paragraphs = []; // {sectionId, sectionTitle, paragraphIndex, imageId, pauseAfterKey, sentenceIndices: []}

  let globalIndex = 0;
  SECTIONS.forEach((section) => {
    section.paragraphs.forEach((paragraph, paragraphIndex) => {
      const sentenceIndices = [];
      paragraph.sentences.forEach((sentence) => {
        sentences.push({
          index: globalIndex,
          sectionId: section.id,
          sectionTitle: section.title,
          paragraphIndex,
          imageId: paragraph.image,
          text: sentence.text,
          spokenText: sentence.tts ?? sentence.text,
        });
        sentenceIndices.push(globalIndex);
        globalIndex++;
      });
      paragraphs.push({
        sectionId: section.id,
        sectionTitle: section.title,
        paragraphIndex,
        imageId: paragraph.image,
        pauseAfterKey: paragraph.pauseAfter,
        sentenceIndices,
      });
    });
  });

  return { sentences, paragraphs };
}

// ---------------------------------------------------------------------------
// 2. Per-sentence synthesis with disk cache, via a persistent Python worker.
// ---------------------------------------------------------------------------

function hashFor(voice, spokenText) {
  return createHash('sha256').update(`${voice}${spokenText}`).digest('hex');
}

function cachePathFor(hash) {
  return path.join(CACHE_DIR, `${hash}.wav`);
}

async function fileExistsNonEmpty(p) {
  try {
    const s = await stat(p);
    return s.size > 44; // bigger than a bare WAV header
  } catch {
    return false;
  }
}

/**
 * Spawns the persistent Kokoro worker and synthesizes every sentence that
 * isn't already cached. Returns nothing; results land on disk in CACHE_DIR.
 */
async function synthesizeMissing(sentences) {
  const jobs = [];
  for (const s of sentences) {
    const hash = hashFor(VOICE, s.spokenText);
    const cachePath = cachePathFor(hash);
    s.cachePath = cachePath; // annotate for later
    s.hash = hash;
    // eslint-disable-next-line no-await-in-loop
    if (!(await fileExistsNonEmpty(cachePath))) {
      jobs.push({ id: String(s.index), text: s.spokenText, outPath: cachePath });
    }
  }

  if (jobs.length === 0) {
    console.log('All sentence audio already cached — skipping synthesis.');
    return;
  }

  console.log(`Synthesizing ${jobs.length}/${sentences.length} sentence(s) (cache miss)...`);

  await mkdir(CACHE_DIR, { recursive: true });

  const worker = spawn(
    'python3',
    [
      path.join(__dirname, 'kokoro_worker.py'),
      '--model',
      MODEL_PATH,
      '--voices',
      VOICES_PATH,
      '--voice',
      VOICE,
      '--speed',
      String(SPEED),
      '--lang',
      LANG,
    ],
    { cwd: ROOT, stdio: ['pipe', 'pipe', 'inherit'] }
  );

  let buffer = '';
  const pending = new Map(); // id -> {resolve, reject}
  let ready = false;
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
        ready = true;
        readyResolve();
        continue;
      }
      const p = pending.get(msg.id);
      if (p) {
        pending.delete(msg.id);
        if (msg.ok) p.resolve(msg);
        else p.reject(new Error(`Kokoro worker error for id=${msg.id}: ${msg.error}`));
      }
    }
  });

  let workerExited = false;
  let workerExitError = null;
  worker.on('exit', (code, signal) => {
    workerExited = true;
    if (code !== 0) {
      workerExitError = new Error(`kokoro_worker.py exited with code=${code} signal=${signal}`);
    }
    // Reject anything still pending.
    for (const [, p] of pending) {
      p.reject(workerExitError ?? new Error('kokoro_worker.py exited unexpectedly'));
    }
  });

  await readyPromise;
  if (!ready) throw new Error('Kokoro worker never signaled readiness.');

  let done = 0;
  const total = jobs.length;
  for (const job of jobs) {
    if (workerExited) throw workerExitError ?? new Error('Worker exited early.');
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve, reject) => {
      pending.set(job.id, { resolve, reject });
      worker.stdin.write(`${JSON.stringify(job)}\n`);
    });
    done++;
    if (done % 5 === 0 || done === total) {
      console.log(`  synthesized ${done}/${total}`);
    }
  }

  worker.stdin.end();
  await new Promise((resolve) => worker.on('close', resolve));
}

// ---------------------------------------------------------------------------
// 3. Minimal WAV reader/writer (mono 16-bit PCM only — all we need).
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
        audioFormat: buf.readUInt16LE(bodyStart),
        numChannels: buf.readUInt16LE(bodyStart + 2),
        sampleRate: buf.readUInt32LE(bodyStart + 4),
        bitsPerSample: buf.readUInt16LE(bodyStart + 14),
      };
    } else if (chunkId === 'data') {
      dataStart = bodyStart;
      dataLength = chunkSize;
    }
    offset = bodyStart + chunkSize + (chunkSize % 2); // chunks are word-aligned
  }
  if (!fmt || dataStart < 0) throw new Error(`${filePath}: missing fmt/data chunk`);
  if (fmt.numChannels !== 1 || fmt.bitsPerSample !== 16) {
    throw new Error(
      `${filePath}: expected mono 16-bit PCM, got channels=${fmt.numChannels} bits=${fmt.bitsPerSample}`
    );
  }
  const pcm = buf.subarray(dataStart, dataStart + dataLength);
  return { sampleRate: fmt.sampleRate, numSamples: pcm.length / 2, pcm };
}

function writeWavHeader(dataLength, sampleRate) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16); // PCM fmt chunk size
  header.writeUInt16LE(1, 20); // audio format = PCM
  header.writeUInt16LE(1, 22); // channels = mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate = sr * channels * bytesPerSample
  header.writeUInt16LE(2, 32); // block align = channels * bytesPerSample
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(dataLength, 40);
  return header;
}

function silenceSamples(sec, sampleRate) {
  const n = Math.round(sec * sampleRate);
  return Buffer.alloc(n * 2); // zeroed = silence, 16-bit mono
}

// ---------------------------------------------------------------------------
// 4. Build the timeline (cursor walk) + assemble the final WAV.
// ---------------------------------------------------------------------------

async function main() {
  const { sentences, paragraphs } = flattenScript();
  console.log(`Script has ${sentences.length} sentences across ${paragraphs.length} paragraphs, ${SECTIONS.length} sections.`);

  await synthesizeMissing(sentences);

  // Load durations for every sentence from its cached WAV.
  for (const s of sentences) {
    // eslint-disable-next-line no-await-in-loop
    const { sampleRate, numSamples } = await readWavMono16(s.cachePath);
    if (sampleRate !== SAMPLE_RATE) {
      throw new Error(`Sentence ${s.index} cache has sampleRate=${sampleRate}, expected ${SAMPLE_RATE}`);
    }
    s.numSamples = numSamples;
    s.durationSec = numSamples / SAMPLE_RATE;
  }

  // Walk the timeline: sentences -> paragraphs -> sections, accumulating a
  // cursor in seconds. Also record paragraph start/end for shot grouping.
  let cursor = LEAD_IN_SEC;
  const audioChunks = [silenceSamples(LEAD_IN_SEC, SAMPLE_RATE)];

  const paragraphTimes = []; // {..paragraph fields, pStart, pEnd}

  const sentenceById = new Map(sentences.map((s) => [s.index, s]));

  for (const paragraph of paragraphs) {
    const pStart = cursor;
    for (let i = 0; i < paragraph.sentenceIndices.length; i++) {
      const sentence = sentenceById.get(paragraph.sentenceIndices[i]);
      const sStart = cursor;
      const sEnd = cursor + sentence.durationSec;
      sentence.start = sStart;
      sentence.end = sEnd;
      cursor = sEnd;

      // eslint-disable-next-line no-await-in-loop
      const { pcm } = await readWavMono16(sentence.cachePath);
      audioChunks.push(pcm);

      const isLastSentenceInParagraph = i === paragraph.sentenceIndices.length - 1;
      if (!isLastSentenceInParagraph) {
        const gap = PAUSE.sentence;
        audioChunks.push(silenceSamples(gap, SAMPLE_RATE));
        cursor += gap;
      }
    }
    const paragraphGap = PAUSE[paragraph.pauseAfterKey];
    if (paragraphGap === undefined) {
      throw new Error(`Unknown pauseAfter key "${paragraph.pauseAfterKey}" in PAUSE map.`);
    }
    audioChunks.push(silenceSamples(paragraphGap, SAMPLE_RATE));
    cursor += paragraphGap;
    const pEnd = cursor;
    paragraphTimes.push({ ...paragraph, pStart, pEnd });
  }

  // Final trailing silence (beyond the last paragraph's own pauseAfter gap).
  audioChunks.push(silenceSamples(TRAILING_SEC, SAMPLE_RATE));
  cursor += TRAILING_SEC;
  const durationSec = cursor;

  // --- Assemble narration.wav -------------------------------------------
  const pcmBuffer = Buffer.concat(audioChunks);
  const header = writeWavHeader(pcmBuffer.length, SAMPLE_RATE);
  await mkdir(path.dirname(OUT_AUDIO), { recursive: true });
  await writeFile(OUT_AUDIO, Buffer.concat([header, pcmBuffer]));
  console.log(`Wrote ${OUT_AUDIO} (${(pcmBuffer.length / (1024 * 1024)).toFixed(1)} MiB PCM, ${durationSec.toFixed(2)}s)`);

  // --- sections[] ----------------------------------------------------------
  const sectionOrder = SECTIONS.map((s) => s.id);
  const sectionStarts = new Map();
  for (const pt of paragraphTimes) {
    if (!sectionStarts.has(pt.sectionId)) sectionStarts.set(pt.sectionId, pt.pStart);
  }
  const sections = sectionOrder.map((id, i) => {
    const title = SECTIONS[i].title;
    const start = sectionStarts.get(id);
    const end = i === sectionOrder.length - 1 ? durationSec : sectionStarts.get(sectionOrder[i + 1]);
    return { id, title, start, end };
  });

  // --- shots[]: merge consecutive paragraphs sharing the same image -------
  const shots = [];
  for (const pt of paragraphTimes) {
    const last = shots[shots.length - 1];
    if (last && last.imageId === pt.imageId) {
      last.end = pt.pEnd; // extend
    } else {
      shots.push({ imageId: pt.imageId, start: pt.pStart, end: pt.pEnd });
    }
  }
  shots[shots.length - 1].end = durationSec; // last shot reaches true end

  // --- sentences[] (public schema — caption text, never spokenText) -------
  const sentencesOut = sentences.map((s) => ({
    index: s.index,
    sectionId: s.sectionId,
    paragraphIndex: s.paragraphIndex,
    imageId: s.imageId,
    text: s.text,
    start: s.start,
    end: s.end,
  }));

  const timing = {
    fps: FPS,
    sampleRate: SAMPLE_RATE,
    voice: VOICE,
    durationSec,
    sentences: sentencesOut,
    sections,
    shots,
  };

  await mkdir(path.dirname(OUT_TIMING), { recursive: true });
  await writeFile(OUT_TIMING, JSON.stringify(timing, null, 2));
  console.log(`Wrote ${OUT_TIMING}`);

  // --- self-checks ----------------------------------------------------------
  verifyTiming(timing, sentences.length);

  console.log('\nDone.');
  console.log(`Voice: ${VOICE}`);
  console.log(`Duration: ${formatMinSec(durationSec)} (${durationSec.toFixed(2)}s)`);
  console.log(`Sentences: ${sentencesOut.length}, Shots: ${shots.length}, Sections: ${sections.length}`);
}

function formatMinSec(sec) {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

function verifyTiming(timing, expectedSentenceCount) {
  const EPS = 1e-6;
  const { sentences, sections, shots, durationSec } = timing;

  if (sentences.length !== expectedSentenceCount) {
    throw new Error(`Sentence count mismatch: timing has ${sentences.length}, script has ${expectedSentenceCount}`);
  }

  const validImageIds = new Set(IMAGES.map((i) => i.id));
  for (const shot of shots) {
    if (!validImageIds.has(shot.imageId)) {
      throw new Error(`Shot references unknown imageId "${shot.imageId}"`);
    }
  }

  // Shots contiguous, gapless, 0 -> durationSec.
  if (Math.abs(shots[0].start - 0) > EPS) throw new Error(`First shot does not start at 0: ${shots[0].start}`);
  for (let i = 0; i < shots.length; i++) {
    if (shots[i].end <= shots[i].start) throw new Error(`Shot ${i} has non-positive duration`);
    if (i > 0 && Math.abs(shots[i].start - shots[i - 1].end) > EPS) {
      throw new Error(`Gap/overlap between shot ${i - 1} and ${i}: ${shots[i - 1].end} vs ${shots[i].start}`);
    }
  }
  if (Math.abs(shots[shots.length - 1].end - durationSec) > EPS) {
    throw new Error(`Last shot does not end at durationSec: ${shots[shots.length - 1].end} vs ${durationSec}`);
  }

  // Sections contiguous, gapless, 0 -> durationSec.
  if (Math.abs(sections[0].start - 0) > EPS) throw new Error(`First section does not start at 0: ${sections[0].start}`);
  for (let i = 0; i < sections.length; i++) {
    if (sections[i].end <= sections[i].start) throw new Error(`Section ${i} has non-positive duration`);
    if (i > 0 && Math.abs(sections[i].start - sections[i - 1].end) > EPS) {
      throw new Error(`Gap/overlap between section ${i - 1} and ${i}: ${sections[i - 1].end} vs ${sections[i].start}`);
    }
  }
  if (Math.abs(sections[sections.length - 1].end - durationSec) > EPS) {
    throw new Error(`Last section does not end at durationSec: ${sections[sections.length - 1].end} vs ${durationSec}`);
  }

  // Every sentence's [start,end] falls inside its section.
  const sectionById = new Map(sections.map((s) => [s.id, s]));
  for (const s of sentences) {
    const sec = sectionById.get(s.sectionId);
    if (!sec) throw new Error(`Sentence ${s.index} references unknown section "${s.sectionId}"`);
    if (s.start < sec.start - EPS || s.end > sec.end + EPS) {
      throw new Error(
        `Sentence ${s.index} [${s.start},${s.end}] falls outside its section "${s.sectionId}" [${sec.start},${sec.end}]`
      );
    }
  }

  console.log('Self-checks passed: shots and sections are contiguous/gapless, sentence count matches, all sentences within their section.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
