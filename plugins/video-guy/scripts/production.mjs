#!/usr/bin/env node
// production — read and mutate a production manifest.
//
// Agents must go through this rather than hand-editing production.json. Three
// reasons: writes are atomic (temp file + rename), every mutation appends to
// the log, and `next` computes runnable stages from one dependency graph
// instead of five agents each remembering a different one.
//
//   node plugins/video-guy/scripts/production.mjs init "the Great Emu War" --minutes=14 --style=archival
//   node plugins/video-guy/scripts/production.mjs list
//   node plugins/video-guy/scripts/production.mjs show VID-2026-001
//   node plugins/video-guy/scripts/production.mjs next VID-2026-001
//   node plugins/video-guy/scripts/production.mjs stage VID-2026-001 research done --artifact=... --cost=0.42
//   node plugins/video-guy/scripts/production.mjs set VID-2026-001 state in-production
//   node plugins/video-guy/scripts/production.mjs log VID-2026-001 video-producer "greenlit" "14 min, archival"
//   node plugins/video-guy/scripts/production.mjs asset VID-2026-001 --json='{...}'
//   node plugins/video-guy/scripts/production.mjs cost VID-2026-001 render 1.20 "remotion render"
//   node plugins/video-guy/scripts/production.mjs check VID-2026-001
//   node plugins/video-guy/scripts/production.mjs sync VID-2026-001     (reconcile cli stages from --status)

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..', '..', '..');
export const PRODUCTIONS = path.join(ROOT, 'productions');

// ---------------------------------------------------------------------------
// The stage graph. One definition, shared by every agent.
// ---------------------------------------------------------------------------

/**
 * `needs` is a hard dependency: the stage cannot start until all of them are
 * `done`. `executor: 'cli'` stages are run by pipeline/cli.mjs --only=<cliStage>
 * and are cached by it; `agent` stages are performed by a specialist and write
 * into productions/<id>/.
 */
export const GRAPH = {
  scout:      { needs: [],                                   owner: 'history-topic-scout',      executor: 'agent' },
  research:   { needs: [],                                   owner: 'historical-researcher',    executor: 'cli', cliStage: 'research' },
  claims:     { needs: ['research'],                         owner: 'historical-researcher',    executor: 'cli', cliStage: 'claims' },
  factcheck:  { needs: ['claims'],                           owner: 'historical-fact-checker',  executor: 'cli', cliStage: 'factcheck' },
  story:      { needs: ['factcheck'],                        owner: 'documentary-story-editor', executor: 'agent' },
  script:     { needs: ['story'],                            owner: 'documentary-scriptwriter', executor: 'cli', cliStage: 'script' },
  verify:     { needs: ['script'],                           owner: 'historical-fact-checker',  executor: 'cli', cliStage: 'verify' },
  visuals:    { needs: ['verify'],                           owner: 'visual-director',          executor: 'cli', cliStage: 'visuals' },
  storyboard: { needs: ['visuals'],                          owner: 'visual-director',          executor: 'agent' },
  archival:   { needs: ['storyboard'],                       owner: 'historical-archivist',     executor: 'agent' },
  generated:  { needs: ['storyboard'],                       owner: 'ai-visual-artist',         executor: 'agent' },
  motion:     { needs: ['storyboard'],                       owner: 'visual-director',          executor: 'agent' },
  narrate:    { needs: ['visuals'],                          owner: 'voice-producer',           executor: 'cli', cliStage: 'narrate' },
  sound:      { needs: ['narrate'],                          owner: 'documentary-editor',       executor: 'agent' },
  render:     { needs: ['narrate', 'archival', 'generated', 'motion'], owner: 'documentary-editor', executor: 'cli', cliStage: 'render' },
  captions:   { needs: ['narrate'],                          owner: 'documentary-editor',       executor: 'agent' },
  citations:  { needs: ['verify'],                           owner: 'documentary-editor',       executor: 'cli', cliStage: 'citations' },
  qc:         { needs: ['render', 'citations'],              owner: 'video-qc',                 executor: 'agent' },
  master:     { needs: ['qc'],                               owner: 'documentary-editor',       executor: 'agent' },
};

export const STAGE_IDS = Object.keys(GRAPH);

/** Stages that must re-run when `stage` is invalidated. */
export function downstreamOf(stage) {
  const out = new Set();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [id, def] of Object.entries(GRAPH)) {
      if (out.has(id)) continue;
      if (def.needs.some((n) => n === stage || out.has(n))) {
        out.add(id);
        changed = true;
      }
    }
  }
  return [...out];
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

const SUBDIRS = [
  'research', 'story', 'storyboard', 'audio', 'qc',
  'assets/archival', 'assets/generated', 'assets/maps', 'assets/graphics', 'assets/video',
];

export const prodDir = (id) => path.join(PRODUCTIONS, id);
export const manifestPath = (id) => path.join(prodDir(id), 'production.json');

export function slugify(topic) {
  const slug = String(topic)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  if (!slug) throw new Error(`Topic "${topic}" has no usable characters for a slug.`);
  return slug;
}

export function readManifest(id) {
  const p = manifestPath(id);
  if (!existsSync(p)) throw new Error(`No production ${id} at ${path.relative(ROOT, p)}.`);
  return JSON.parse(readFileSync(p, 'utf8'));
}

/** Atomic write: a crashed agent leaves the old manifest intact, not half a new one. */
export function writeManifest(m) {
  m.updatedAt = new Date().toISOString();
  const p = manifestPath(m.id);
  const tmp = `${p}.tmp`;
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(tmp, `${JSON.stringify(m, null, 2)}\n`);
  renameSync(tmp, p);
  return p;
}

export function appendLog(m, actor, event, detail = '') {
  (m.log ??= []).push({ at: new Date().toISOString(), actor, event, detail });
  if (m.log.length > 500) m.log.splice(0, m.log.length - 500);
  return m;
}

export function listProductions() {
  if (!existsSync(PRODUCTIONS)) return [];
  return readdirSync(PRODUCTIONS)
    .filter((d) => /^VID-\d{4}-\d{3}$/.test(d) && existsSync(manifestPath(d)))
    .sort()
    .map((d) => readManifest(d));
}

function nextId(year) {
  const used = listProductions()
    .map((m) => m.id)
    .filter((id) => id.startsWith(`VID-${year}-`))
    .map((id) => Number(id.slice(-3)));
  const n = (used.length ? Math.max(...used) : 0) + 1;
  return `VID-${year}-${String(n).padStart(3, '0')}`;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function flag(args, name, fallback = null) {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

function cmdInit(args) {
  const topic = args.filter((a) => !a.startsWith('--')).join(' ').trim();
  if (!topic) throw new Error('init needs a topic: init "the Great Emu War" [--minutes=14] [--style=archival]');
  const now = new Date();
  const id = flag(args, 'id') ?? nextId(now.getUTCFullYear());
  const slug = flag(args, 'slug') ?? slugify(topic);

  if (existsSync(manifestPath(id))) throw new Error(`${id} already exists.`);
  for (const d of SUBDIRS) mkdirSync(path.join(prodDir(id), d), { recursive: true });

  const stages = {};
  for (const [sid, def] of Object.entries(GRAPH)) {
    stages[sid] = { status: 'pending', owner: def.owner, executor: def.executor, artifact: null, cacheKey: null, startedAt: null, updatedAt: null, attempts: 0, costUsd: 0, notes: '' };
  }

  const m = {
    schemaVersion: 1,
    id,
    slug,
    topic,
    title: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    state: 'approved',
    blockedReason: null,
    brief: {
      targetMinutes: Number(flag(args, 'minutes', '14')),
      style: flag(args, 'style', 'archival'),
      voice: flag(args, 'voice', 'Voice1'),
      audience: flag(args, 'audience', 'General-interest history viewers who want the real story, hedges included.'),
      narrationStyle: flag(args, 'narration', 'Conversational, plain-spoken, specific. Curiosity over authority.'),
      angle: flag(args, 'angle', ''),
      composition: flag(args, 'composition', 'TroyVideo'),
      model: flag(args, 'model', 'sonnet'),
    },
    scout: null,
    stages,
    assets: [],
    budget: { capUsd: Number(flag(args, 'cap', '25')), spentUsd: 0, byStage: {}, entries: [] },
    deliverables: { video: null, preview: null, citations: null, transcript: null, captions: null, thumbnail: null, description: null },
    qc: { status: 'not-run', ranAt: null, reportPath: null, findings: [] },
    log: [],
  };
  appendLog(m, flag(args, 'actor', 'video-guy'), 'created', `${topic} · ${m.brief.targetMinutes} min · ${m.brief.style}`);
  writeManifest(m);
  process.stdout.write(`${id}\t${slug}\t${path.relative(ROOT, prodDir(id))}\n`);
}

function cmdList() {
  const all = listProductions();
  if (!all.length) return void process.stdout.write('No productions.\n');
  for (const m of all) {
    const done = Object.values(m.stages).filter((s) => s.status === 'done').length;
    const failed = Object.values(m.stages).filter((s) => s.status === 'failed').length;
    process.stdout.write(
      `${m.id}  ${String(m.state).padEnd(13)} ${String(`${done}/${STAGE_IDS.length}`).padEnd(6)}` +
        `${failed ? `${failed} failed  ` : '          '}$${(m.budget?.spentUsd ?? 0).toFixed(2)}/$${(m.budget?.capUsd ?? 0).toFixed(0)}  ${m.topic}\n`
    );
  }
}

function cmdShow(id) {
  const m = readManifest(id);
  process.stdout.write(`${JSON.stringify(m, null, 2)}\n`);
}

function cmdNext(id) {
  const m = readManifest(id);
  const status = (s) => m.stages[s]?.status ?? 'pending';
  const runnable = STAGE_IDS.filter((s) => ['pending', 'stale', 'failed'].includes(status(s)) && GRAPH[s].needs.every((n) => status(n) === 'done' || status(n) === 'skipped'));
  const blocked = STAGE_IDS.filter((s) => ['pending', 'stale'].includes(status(s)) && !runnable.includes(s));

  process.stdout.write(`\n${m.id}  ${m.topic}\n\n  runnable now (dispatch these in parallel):\n`);
  if (!runnable.length) process.stdout.write('    — none\n');
  for (const s of runnable) {
    const g = GRAPH[s];
    process.stdout.write(`    ${s.padEnd(11)} ${String(g.owner).padEnd(26)} ${g.executor === 'cli' ? `cli --only=${g.cliStage}` : 'agent'}${status(s) === 'failed' ? `  (retry ${m.stages[s].attempts})` : ''}\n`);
  }
  process.stdout.write('\n  waiting on upstream:\n');
  for (const s of blocked) {
    const missing = GRAPH[s].needs.filter((n) => status(n) !== 'done' && status(n) !== 'skipped');
    process.stdout.write(`    ${s.padEnd(11)} needs ${missing.join(', ')}\n`);
  }
  process.stdout.write('\n');
}

function cmdStage(args) {
  const [id, stage, status, ...rest] = args;
  if (!GRAPH[stage]) throw new Error(`Unknown stage "${stage}". One of: ${STAGE_IDS.join(', ')}`);
  const allowed = ['pending', 'running', 'done', 'failed', 'skipped', 'stale'];
  if (!allowed.includes(status)) throw new Error(`Unknown status "${status}". One of: ${allowed.join(', ')}`);

  const m = readManifest(id);
  const s = (m.stages[stage] ??= { status: 'pending', attempts: 0, costUsd: 0 });
  const actor = flag(rest, 'actor', GRAPH[stage].owner);

  s.status = status;
  s.owner = GRAPH[stage].owner;
  s.executor = GRAPH[stage].executor;
  s.updatedAt = new Date().toISOString();
  if (status === 'running') { s.startedAt = s.updatedAt; s.attempts = (s.attempts ?? 0) + 1; s.error = null; }
  const artifact = flag(rest, 'artifact'); if (artifact) s.artifact = artifact;
  const key = flag(rest, 'key'); if (key) s.cacheKey = key;
  const notes = flag(rest, 'notes'); if (notes) s.notes = notes;
  const error = flag(rest, 'error'); if (error) s.error = error;
  const cost = flag(rest, 'cost'); if (cost) addCost(m, stage, Number(cost), `${stage} stage`);

  // Finishing a stage invalidates anything downstream that had already run.
  const restaled = [];
  if (status === 'done' && rest.includes('--invalidate')) {
    for (const d of downstreamOf(stage)) {
      if (m.stages[d]?.status === 'done') { m.stages[d].status = 'stale'; restaled.push(d); }
    }
  }

  appendLog(m, actor, `${stage}:${status}`, [notes, error, restaled.length ? `stale: ${restaled.join(', ')}` : ''].filter(Boolean).join(' · '));
  writeManifest(m);
  process.stdout.write(`${id} ${stage} → ${status}${restaled.length ? `  (marked stale: ${restaled.join(', ')})` : ''}\n`);
}

function addCost(m, stage, usd, what, units = null) {
  const b = (m.budget ??= { capUsd: 0, spentUsd: 0, byStage: {}, entries: [] });
  b.spentUsd = Number(((b.spentUsd ?? 0) + usd).toFixed(4));
  b.byStage[stage] = Number(((b.byStage[stage] ?? 0) + usd).toFixed(4));
  (b.entries ??= []).push({ at: new Date().toISOString(), stage, usd, what, units });
  if (m.stages[stage]) m.stages[stage].costUsd = Number(((m.stages[stage].costUsd ?? 0) + usd).toFixed(4));
  return b;
}

function cmdCost(args) {
  const [id, stage, usd, ...what] = args;
  const m = readManifest(id);
  const b = addCost(m, stage, Number(usd), what.filter((a) => !a.startsWith('--')).join(' ') || stage, Number(flag(args, 'units')) || null);
  appendLog(m, flag(args, 'actor', 'video-producer'), 'cost', `${stage} $${Number(usd).toFixed(2)}`);
  writeManifest(m);
  const over = b.spentUsd > b.capUsd;
  process.stdout.write(`$${b.spentUsd.toFixed(2)} of $${b.capUsd.toFixed(2)}${over ? '  *** OVER CAP — stop and ask the user ***' : ''}\n`);
  if (over) process.exitCode = 3;
}

function cmdSet(args) {
  const [id, dotted, ...valueParts] = args.filter((a) => !a.startsWith('--'));
  const m = readManifest(id);
  const raw = valueParts.join(' ');
  let value = raw;
  if (raw === 'true') value = true;
  else if (raw === 'false') value = false;
  else if (raw === 'null') value = null;
  else if (raw !== '' && !Number.isNaN(Number(raw)) && /^-?\d+(\.\d+)?$/.test(raw)) value = Number(raw);
  else if (raw.startsWith('{') || raw.startsWith('[')) value = JSON.parse(raw);

  const keys = dotted.split('.');
  let node = m;
  for (const k of keys.slice(0, -1)) node = node[k] ??= {};
  node[keys.at(-1)] = value;
  appendLog(m, flag(args, 'actor', 'video-producer'), 'set', `${dotted} = ${raw.slice(0, 120)}`);
  writeManifest(m);
  process.stdout.write(`${id} ${dotted} = ${raw.slice(0, 120)}\n`);
}

function cmdLog(args) {
  const [id, actor, event, ...detail] = args;
  const m = readManifest(id);
  appendLog(m, actor, event, detail.join(' '));
  writeManifest(m);
  process.stdout.write(`logged\n`);
}

function cmdAsset(args) {
  const [id] = args;
  const m = readManifest(id);
  const json = flag(args, 'json');
  if (!json) throw new Error("asset needs --json='{\"id\":...,\"kind\":...,\"authenticity\":...,\"path\":...}'");
  const asset = JSON.parse(json);
  for (const req of ['id', 'kind', 'authenticity', 'path']) {
    if (!asset[req]) throw new Error(`asset is missing required field "${req}".`);
  }
  if (!['authentic', 'recreation', 'synthetic', 'diagram'].includes(asset.authenticity)) {
    throw new Error(`authenticity must be authentic | recreation | synthetic | diagram (got "${asset.authenticity}").`);
  }
  const i = (m.assets ??= []).findIndex((a) => a.id === asset.id);
  if (i >= 0) m.assets[i] = { ...m.assets[i], ...asset };
  else m.assets.push(asset);
  appendLog(m, flag(args, 'actor', 'historical-archivist'), 'asset', `${asset.id} (${asset.authenticity})`);
  writeManifest(m);
  process.stdout.write(`${asset.id} recorded (${m.assets.length} assets)\n`);
}

/** Reconcile cli stage rows against what pipeline/cli.mjs actually has cached. */
function cmdSync(id) {
  const m = readManifest(id);
  let out = '';
  try {
    out = execFileSync('node', ['pipeline/cli.mjs', m.topic, '--slug', m.slug, '--status'], { cwd: ROOT, encoding: 'utf8' });
  } catch (err) {
    throw new Error(`Could not read pipeline status: ${err.message}`);
  }
  const changed = [];
  for (const [sid, def] of Object.entries(GRAPH)) {
    if (def.executor !== 'cli') continue;
    // "  ✔ research    <key>  <timestamp>"  vs  "  · research    not run"
    const line = out.split('\n').find((l) => new RegExp(`[✔·]\\s+${def.cliStage}\\b`).test(l));
    if (!line) continue;
    const cached = line.includes('✔');
    const key = cached ? (line.trim().split(/\s+/)[2] ?? null) : null;
    const s = (m.stages[sid] ??= { status: 'pending', attempts: 0, costUsd: 0 });
    if (cached && s.status !== 'done') { s.status = 'done'; s.cacheKey = key; changed.push(`${sid}→done`); }
    if (!cached && s.status === 'done' && !['render', 'citations'].includes(def.cliStage)) { s.status = 'pending'; changed.push(`${sid}→pending`); }
  }
  if (changed.length) appendLog(m, 'video-producer', 'sync', changed.join(', '));
  writeManifest(m);
  process.stdout.write(changed.length ? `reconciled: ${changed.join(', ')}\n` : 'already in sync\n');
}

/** Structural check. Not a full JSON Schema validation — the invariants that bite. */
function cmdCheck(id) {
  const m = readManifest(id);
  const problems = [];
  if (m.slug !== slugify(m.topic) && !m.log.some((l) => l.event === 'set' && l.detail.startsWith('slug'))) {
    problems.push(`slug "${m.slug}" does not match slugify(topic) "${slugify(m.topic)}" — the CLI will write to a different work dir unless every call passes --slug=${m.slug}.`);
  }
  for (const [sid, s] of Object.entries(m.stages)) {
    if (!GRAPH[sid]) problems.push(`unknown stage "${sid}".`);
    if (s.status === 'done' && GRAPH[sid]) {
      const unmet = GRAPH[sid].needs.filter((n) => !['done', 'skipped'].includes(m.stages[n]?.status));
      if (unmet.length) problems.push(`${sid} is done but ${unmet.join(', ')} is not — something ran out of order.`);
    }
    if (s.attempts > 3 && s.status !== 'done') problems.push(`${sid} has failed ${s.attempts} times; stop retrying and escalate.`);
  }
  for (const a of m.assets ?? []) {
    if (!a.rights?.status || a.rights.status === 'unknown') problems.push(`asset ${a.id} has no cleared rights status.`);
    if (a.authenticity !== 'authentic' && a.kind?.startsWith('archival')) problems.push(`asset ${a.id} is kind "${a.kind}" but authenticity "${a.authenticity}" — a recreation must not be catalogued as archival.`);
  }
  if ((m.budget?.spentUsd ?? 0) > (m.budget?.capUsd ?? 0)) problems.push(`over budget: $${m.budget.spentUsd.toFixed(2)} of $${m.budget.capUsd.toFixed(2)}.`);
  const openBlocking = (m.qc?.findings ?? []).filter((f) => f.severity === 'blocking' && f.status === 'open');
  if (openBlocking.length) problems.push(`${openBlocking.length} open blocking QC finding(s).`);

  if (!problems.length) return void process.stdout.write(`${id} OK\n`);
  process.stdout.write(`${id} — ${problems.length} problem(s):\n${problems.map((p) => `  - ${p}`).join('\n')}\n`);
  process.exitCode = 2;
}

const USAGE = `production — read and mutate a production manifest.

  init <topic> [--minutes= --style= --voice= --audience= --angle= --cap= --slug= --id=]
  list
  show <id>
  next <id>                         what can run now, and what is waiting
  stage <id> <stage> <status> [--artifact= --key= --notes= --error= --cost= --actor= --invalidate]
  set <id> <dotted.path> <value>
  cost <id> <stage> <usd> <what> [--units=]
  asset <id> --json='{...}'
  log <id> <actor> <event> [detail...]
  sync <id>                         reconcile cli stages against pipeline --status
  check <id>                        assert the invariants

Stages: ${STAGE_IDS.join(' ')}`;

function main() {
  const [cmd, ...args] = process.argv.slice(2);
  switch (cmd) {
    case 'init': return cmdInit(args);
    case 'list': return cmdList();
    case 'show': return cmdShow(args[0]);
    case 'next': return cmdNext(args[0]);
    case 'stage': return cmdStage(args);
    case 'set': return cmdSet(args);
    case 'cost': return cmdCost(args);
    case 'asset': return cmdAsset(args);
    case 'log': return cmdLog(args);
    case 'sync': return cmdSync(args[0]);
    case 'check': return cmdCheck(args[0]);
    default: process.stdout.write(`${USAGE}\n`); if (cmd) process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`production: ${err.message}\n`);
    process.exit(1);
  }
}
