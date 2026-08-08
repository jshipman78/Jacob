// Pre-render validation gate. Checks that the three independently-produced
// pipelines (narration, artwork, composition) actually agree with each other
// before we spend a long render on them.
//
// Run from the repo root: node validate-build.mjs

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { IMAGES, SECTIONS } from './script-data.mjs';

const problems = [];
const notes = [];
const fail = (m) => problems.push(m);
const ok = (m) => notes.push(m);

const near = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;

// --- timing.json ------------------------------------------------------------
if (!existsSync('public/timing.json')) {
  fail('public/timing.json is missing — the TTS pipeline has not produced a timeline.');
} else {
  const t = JSON.parse(readFileSync('public/timing.json', 'utf8'));

  for (const k of ['fps', 'durationSec', 'sentences', 'sections', 'shots']) {
    if (t[k] === undefined) fail(`timing.json is missing the "${k}" field.`);
  }

  const scriptSentenceCount = SECTIONS.flatMap((s) => s.paragraphs).flatMap((p) => p.sentences).length;
  if (t.sentences?.length !== scriptSentenceCount) {
    fail(`timing.json has ${t.sentences?.length} sentences but the script has ${scriptSentenceCount}.`);
  } else {
    ok(`${scriptSentenceCount} sentences timed.`);
  }

  // Sentences must be ordered and non-overlapping.
  let prevEnd = -1;
  for (const s of t.sentences ?? []) {
    if (s.start < prevEnd - 0.001) {
      fail(`Sentence ${s.index} starts at ${s.start.toFixed(2)}s, before the previous one ended (${prevEnd.toFixed(2)}s).`);
      break;
    }
    if (s.end <= s.start) {
      fail(`Sentence ${s.index} has a non-positive duration.`);
      break;
    }
    prevEnd = s.end;
  }

  // Shots must tile the timeline exactly.
  const shots = t.shots ?? [];
  if (shots.length) {
    if (!near(shots[0].start, 0)) fail(`First shot starts at ${shots[0].start}s, expected 0.`);
    if (!near(shots.at(-1).end, t.durationSec, 0.2)) {
      fail(`Last shot ends at ${shots.at(-1).end}s but the audio is ${t.durationSec}s.`);
    }
    for (let i = 1; i < shots.length; i++) {
      if (!near(shots[i].start, shots[i - 1].end)) {
        fail(`Gap or overlap between shot ${i - 1} (${shots[i - 1].imageId}) and shot ${i} (${shots[i].imageId}).`);
        break;
      }
    }
    const known = new Set(IMAGES.map((i) => i.id));
    const unknown = shots.map((s) => s.imageId).filter((id) => !known.has(id));
    if (unknown.length) fail(`Shots reference unknown image ids: ${[...new Set(unknown)].join(', ')}`);

    // Adjacent shots sharing an image should have been merged into one.
    for (let i = 1; i < shots.length; i++) {
      if (shots[i].imageId === shots[i - 1].imageId) {
        fail(`Shots ${i - 1} and ${i} both use "${shots[i].imageId}" — adjacent duplicates should be merged.`);
        break;
      }
    }
    ok(`${shots.length} shots tile the timeline with no gaps.`);

    const shortest = Math.min(...shots.map((s) => s.end - s.start));
    const longest = Math.max(...shots.map((s) => s.end - s.start));
    ok(`Shot lengths range ${shortest.toFixed(1)}s to ${longest.toFixed(1)}s.`);
  }

  // Sections must be contiguous.
  const secs = t.sections ?? [];
  for (let i = 1; i < secs.length; i++) {
    if (!near(secs[i].start, secs[i - 1].end, 0.2)) {
      fail(`Sections "${secs[i - 1].id}" and "${secs[i].id}" are not contiguous.`);
      break;
    }
  }
  if (secs.length !== SECTIONS.length) {
    fail(`timing.json has ${secs.length} sections, the script has ${SECTIONS.length}.`);
  }

  // Captions must carry the written form, not the spoken one.
  const spoken = new Set(
    SECTIONS.flatMap((s) => s.paragraphs).flatMap((p) => p.sentences).filter((s) => s.tts).map((s) => s.tts)
  );
  const leaked = (t.sentences ?? []).filter((s) => spoken.has(s.text));
  if (leaked.length) {
    fail(`${leaked.length} caption(s) contain the spoken variant instead of the written text (e.g. "${leaked[0].text.slice(0, 60)}…").`);
  } else if (spoken.size) {
    ok(`All ${spoken.size} pronunciation overrides kept out of the captions.`);
  }

  const mins = Math.floor(t.durationSec / 60);
  ok(`Narration runtime ${mins}:${String(Math.round(t.durationSec % 60)).padStart(2, '0')} (target ~15:00).`);
}

// --- narration.wav ----------------------------------------------------------
const wav = 'public/audio/narration.wav';
if (!existsSync(wav)) {
  fail('public/audio/narration.wav is missing.');
} else {
  const bytes = statSync(wav).size;
  if (bytes < 1_000_000) fail(`narration.wav is only ${bytes} bytes — almost certainly truncated.`);
  try {
    // No system ffprobe here; Remotion ships its own.
    const probe = execFileSync(
      'npx',
      ['remotion', 'ffprobe', '-v', 'error', '-show_entries', 'format=duration',
       '-show_entries', 'stream=sample_rate,channels', '-of', 'default=nw=1', wav],
      { encoding: 'utf8' }
    );
    ok(`narration.wav: ${(bytes / 1e6).toFixed(1)} MB — ${probe.trim().replace(/\n/g, ', ')}`);
    const dur = Number(/duration=([\d.]+)/.exec(probe)?.[1]);
    if (existsSync('public/timing.json')) {
      const t = JSON.parse(readFileSync('public/timing.json', 'utf8'));
      if (dur && !near(dur, t.durationSec, 0.3)) {
        fail(`narration.wav is ${dur.toFixed(2)}s but timing.json claims ${t.durationSec}s — the edit would drift.`);
      }
    }
  } catch {
    notes.push('ffprobe unavailable; skipped audio stream inspection.');
  }
}

// --- images -----------------------------------------------------------------
if (!existsSync('public/images')) {
  fail('public/images/ is missing — no artwork generated.');
} else {
  const present = new Set(readdirSync('public/images').filter((f) => f.endsWith('.jpg')).map((f) => f.slice(0, -4)));
  const missing = IMAGES.map((i) => i.id).filter((id) => !present.has(id));
  const extra = [...present].filter((id) => !IMAGES.some((i) => i.id === id));
  if (missing.length) fail(`Missing artwork for: ${missing.join(', ')}`);
  if (extra.length) notes.push(`Unexpected extra images: ${extra.join(', ')}`);
  if (!missing.length) ok(`All ${IMAGES.length} shot images present.`);

  const tiny = [...present].filter((id) => statSync(`public/images/${id}.jpg`).size < 20_000);
  if (tiny.length) fail(`Suspiciously small image files (likely broken): ${tiny.join(', ')}`);
}

// --- report -----------------------------------------------------------------
console.log('\n--- checks passed ---');
for (const n of notes) console.log('  ' + n);
if (problems.length) {
  console.log('\n--- PROBLEMS ---');
  for (const p of problems) console.log('  ' + p);
  console.log(`\n${problems.length} problem(s). Not ready to render.\n`);
  process.exit(1);
}
console.log('\nAll checks passed. Ready to render.\n');
