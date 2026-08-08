// Stage 2 — the argument and the claim ledger.
//
// Deliberately separated from writing the narration. If you ask a model for a
// script and a bibliography in one pass, it writes the script it wants and
// attaches whichever citations are nearest — the prose leads and the evidence
// follows. Splitting the stages inverts that: the film commits to a specific
// set of falsifiable assertions first, those assertions get attacked in stage
// 3, and only the survivors are handed to the writer.
//
// It also means the fact-check has something small and checkable to work on —
// one assertion per line, sourced — instead of having to reverse-engineer
// claims out of finished prose.

import { runStage } from '../core/cache.mjs';
import { callClaudeJson } from '../core/llm.mjs';
import { info } from '../core/log.mjs';
import { budgetFor, BEATS, writerSystemPrompt } from '../prompts/house-style.mjs';
import { CHANNEL } from '../channel.mjs';

export const CLAIMS_VERSION = 3;

const BEAT_IDS = BEATS.map((b) => b.id);
const CLAIM_KINDS = ['date', 'number', 'person', 'event', 'quote', 'interpretation', 'context'];
const IMPORTANCE = ['load-bearing', 'supporting', 'color'];

function validate(sourceIds) {
  return (data) => {
    const p = [];
    if (!data || typeof data !== 'object') return ['Top level must be a JSON object.'];
    for (const f of ['thesis', 'throughline', 'coldOpen']) {
      if (typeof data[f] !== 'string' || data[f].trim().length < 15) p.push(`"${f}" must be a substantial string.`);
    }
    if (!Array.isArray(data.sections) || data.sections.length < 5) {
      p.push('"sections" must be an array of at least 5 sections.');
    }
    if (!Array.isArray(data.claims) || data.claims.length < 10) {
      p.push('"claims" must be an array of at least 10 claims.');
    }
    if (p.length && (!Array.isArray(data.sections) || !Array.isArray(data.claims))) return p;

    const claimIds = new Set();
    data.claims.forEach((c, i) => {
      const at = `claims[${i}]`;
      if (!c.id || typeof c.id !== 'string') p.push(`${at}.id must be a string like "C1".`);
      else if (claimIds.has(c.id)) p.push(`${at}.id "${c.id}" is duplicated.`);
      else claimIds.add(c.id);
      if (typeof c.statement !== 'string' || c.statement.trim().length < 15) {
        p.push(`${at}.statement must be a full falsifiable assertion.`);
      }
      if (!CLAIM_KINDS.includes(c.kind)) p.push(`${at}.kind must be one of ${CLAIM_KINDS.join('|')}.`);
      if (!IMPORTANCE.includes(c.importance)) p.push(`${at}.importance must be one of ${IMPORTANCE.join('|')}.`);
      if (!Array.isArray(c.sourceIds) || c.sourceIds.length === 0) {
        p.push(`${at}.sourceIds must list at least one source id from the research.`);
      } else {
        const bad = c.sourceIds.filter((id) => !sourceIds.has(id));
        if (bad.length) p.push(`${at}.sourceIds references unknown source(s): ${bad.join(', ')}.`);
      }
    });

    const sectionIds = new Set();
    data.sections.forEach((s, i) => {
      const at = `sections[${i}]`;
      if (!s.id || typeof s.id !== 'string' || !/^[a-z0-9-]+$/.test(s.id)) {
        p.push(`${at}.id must be a lowercase kebab-case string.`);
      } else if (sectionIds.has(s.id)) p.push(`${at}.id "${s.id}" is duplicated.`);
      else sectionIds.add(s.id);
      if (typeof s.title !== 'string' || s.title !== s.title.toUpperCase()) {
        p.push(`${at}.title must be present and entirely in capitals.`);
      }
      if (!BEAT_IDS.includes(s.beat)) p.push(`${at}.beat must be one of ${BEAT_IDS.join('|')}.`);
      if (typeof s.intent !== 'string' || s.intent.trim().length < 15) p.push(`${at}.intent is required.`);
      if (!Array.isArray(s.claimIds)) p.push(`${at}.claimIds must be an array.`);
      else {
        const bad = s.claimIds.filter((id) => !claimIds.has(id));
        if (bad.length) p.push(`${at}.claimIds references unknown claim(s): ${bad.join(', ')}.`);
      }
    });

    if (data.sections[0]?.beat !== 'cold-open') p.push('The first section must have beat "cold-open".');
    if (data.sections.at(-1)?.beat !== 'outro') p.push('The last section must have beat "outro".');

    const used = new Set(data.sections.flatMap((s) => s.claimIds ?? []));
    const orphans = [...claimIds].filter((id) => !used.has(id));
    if (orphans.length) p.push(`Claims not assigned to any section: ${orphans.join(', ')}.`);

    return p;
  };
}

function buildPrompt({ topic, research, budget, style }) {
  const sourceBlock = research.sources
    .map(
      (s) =>
        `${s.id} [${s.kind}/${s.reliability}] ${s.title}${s.author ? ` — ${s.author}` : ''}` +
        `${s.year ? ` (${s.year})` : ''}\n    ${s.summary}\n    ${s.url}` +
        s.excerpts.map((e) => `\n    “${e.quote.slice(0, 320)}” → ${e.supports}`).join('')
    )
    .join('\n\n');

  const sectionPlan = budget.sections
    .map(
      (s, i) =>
        `${i + 1}. beat=${s.beat} · ~${s.wordBudget} words · ~${s.sentenceTarget} sentences\n` +
        `   title: ${s.titleGuidance}\n   job: ${s.job}`
    )
    .join('\n');

  return `
Design the argument for a ${budget.minutes}-minute documentary on: ${topic}

You are NOT writing narration yet. You are deciding what the film argues and
which specific assertions it will stake that argument on. Those assertions get
attacked by an adversarial fact-checker in the next stage, and anything that
does not survive is cut before a word is written — so state them plainly and
narrowly enough to be checkable.

RESEARCH AVAILABLE
${sourceBlock}

HISTORIOGRAPHY: ${research.historiography}
CAUTIONS FROM RESEARCH: ${(research.cautions ?? []).join(' | ') || '(none recorded)'}

STRUCTURE TO FILL (${budget.totalWords} words total)
${sectionPlan}

THE CHANNEL'S THROUGH-LINE (the outro must land on it):
${CHANNEL.theme}

WHAT MAKES A GOOD THESIS HERE
  Not "the story of X" — an argument about X that a reasonable person could
  disagree with, and that the evidence you have can actually support. The
  reference film's thesis is: "Schliemann found Troy and is simultaneously a
  case study in how history gets distorted by whoever tells it." Note that it
  contains a tension. Yours should too.

CLAIM DISCIPLINE
  - One assertion per claim. Split anything with an "and" joining two facts.
  - Every date, casualty figure, population, duration and named individual you
    intend to put on screen must exist as its own claim. These get the hardest
    scrutiny later, so do not bury them inside an "interpretation" claim.
  - kind "interpretation" is for scholarly readings ("historians now regard X
    as Y"); the claim is that scholars hold that view, and it needs a source
    showing they do.
  - Mark importance "load-bearing" for anything the thesis collapses without.
    Be honest — if you mark everything load-bearing the fact-check cannot
    prioritise.
  - Attach only sources that genuinely support the claim. Padding sourceIds is
    the single most damaging thing you can do at this stage.

RETURN a single JSON object, no prose around it:
{
  "thesis": "One sentence.",
  "throughline": "2-3 sentences on how the argument is carried across sections.",
  "coldOpen": "The concrete specific hook the film opens on — an image or a fact, never a summary.",
  "sections": [
    { "id": "kebab-case", "title": "IN CAPS", "beat": "${BEAT_IDS.join('|')}",
      "intent": "What this section must accomplish.", "claimIds": ["C1","C2"] }
  ],
  "claims": [
    { "id": "C1", "statement": "A single falsifiable assertion.",
      "kind": "${CLAIM_KINDS.join('|')}", "sourceIds": ["S1"],
      "importance": "${IMPORTANCE.join('|')}" }
  ]
}

Use exactly ${budget.sections.length} sections in the beat order given above.
Produce ${Math.max(14, budget.sections.length * 3)} to ${budget.sections.length * 6} claims.
`.trim();
}

export async function claimsStage({ slug, topic, research, researchKey, minutes, style, force = false, model = 'sonnet' }) {
  const budget = budgetFor(minutes);
  const sourceIds = new Set(research.sources.map((s) => s.id));

  return runStage({
    slug,
    stage: 'claims',
    version: CLAIMS_VERSION,
    // Deliberately NOT keyed on the visual style. What a documentary argues,
    // and what survives a fact-check, cannot depend on how it is drawn — and
    // making it depend on that means changing --style silently discards an
    // hour of research and fact-checking. Style enters at the visuals stage,
    // which is exactly where it belongs.
    inputs: { topic, researchKey, minutes, model },
    force,
    detail: `${budget.sections.length} sections · ${budget.totalWords} words`,
    async produce() {
      const { data } = await callClaudeJson({
        label: 'claims',
        slug,
        model,
        system: writerSystemPrompt(),
        prompt: buildPrompt({ topic, research, budget, style }),
        validate: validate(sourceIds),
        attempts: 3,
        timeoutMs: 15 * 60 * 1000,
      });
      const hard = data.claims.filter((c) => ['date', 'number', 'person'].includes(c.kind)).length;
      info(`Thesis: ${data.thesis}`);
      info(`${data.claims.length} claims across ${data.sections.length} sections (${hard} dates/numbers/people).`);
      return { ...data, budget };
    },
  });
}
