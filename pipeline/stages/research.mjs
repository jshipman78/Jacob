// Stage 1 — research.
//
// Collects real, reachable sources for the topic. The only thing that makes
// this stage worth having is that it is forbidden from answering out of the
// model's memory: `requireTools: ['WebSearch']` makes the call fail if the
// network was never touched. A pipeline that quietly falls back to recall
// produces a citations file full of plausible, unverifiable references, which
// is worse than no citations file at all.

import { runStage } from '../core/cache.mjs';
import { callClaudeJson, WEB_TOOLS } from '../core/llm.mjs';
import { PipelineError, info, warn } from '../core/log.mjs';

export const RESEARCH_VERSION = 3;

const SOURCE_KINDS = ['academic', 'reference', 'museum', 'primary', 'news', 'other'];
const RELIABILITY = ['high', 'medium', 'low'];

const MIN_SOURCES = 8;
const MIN_HIGH_RELIABILITY = 3;

function validate(data) {
  const p = [];
  if (!data || typeof data !== 'object') return ['Top level must be a JSON object.'];
  for (const f of ['workingTitle', 'period', 'summary', 'historiography']) {
    if (typeof data[f] !== 'string' || !data[f].trim()) p.push(`"${f}" must be a non-empty string.`);
  }
  if (!Array.isArray(data.keyQuestions) || data.keyQuestions.length < 3) {
    p.push('"keyQuestions" must be an array of at least 3 strings.');
  }
  if (!Array.isArray(data.sources)) return [...p, '"sources" must be an array.'];
  if (data.sources.length < MIN_SOURCES) {
    p.push(`"sources" has ${data.sources.length} entries; at least ${MIN_SOURCES} are required.`);
  }
  const ids = new Set();
  data.sources.forEach((s, i) => {
    const at = `sources[${i}]`;
    if (!s.id || typeof s.id !== 'string') p.push(`${at}.id must be a string like "S1".`);
    else if (ids.has(s.id)) p.push(`${at}.id "${s.id}" is duplicated.`);
    else ids.add(s.id);
    if (typeof s.title !== 'string' || !s.title.trim()) p.push(`${at}.title is required.`);
    if (typeof s.url !== 'string' || !/^https?:\/\//.test(s.url)) {
      p.push(`${at}.url must be an absolute http(s) URL that you actually visited.`);
    }
    if (!SOURCE_KINDS.includes(s.kind)) p.push(`${at}.kind must be one of ${SOURCE_KINDS.join('|')}.`);
    if (!RELIABILITY.includes(s.reliability)) p.push(`${at}.reliability must be one of ${RELIABILITY.join('|')}.`);
    if (typeof s.summary !== 'string' || s.summary.trim().length < 20) {
      p.push(`${at}.summary must say what the source establishes (20+ chars).`);
    }
    if (!Array.isArray(s.excerpts) || s.excerpts.length < 1) {
      p.push(`${at}.excerpts must contain at least one {quote, supports} object.`);
    } else {
      s.excerpts.forEach((e, j) => {
        if (!e || typeof e.quote !== 'string' || !e.quote.trim()) {
          p.push(`${at}.excerpts[${j}].quote is required.`);
        }
        if (!e || typeof e.supports !== 'string' || !e.supports.trim()) {
          p.push(`${at}.excerpts[${j}].supports is required.`);
        }
      });
    }
  });
  const high = data.sources.filter((s) => s.reliability === 'high').length;
  if (high < MIN_HIGH_RELIABILITY) {
    p.push(
      `Only ${high} source(s) are marked reliability "high"; at least ${MIN_HIGH_RELIABILITY} are required. ` +
        'Search for peer-reviewed, university-press or museum material.'
    );
  }
  if (!Array.isArray(data.cautions)) p.push('"cautions" must be an array of strings.');
  return p;
}

function buildPrompt(topic, today) {
  return `
Research the historical topic below thoroughly enough that a 15-minute documentary
could be fact-checked against what you collect.

TOPIC: ${topic}

HOW TO WORK
- Use WebSearch and WebFetch. Run at least six distinct searches covering: the
  established narrative, the primary/ancient sources, modern scholarly
  reassessment, disputed numbers and dates, the relevant archaeology or material
  evidence, and popular misconceptions about this topic.
- Prefer university presses, peer-reviewed journals, museum and national-archive
  material, and specialist encyclopaedias. General encyclopaedias are acceptable
  as "reference" but must not be the only support for a load-bearing claim.
- Open the promising results with WebFetch and quote from what you actually read.
- Record a source only if you retrieved it in this session. Do not include a
  citation you remember but did not open. An empty slot is fine; an invented
  reference is not.
- Where a figure is contested (casualty counts, populations, dates, durations),
  record the range AND who argues for which end of it. That disagreement is the
  most valuable thing you can bring back.
- Distinguish what an ancient or contemporary writer *claimed* from what modern
  scholarship *concludes*. A primary source is evidence about what was said.

RETURN
A single JSON object, no prose around it, exactly this shape:

{
  "workingTitle": "A punchy documentary title in caps, under 8 words",
  "period": "e.g. 264-146 BCE",
  "summary": "2-4 neutral sentences orienting a viewer who knows nothing.",
  "keyQuestions": ["3-6 questions a curious viewer would actually want answered"],
  "historiography": "2-5 sentences: where historians disagree about this, and why.",
  "sources": [
    {
      "id": "S1",
      "title": "...",
      "author": "... or empty string",
      "publisher": "journal, press, museum or site name",
      "year": "publication year, or empty string if genuinely unknown",
      "url": "the exact URL you opened",
      "kind": "${SOURCE_KINDS.join('|')}",
      "reliability": "${RELIABILITY.join('|')}",
      "accessedAt": "${today}",
      "summary": "What this source establishes, 1-2 sentences.",
      "excerpts": [{ "quote": "a short passage you actually read", "supports": "what it backs up" }]
    }
  ],
  "cautions": ["Popular myths or contested figures a script about this topic must be careful with"]
}

At least ${MIN_SOURCES} sources, at least ${MIN_HIGH_RELIABILITY} of them reliability "high".
`.trim();
}

export async function researchStage({ slug, topic, force = false, model = 'sonnet' }) {
  const today = new Date().toISOString().slice(0, 10);
  return runStage({
    slug,
    stage: 'research',
    version: RESEARCH_VERSION,
    inputs: { topic, model },
    force,
    detail: `“${topic}”`,
    async produce() {
      const { data } = await callClaudeJson({
        label: 'research',
        slug,
        model,
        system:
          'You are a documentary researcher. You collect sources you have actually opened, you record ' +
          'disagreement between scholars faithfully, and you never present recalled information as a citation. ' +
          'You return only JSON.',
        prompt: buildPrompt(topic, today),
        tools: WEB_TOOLS,
        requireTools: ['WebSearch'],
        validate,
        attempts: 3,
        timeoutMs: 25 * 60 * 1000,
      });

      const byKind = data.sources.reduce((acc, s) => ({ ...acc, [s.kind]: (acc[s.kind] || 0) + 1 }), {});
      info(
        `${data.sources.length} sources ` +
          `(${Object.entries(byKind).map(([k, v]) => `${v} ${k}`).join(', ')}).`
      );
      if (!data.sources.some((s) => s.kind === 'academic')) {
        warn('No peer-reviewed academic source was found. Load-bearing claims will be harder to establish.');
      }
      return { topic, ...data };
    },
  });
}

export function assertResearchUsable(research) {
  if (!research?.sources?.length) {
    throw new PipelineError(
      'The research stage produced no sources, so nothing downstream can be verified.',
      'Re-run with --refresh=research. If it keeps failing, confirm web search works: ' +
        `printf 'Use WebSearch to find the capital of Portugal.' | claude -p --allowedTools WebSearch`
    );
  }
}
