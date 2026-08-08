// Stage 5b — applying the audit's corrections.
//
// The narration audit produces a specific replacement sentence for every
// finding it raises. Without this stage that is wasted: the build stops, and
// the only recourses are to reroll the whole section and hope, or to wave the
// finding through with --allow-findings. Both are worse than simply making the
// correction the auditor already wrote.
//
// The revision is deliberately narrow. Only the sentences named in findings are
// touched; everything else in the script is passed through byte-identically, so
// a correction cannot quietly restructure a section. Cached narration audio for
// untouched sentences stays valid, which means fixing one sentence
// re-synthesizes one sentence.
//
// Pronunciation overrides are regenerated alongside the text, because a
// corrected sentence that gains a date needs "one forty-six B C" and a stale
// override would be read against the wrong words.

import { runStage } from '../core/cache.mjs';
import { callClaudeJson } from '../core/llm.mjs';
import { info, step, warn } from '../core/log.mjs';
import { DELIVERY } from '../prompts/house-style.mjs';

export const REVISE_VERSION = 1;

const CUT = /^\s*(cut|delete|remove)\b/i;

/** Every sentence in the script, with a stable address. */
function index(script) {
  const out = [];
  script.sections.forEach((sec, si) =>
    sec.paragraphs.forEach((par, pi) =>
      par.sentences.forEach((s, xi) => out.push({ si, pi, xi, sentence: s, sectionTitle: sec.title }))
    )
  );
  return out;
}

const normalize = (s) => String(s ?? '').replace(/[\s]+/g, ' ').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim();

/** Matches a finding's quoted sentence back to the script, tolerating truncation. */
function locate(entries, quoted) {
  const q = normalize(quoted).replace(/…$/, '').replace(/\.\.\.$/, '');
  let hit = entries.find((e) => normalize(e.sentence.text) === q);
  if (hit) return hit;
  hit = entries.find((e) => normalize(e.sentence.text).startsWith(q.slice(0, 60)));
  if (hit) return hit;
  return entries.find((e) => q.length > 25 && normalize(e.sentence.text).includes(q.slice(0, 40)));
}

function validate(count) {
  return (data) => {
    const p = [];
    if (!data || !Array.isArray(data.revisions)) return ['Top level must be {"revisions": [...]}.'];
    if (data.revisions.length !== count) {
      p.push(`Expected exactly ${count} revision(s), one per finding, in the same order. Got ${data.revisions.length}.`);
    }
    data.revisions.forEach((r, i) => {
      const at = `revisions[${i}]`;
      if (typeof r.action !== 'string' || !['replace', 'cut'].includes(r.action)) {
        p.push(`${at}.action must be "replace" or "cut".`);
      }
      if (r.action === 'replace') {
        if (typeof r.text !== 'string' || r.text.trim().length < 10) p.push(`${at}.text must be the corrected sentence.`);
        else if (!/[.?!”"]$/.test(r.text.trim())) p.push(`${at}.text must end with terminal punctuation.`);
        if (r.tts != null && (typeof r.tts !== 'string' || r.tts.trim() === r.text?.trim())) {
          p.push(`${at}.tts must be a distinct spoken respelling, or null.`);
        }
        if (/\d/.test(r.text ?? '') && !r.tts) {
          p.push(`${at}.text contains digits, so it needs a "tts" respelling for the narrator.`);
        }
      }
    });
    return p;
  };
}

function buildPrompt({ findings, located }) {
  const items = findings
    .map((f, i) => {
      const e = located[i];
      return [
        `--- FINDING ${i + 1} (${f.severity} · ${f.type}) in ${f.sectionTitle ?? e?.sectionTitle ?? 'unknown section'}`,
        `SENTENCE AS WRITTEN: ${e ? e.sentence.text : f.sentence}`,
        e?.sentence.tts ? `CURRENT PRONUNCIATION OVERRIDE: ${e.sentence.tts}` : '',
        `PROBLEM: ${f.problem}`,
        `AUDITOR'S SUGGESTED FIX: ${f.fix}`,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');

  return `
An audit of a finished documentary script found the problems below. Apply the
corrections. Do not rewrite anything else.

RULES
  - Correct ONLY what the finding identifies. Keep the sentence's length, tone
    and rhythm as close to the original as the correction allows — it sits inside
    a paragraph that was written around it.
  - The auditor's suggested fix is usually right. Use it, adjusting only if it
    reads badly aloud or repeats a word from the neighbouring sentence.
  - If the fix says to cut the sentence, return action "cut".
  - Never introduce a new fact, figure, date or name that was not already in the
    sentence or in the auditor's suggested fix.

${DELIVERY.split('SUBTITLES.')[0].trim()}

${items}

RETURN a single JSON object, no prose around it, with exactly ${findings.length}
revisions in the same order as the findings above:
{
  "revisions": [
    { "action": "replace",
      "text": "The corrected sentence, properly punctuated.",
      "tts": "Spoken respelling if the sentence contains numerals or abbreviations, otherwise null." }
  ]
}
`.trim();
}

export async function reviseStage({
  slug,
  script,
  scriptKey,
  verify,
  verifyKey,
  force = false,
  model = 'sonnet',
  // The audit loop runs several rounds, and each needs its own artifact —
  // otherwise round two overwrites round one and there is no way to see what
  // each pass actually changed. Mirrors verifyStage's stageName.
  stageName = 'revise',
}) {
  // Low-severity findings are style opinions more often than errors; leave them.
  const findings = verify.findings.filter((f) => f.severity === 'high' || f.severity === 'medium');

  return runStage({
    slug,
    stage: stageName,
    version: REVISE_VERSION,
    inputs: { scriptKey, verifyKey, model, findings: findings.length },
    force,
    detail: `${findings.length} finding(s) to apply`,
    async produce() {
      if (findings.length === 0) return { script, applied: 0, skipped: [] };

      const entries = index(script);
      const located = findings.map((f) => locate(entries, f.sentence));
      const missing = findings.filter((_, i) => !located[i]);
      for (const f of missing) {
        warn(`Could not locate the sentence for a ${f.severity} finding; leaving it: "${f.sentence.slice(0, 70)}…"`);
      }

      const actionable = findings.filter((_, i) => located[i]);
      const actionableLocated = located.filter(Boolean);
      if (actionable.length === 0) return { script, applied: 0, skipped: missing.map((f) => f.sentence) };

      const { data } = await callClaudeJson({
        label: 'revise',
        slug,
        model,
        system:
          'You are a documentary script editor applying fact-check corrections. You change exactly what is ' +
          'wrong and nothing else, and you never introduce a fact the correction did not contain. ' +
          'You return only JSON.',
        prompt: buildPrompt({ findings: actionable, located: actionableLocated }),
        validate: validate(actionable.length),
        attempts: 3,
        timeoutMs: 10 * 60 * 1000,
      });

      // Deep-copy so the cached upstream script artifact is never mutated.
      const revised = JSON.parse(JSON.stringify(script));
      let applied = 0;
      const cuts = [];

      data.revisions.forEach((rev, i) => {
        const at = actionableLocated[i];
        const par = revised.sections[at.si].paragraphs[at.pi];
        const original = par.sentences[at.xi];

        if (rev.action === 'cut' || CUT.test(actionable[i].fix)) {
          if (par.sentences.length <= 1) {
            warn(`Refusing to cut the only sentence in shot "${par.shot}" — replacing is safer than emptying a shot.`);
            return;
          }
          cuts.push({ si: at.si, pi: at.pi, xi: at.xi });
          applied += 1;
          return;
        }

        par.sentences[at.xi] = {
          ...original,
          text: rev.text.trim(),
          ...(rev.tts ? { tts: rev.tts.trim() } : {}),
        };
        if (!rev.tts) delete par.sentences[at.xi].tts;
        step(`${actionable[i].type}: “${original.text.slice(0, 55)}…” → “${rev.text.slice(0, 55)}…”`);
        applied += 1;
      });

      // Remove cuts back-to-front so earlier indices stay valid.
      for (const c of cuts.sort((a, b) => b.xi - a.xi)) {
        revised.sections[c.si].paragraphs[c.pi].sentences.splice(c.xi, 1);
      }

      info(`${applied} correction(s) applied; ${findings.length - applied} left in place.`);
      return { script: revised, applied, skipped: missing.map((f) => f.sentence) };
    },
  });
}
