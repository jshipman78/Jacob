// The pipeline's language-model transport.
//
// Every generative stage — research, claim drafting, adversarial fact-check,
// script writing — goes through here. The transport is the `claude` CLI in
// headless mode (`claude -p`), which is what gives the pipeline live web
// research without asking the user to provision a second API credential: if
// they can run Claude Code in this repo, they can run this pipeline.
//
// Two things this module does that a naive wrapper would not:
//
//  1. It reads `--output-format stream-json` and *counts actual tool calls*.
//     A model asked to research a topic will happily answer from memory and
//     produce confident, plausible, uncited prose. Stages that require live
//     sources declare `requireTools: ['WebSearch']`, and the call fails loudly
//     if the model never reached the network. Fabrication is a hard error
//     here, not a silent degradation.
//
//  2. It handles JSON extraction, validation and repair, because every stage
//     in this pipeline exchanges structured data rather than prose.

import { spawn } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { PipelineError, step, warn, dim } from './log.mjs';
import { ROOT, workDir, ensureDir } from './paths.mjs';

/** Tools a research/fact-check call needs. ToolSearch is how WebSearch and
 *  WebFetch get surfaced in some Claude Code configurations, so it is always
 *  allowed alongside them. */
export const WEB_TOOLS = ['WebSearch', 'WebFetch', 'ToolSearch'];

/**
 * Tools every stage is explicitly denied.
 *
 * Passing `--allowedTools` alone is not a sandbox: it governs what is
 * permitted without prompting, and in headless mode a subprocess still reaches
 * for whatever else it thinks would help. An observed research run used Bash
 * sixteen times and spawned two sub-agents, inside this repository, while
 * "only" being allowed the web tools.
 *
 * No stage here needs to touch the filesystem or spawn anything — each one
 * takes text in and returns JSON — so the capability is removed rather than
 * merely left unrequested.
 */
export const DENIED_TOOLS = [
  'Bash', 'Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Read', 'Glob', 'Grep',
  'Task', 'Agent', 'Skill', 'TodoWrite', 'KillBash', 'BashOutput',
  // Not destructive, but a writing stage reaching for these means it has
  // misread the assignment — and Artifact publishes to a URL.
  'Artifact', 'ScheduleWakeup', 'SendMessage', 'AskUserQuestion',
];

const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000;

// --- cost ledger -----------------------------------------------------------

const ledger = { calls: 0, costUsd: 0, byLabel: {} };

export const costSoFar = () => ({ ...ledger, byLabel: { ...ledger.byLabel } });

function recordCost(label, costUsd, meta) {
  ledger.calls += 1;
  ledger.costUsd += costUsd || 0;
  ledger.byLabel[label] = (ledger.byLabel[label] || 0) + (costUsd || 0);
  if (meta?.slug) {
    try {
      const p = path.join(ensureDir(workDir(meta.slug)), 'llm-calls.jsonl');
      appendFileSync(p, `${JSON.stringify({ at: new Date().toISOString(), label, costUsd, ...meta })}\n`);
    } catch {
      /* the ledger is a convenience, never a reason to fail a run */
    }
  }
}

// --- transport -------------------------------------------------------------

function claudeAvailable() {
  return new Promise((resolve) => {
    const p = spawn('claude', ['--version'], { stdio: 'ignore' });
    p.on('error', () => resolve(false));
    p.on('exit', (code) => resolve(code === 0));
  });
}

/**
 * One headless Claude call.
 *
 * @param {object} o
 * @param {string} o.prompt        The user prompt (sent on stdin — no argv length limit).
 * @param {string} [o.system]      Replaces the default system prompt entirely.
 * @param {string} [o.model]       'sonnet' (default), 'opus', or a full model id.
 * @param {string[]} [o.tools]     Tools to allow. Defaults to none.
 * @param {string[]} [o.requireTools]  Fail unless each of these was actually invoked.
 * @param {string} o.label         Short stage label, for logs and the cost ledger.
 * @param {string} [o.slug]        Topic slug, so calls are recorded per project.
 * @param {number} [o.timeoutMs]
 * @returns {Promise<{text:string, toolCounts:Record<string,number>, costUsd:number, numTurns:number}>}
 */
export async function callClaude({
  prompt,
  system,
  model = 'sonnet',
  tools = [],
  requireTools = [],
  label = 'llm',
  slug = null,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  if (!(await claudeAvailable())) {
    throw new PipelineError(
      'The `claude` CLI is not on PATH, so this pipeline cannot research, fact-check or write.',
      'Install Claude Code (https://claude.com/claude-code) and make sure `claude --version` works, ' +
        'then re-run. Every generative stage in this pipeline is a headless `claude -p` call; there is ' +
        'no offline fallback, by design — a pipeline that invents its sources is worse than one that stops.'
    );
  }

  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--model', model];
  if (system) args.push('--system-prompt', system);
  if (tools.length) args.push('--allowedTools', ...tools);
  // Order matters: the variadic --allowedTools would otherwise swallow this.
  args.push('--disallowedTools', ...DENIED_TOOLS.filter((t) => !tools.includes(t)));

  const child = spawn('claude', args, {
    cwd: ROOT,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  });

  const toolCounts = {};
  let resultText = null;
  let costUsd = 0;
  let numTurns = 0;
  let isError = false;
  let apiErrorStatus = null;
  let stderr = '';
  let buffer = '';
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    child.kill('SIGKILL');
  }, timeoutMs);

  child.stdin.write(prompt);
  child.stdin.end();
  child.stderr.on('data', (d) => {
    stderr += d.toString('utf8');
  });

  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    let idx;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }
      if (msg.type === 'assistant' && Array.isArray(msg.message?.content)) {
        for (const block of msg.message.content) {
          if (block.type === 'tool_use' || block.type === 'server_tool_use') {
            toolCounts[block.name] = (toolCounts[block.name] || 0) + 1;
          }
        }
      } else if (msg.type === 'result') {
        resultText = msg.result ?? null;
        costUsd = msg.total_cost_usd ?? 0;
        numTurns = msg.num_turns ?? 0;
        isError = Boolean(msg.is_error);
        apiErrorStatus = msg.api_error_status ?? null;
      }
    }
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', resolve);
  });
  clearTimeout(timer);

  if (timedOut) {
    throw new PipelineError(
      `The ${label} stage exceeded its ${Math.round(timeoutMs / 60000)} minute budget and was killed.`,
      'Re-run — completed stages are cached, so it resumes where it stopped. Raise the budget with --timeout=<minutes>.'
    );
  }
  if (exitCode !== 0 || isError || resultText === null) {
    throw new PipelineError(
      `The ${label} stage's model call failed (exit ${exitCode}${apiErrorStatus ? `, api status ${apiErrorStatus}` : ''}).`,
      stderr.trim().slice(0, 1500) || 'No stderr was produced. Check that `claude -p "hello"` works on its own.'
    );
  }

  recordCost(label, costUsd, { slug, model, numTurns, toolCounts });

  const missing = requireTools.filter((t) => !toolCounts[t]);
  if (missing.length) {
    const err = new PipelineError(
      `The ${label} stage was supposed to consult live sources, but never called ${missing.join(' or ')}. ` +
        `Tools actually used: ${Object.keys(toolCounts).join(', ') || 'none'}.`,
      'This pipeline refuses to build a "cited" video on remembered facts. The usual causes, in order:\n' +
        '  1. This was a correction round and the model patched its JSON from context instead of\n' +
        '     re-checking. callClaudeJson retries these; if you are seeing it as a hard failure,\n' +
        '     every attempt came back searchless.\n' +
        '  2. The search backend is blocked, or the tool is not enabled for this account. Verify:\n' +
        `       printf 'Use WebSearch to find today\\'s date.' | claude -p --allowedTools WebSearch\n` +
        '     If that returns a date, the backend is fine and the cause is (1).'
    );
    err.code = 'MISSING_TOOLS';
    throw err;
  }

  const used = Object.entries(toolCounts)
    .map(([k, v]) => `${k}×${v}`)
    .join(' ');
  step(dim(`${label}: ${numTurns} turns, $${costUsd.toFixed(3)}${used ? `, ${used}` : ''}`));

  return { text: resultText, toolCounts, costUsd, numTurns };
}

// --- structured output -----------------------------------------------------

/** Pulls the first JSON value out of a model reply, fenced or bare. */
export function extractJson(text) {
  const fenced = /```(?:json)?\s*\n([\s\S]*?)\n?```/g;
  const candidates = [];
  let m;
  while ((m = fenced.exec(text)) !== null) candidates.push(m[1]);
  candidates.push(text);

  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    try {
      return JSON.parse(trimmed);
    } catch {
      /* try harder below */
    }
    const start = trimmed.search(/[[{]/);
    if (start === -1) continue;
    const open = trimmed[start];
    const close = open === '{' ? '}' : ']';
    const end = trimmed.lastIndexOf(close);
    if (end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        /* fall through to the next candidate */
      }
    }
  }
  return null;
}

/**
 * A Claude call that must return JSON matching a caller-supplied validator.
 *
 * On a parse or validation failure the error is fed back to a fresh call so
 * the model can correct itself, up to `attempts` times. `validate` should
 * return an array of human-readable problems (empty means valid).
 */
export async function callClaudeJson({ validate = () => [], attempts = 3, ...opts }) {
  // A correction round is still a research call. Telling the model to "return
  // corrected JSON only" reads as "stop using tools" — it then patches the
  // structure from what it already had in context, calls nothing, and trips the
  // requireTools guard in callClaude, which is fatal rather than retryable. One
  // missing verdict in one batch used to kill an entire film that way, and the
  // error blamed the sandbox for a search backend that was working fine. So
  // when a call must consult live sources, the retry says so too.
  const mustSearch = (opts.requireTools ?? []).length > 0;
  const correctionRule = mustSearch
    ? `Fix only what was rejected; leave everything else as it was.\n` +
      `You must still consult live sources on this attempt — call ${(opts.requireTools ?? []).join(' and ')} ` +
      `again for whatever you are correcting, and do not fill a gap from memory. ` +
      `Then return the corrected JSON as your final message, with no prose around it.`
    : 'Return corrected JSON only. No prose before or after it.';

  let lastProblem = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const prompt =
      attempt === 1
        ? opts.prompt
        : `${opts.prompt}\n\n---\nYour previous reply was rejected:\n${lastProblem}\n\n${correctionRule}`;

    let text;
    let rest;
    try {
      // eslint-disable-next-line no-await-in-loop
      ({ text, ...rest } = await callClaude({ ...opts, prompt }));
    } catch (e) {
      // A searchless correction round is a bad attempt, not a dead pipeline —
      // the next one is told again to go and look. Only give up once every
      // attempt has come back without touching a source.
      if (e?.code !== 'MISSING_TOOLS' || attempt === attempts) throw e;
      lastProblem = `You answered without consulting live sources. ${e.message}`;
      warn(`${opts.label}: no live sources on attempt ${attempt}/${attempts} — retrying with a search required.`);
      continue;
    }
    const data = extractJson(text);
    if (data === null) {
      lastProblem = 'The reply contained no parseable JSON value.';
      warn(`${opts.label}: unparseable JSON (attempt ${attempt}/${attempts}) — retrying.`);
      continue;
    }
    const problems = validate(data) ?? [];
    if (problems.length === 0) return { data, ...rest };
    lastProblem = problems.map((p) => `- ${p}`).join('\n');
    warn(`${opts.label}: rejected (attempt ${attempt}/${attempts}) — retrying.`);
    // Print the actual complaints. A run that only reports "2 schema problems"
    // gives you no way to tell a model that needs another go from a validator
    // that is wrong, which is the difference between waiting and fixing.
    for (const problem of problems.slice(0, 6)) step(dim(`   ${problem}`));
    if (problems.length > 6) step(dim(`   …and ${problems.length - 6} more`));
  }
  throw new PipelineError(
    `The ${opts.label} stage could not produce valid structured output after ${attempts} attempts.`,
    `Last set of problems:\n${lastProblem}`
  );
}
