// Stage 5 — verifying the finished narration.
//
// Fact-checking the claim ledger is necessary but not sufficient. Between the
// ledger and the finished script, a writer will smooth a hedge away, round a
// figure, promote "one ancient writer reports" into "we know", or add a
// connecting fact that felt obvious and was never checked. Those additions are
// exactly the errors a viewer catches, because they read as confident.
//
// So the written text gets its own adversarial pass: every factual assertion
// in the narration is extracted from the prose itself and matched back to a
// verified claim. Anything that does not trace to one is a finding. Findings
// at "high" severity stop the build unless --allow-findings is passed.

import { runStage } from '../core/cache.mjs';
import { callClaudeJson, WEB_TOOLS } from '../core/llm.mjs';
import { info, warn, fail, PipelineError } from '../core/log.mjs';

export const VERIFY_VERSION = 2;

const SEVERITIES = ['high', 'medium', 'low'];

function validate(data) {
  const p = [];
  if (!data || !Array.isArray(data.findings)) return ['Top level must be {"findings": [...], "assessment": "..."}.'];
  if (typeof data.assessment !== 'string' || data.assessment.trim().length < 20) {
    p.push('"assessment" must be a short honest paragraph on the script\'s overall factual standing.');
  }
  data.findings.forEach((f, i) => {
    const at = `findings[${i}]`;
    if (typeof f.sentence !== 'string' || !f.sentence.trim()) p.push(`${at}.sentence must quote the narration verbatim.`);
    if (!SEVERITIES.includes(f.severity)) p.push(`${at}.severity must be one of ${SEVERITIES.join('|')}.`);
    if (typeof f.problem !== 'string' || f.problem.trim().length < 15) p.push(`${at}.problem must state what is wrong.`);
    if (typeof f.fix !== 'string' || f.fix.trim().length < 10) p.push(`${at}.fix must propose a corrected sentence or a cut.`);
  });
  return p;
}

function buildPrompt({ topic, script, verifiedClaims }) {
  const narration = script.sections
    .map(
      (sec) =>
        `## ${sec.title}\n` +
        sec.paragraphs
          .map((par) => par.sentences.map((s) => `${s.text}${s.claimIds?.length ? `   [${s.claimIds.join(',')}]` : '   [—]'}`).join('\n'))
          .join('\n\n')
    )
    .join('\n\n');

  const claimBlock = verifiedClaims.claims
    .map((c) => `${c.id} [${c.verdict}] ${c.statement}${c.requiredHedge ? `\n    hedge required: "${c.requiredHedge}"` : ''}`)
    .join('\n');

  const dropped = verifiedClaims.droppedClaims?.length
    ? verifiedClaims.droppedClaims.map((c) => `${c.id} (${c.reason}) ${c.statement}`).join('\n')
    : '(none)';

  return `
A documentary script about "${topic}" is finished. Audit the narration itself for
factual overreach. Assume the writer was well-intentioned and careless.

Go sentence by sentence. For each one that asserts anything factual — a date, a
figure, a name, an event, a scholarly position, a causal link — decide whether
it is fully covered by the verified claim list below. Report a finding when:

  OVERREACH      The sentence states more than its claim supports: a firmer
                 date, a rounder number, a stronger causal link, "proved" where
                 the claim says "suggests".
  LOST HEDGE     A disputed claim is delivered flatly, without the qualification
                 the fact-check required.
  UNTRACED       A factual assertion with no claim behind it, and not something
                 a general reader would call common knowledge.
  RESURRECTED    An assertion matching one of the claims that was CUT.
  CONTRADICTION  Two sentences in the script that cannot both be true.
  MISATTRIBUTION A claim cited by a sentence that does not actually support it.

Do NOT report: rhetorical questions, opinions clearly marked as the narrator's
reading, transitional lines, or ordinary background a school textbook would
state without citation. Be strict about numbers and dates and relaxed about
adjectives.

Use WebSearch if a sentence looks wrong and you need to settle it. You are not
required to search for sentences that trace cleanly to a verified claim.

VERIFIED CLAIMS (what the film is allowed to assert)
${claimBlock}

CLAIMS THAT WERE CUT (must not reappear in any form)
${dropped}

THE NARRATION (each sentence's cited claims in brackets; [—] means none cited)
${narration}

RETURN a single JSON object, no prose around it:
{
  "assessment": "An honest paragraph: how well does this script stand up?",
  "findings": [
    { "sentence": "the narration sentence, verbatim",
      "sectionTitle": "which section it is in",
      "type": "OVERREACH|LOST HEDGE|UNTRACED|RESURRECTED|CONTRADICTION|MISATTRIBUTION",
      "severity": "high|medium|low",
      "problem": "What is wrong with it.",
      "fix": "A corrected sentence, or 'cut this sentence'." }
  ]
}
severity "high" means a viewer who knows the subject would call this an error.
Return an empty findings array if the script genuinely holds up.
`.trim();
}

export async function verifyStage({
  slug, topic, script, scriptKey, verifiedClaims, force = false, model = 'sonnet', stageName = 'verify',
}) {
  return runStage({
    slug,
    stage: stageName,
    version: VERIFY_VERSION,
    inputs: { topic, scriptKey, model },
    force,
    detail: 'auditing the written narration',
    async produce() {
      const { data } = await callClaudeJson({
        label: 'verify',
        slug,
        model,
        system:
          'You are a documentary fact-checker auditing a finished script. You are looking for the errors ' +
          'that survive a good process: quiet overreach, dropped hedges, and confident sentences nobody ' +
          'checked. You return only JSON.',
        prompt: buildPrompt({ topic, script, verifiedClaims }),
        tools: WEB_TOOLS,
        validate,
        attempts: 3,
        timeoutMs: 20 * 60 * 1000,
      });

      const bySeverity = { high: 0, medium: 0, low: 0 };
      for (const f of data.findings) bySeverity[f.severity] += 1;
      info(`${data.findings.length} finding(s): ${bySeverity.high} high · ${bySeverity.medium} medium · ${bySeverity.low} low`);
      for (const f of data.findings.filter((x) => x.severity === 'high')) {
        fail(`[${f.type}] "${f.sentence.slice(0, 90)}…"`);
        warn(`   ${f.problem}`);
        warn(`   fix: ${f.fix}`);
      }
      return data;
    },
  });
}

export function assertVerifyPassed(verify, { allowFindings = false } = {}) {
  const high = verify.findings.filter((f) => f.severity === 'high');
  if (high.length && !allowFindings) {
    throw new PipelineError(
      `The narration audit raised ${high.length} high-severity factual finding(s), so the build stopped before synthesis.`,
      high
        .map((f, i) => `${i + 1}. [${f.type}] "${f.sentence}"\n   problem: ${f.problem}\n   fix: ${f.fix}`)
        .join('\n\n') +
        '\n\nEither re-run the writing stage (--refresh=script) to get a different draft, or accept them ' +
        'deliberately with --allow-findings. They are recorded in the citations file either way.'
    );
  }
  return true;
}
