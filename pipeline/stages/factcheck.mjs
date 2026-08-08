// Stage 3 — the adversarial fact-check.
//
// The design principle here is that a checker asked "is this claim supported?"
// will almost always say yes. It reads the claim, reads the source that was
// attached to it, finds them compatible, and moves on. That is a rubber stamp
// with extra steps.
//
// So this stage is framed as an attack instead. The checker is told its job is
// to get claims retracted, it is required to write down what it searched for
// that would have falsified each claim, and it is given live web access
// specifically so it can go looking for *contradicting* evidence rather than
// re-reading the supporting source it was handed. A verdict with an empty or
// generic "falsification" field is rejected by the validator and re-run.
//
// Claims are checked in small batches so each one gets real attention, and
// dates, numbers and named individuals are called out for the hardest scrutiny
// because those are what a viewer will check, and what a documentary most
// often gets wrong.

import { runStage } from '../core/cache.mjs';
import { callClaudeJson, WEB_TOOLS } from '../core/llm.mjs';
import { info, warn, step } from '../core/log.mjs';

export const FACTCHECK_VERSION = 3;

const VERDICTS = ['established', 'disputed', 'unsupported', 'false'];
const CONFIDENCE = ['high', 'medium', 'low'];
const BATCH_SIZE = 6;

/** Claim kinds that get the hardest scrutiny — these are what viewers check. */
const HIGH_SCRUTINY = new Set(['date', 'number', 'person', 'quote']);

const GENERIC_FALSIFICATION = [
  /^(the )?sources? (support|confirm|agree)/i,
  /^no contradicting evidence( was)? found\.?$/i,
  /^this is (well|widely) (known|established)\.?$/i,
  /^verified\.?$/i,
];

function validateBatch(batchIds, sourceIds) {
  return (data) => {
    const p = [];
    if (!data || !Array.isArray(data.verdicts)) return ['Top level must be {"verdicts": [...]}.'];

    const seen = new Set();
    data.verdicts.forEach((v, i) => {
      const at = `verdicts[${i}]`;
      if (!batchIds.has(v.claimId)) {
        p.push(`${at}.claimId "${v.claimId}" was not in this batch. Check exactly: ${[...batchIds].join(', ')}.`);
        return;
      }
      if (seen.has(v.claimId)) p.push(`${at}: duplicate verdict for "${v.claimId}".`);
      seen.add(v.claimId);

      if (!VERDICTS.includes(v.verdict)) p.push(`${at}.verdict must be one of ${VERDICTS.join('|')}.`);
      if (!CONFIDENCE.includes(v.confidence)) p.push(`${at}.confidence must be one of ${CONFIDENCE.join('|')}.`);

      if (typeof v.falsification !== 'string' || v.falsification.trim().length < 40) {
        p.push(
          `${at}.falsification must describe what would make this claim false, what you searched for, ` +
            'and what you found — at least 40 characters of specifics.'
        );
      } else if (GENERIC_FALSIFICATION.some((re) => re.test(v.falsification.trim()))) {
        p.push(`${at}.falsification is a rubber stamp. Name the specific counter-evidence you looked for.`);
      }

      for (const f of ['supportingSourceIds', 'contradictingSourceIds']) {
        if (!Array.isArray(v[f])) p.push(`${at}.${f} must be an array (possibly empty).`);
        else {
          const bad = v[f].filter((id) => !sourceIds.has(id));
          if (bad.length) p.push(`${at}.${f} references unknown source(s): ${bad.join(', ')}.`);
        }
      }
      if (v.verdict === 'established' && (v.supportingSourceIds ?? []).length === 0) {
        p.push(`${at}: verdict "established" requires at least one supporting source.`);
      }
      if (v.verdict === 'disputed' && (typeof v.requiredHedge !== 'string' || !v.requiredHedge.trim())) {
        p.push(`${at}: verdict "disputed" requires a "requiredHedge" the narration must use.`);
      }
    });

    const missing = [...batchIds].filter((id) => !seen.has(id));
    if (missing.length) p.push(`No verdict returned for: ${missing.join(', ')}.`);
    return p;
  };
}

function buildPrompt({ topic, batch, research }) {
  const sourceBlock = research.sources
    .map(
      (s) =>
        `${s.id} [${s.kind}/${s.reliability}] ${s.title}${s.year ? ` (${s.year})` : ''} — ${s.url}\n` +
        `    ${s.summary}` +
        s.excerpts.map((e) => `\n    “${e.quote.slice(0, 300)}”`).join('')
    )
    .join('\n\n');

  const claimBlock = batch
    .map(
      (c) =>
        `${c.id} [${c.kind} · ${c.importance}]${HIGH_SCRUTINY.has(c.kind) ? ' ← HIGH SCRUTINY' : ''}\n` +
        `    CLAIM: ${c.statement}\n    ASSERTED SOURCES: ${c.sourceIds.join(', ')}`
    )
    .join('\n\n');

  return `
You are a hostile reviewer. A documentary about "${topic}" intends to state the
claims below on screen. Your job is to get as many of them retracted or
qualified as the evidence honestly allows. You are not here to confirm them.

For each claim, work in this order:
  1. State what would have to be true in the world for this claim to be FALSE.
  2. Go looking for exactly that, with WebSearch and WebFetch. Search for the
     counter-case by name: the competing date, the lower casualty figure, the
     scholar who disputes the attribution, "myth", "misconception", "revisited",
     "reassessment", "there is no evidence that".
  3. Only then decide. Do not decide first and search afterwards.

Give the hardest treatment to dates, numbers, named individuals and quotations.
Specific figures from ancient or contemporary writers are usually what that
writer *asserted*, not what happened — a claim that states such a figure as
fact is at best "disputed" unless modern scholarship independently supports it.
Round numbers repeated across popular sources with no scholarly anchor are the
classic failure case; treat them as guilty until proven otherwise.

VERDICTS
  "established"  Multiple independent reliable sources agree, and you found no
                 credible dissent. Popular consensus is not evidence.
  "disputed"     Genuine scholarly disagreement, OR a single-source figure that
                 cannot be independently corroborated. Supply "requiredHedge":
                 the exact qualifying language the narration must carry, phrased
                 for speech — e.g. "generally placed around", "our only source
                 for this is", "if it happened at all", "the figure comes from a
                 writer working two centuries later".
  "unsupported"  You could not find support. Not disproven — just not shown.
                 The claim will be cut from the film.
  "false"        You found evidence it is wrong. Supply "correctedStatement"
                 with the version the evidence does support, if there is one.

A claim that is broadly right but wrong in a detail is "false" with a
"correctedStatement", not "established".

SOURCES THE FILM COLLECTED
${sourceBlock}

CLAIMS TO ATTACK (${batch.length})
${claimBlock}

RETURN a single JSON object, no prose around it:
{
  "verdicts": [
    { "claimId": "C1",
      "verdict": "${VERDICTS.join('|')}",
      "confidence": "${CONFIDENCE.join('|')}",
      "supportingSourceIds": ["S1"],
      "contradictingSourceIds": [],
      "falsification": "What would make this false, what you searched for, what you found. Be specific.",
      "requiredHedge": null,
      "correctedStatement": null,
      "note": "" }
  ]
}
Return a verdict for every claim listed, and for no others.
`.trim();
}

export async function factcheckStage({ slug, topic, research, claims, claimsKey, researchKey, force = false, model = 'sonnet' }) {
  const sourceIds = new Set(research.sources.map((s) => s.id));
  const batches = [];
  for (let i = 0; i < claims.claims.length; i += BATCH_SIZE) {
    batches.push(claims.claims.slice(i, i + BATCH_SIZE));
  }

  return runStage({
    slug,
    stage: 'factcheck',
    version: FACTCHECK_VERSION,
    inputs: { topic, researchKey, claimsKey, model },
    force,
    detail: `${claims.claims.length} claims in ${batches.length} batches`,
    async produce() {
      const verdicts = [];
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        step(`batch ${i + 1}/${batches.length}: ${batch.map((c) => c.id).join(', ')}`);
        // eslint-disable-next-line no-await-in-loop
        const { data } = await callClaudeJson({
          label: `factcheck#${i + 1}`,
          slug,
          model,
          system:
            'You are an adversarial fact-checker for a history documentary. You are rewarded for finding ' +
            'problems, not for approving claims. You always search for disconfirming evidence before ' +
            'reaching a verdict, and you say plainly when something is merely repeated rather than shown. ' +
            'You return only JSON.',
          prompt: buildPrompt({ topic, batch: batch, research }),
          tools: WEB_TOOLS,
          requireTools: ['WebSearch'],
          validate: validateBatch(new Set(batch.map((c) => c.id)), sourceIds),
          attempts: 3,
          timeoutMs: 25 * 60 * 1000,
        });
        verdicts.push(...data.verdicts);
      }

      const summary = { established: 0, disputed: 0, unsupported: 0, false: 0 };
      for (const v of verdicts) summary[v.verdict] += 1;

      const blocking = [];
      const byId = new Map(claims.claims.map((c) => [c.id, c]));
      const killedLoadBearing = verdicts.filter(
        (v) => ['unsupported', 'false'].includes(v.verdict) && byId.get(v.claimId)?.importance === 'load-bearing'
      );
      if (killedLoadBearing.length) {
        blocking.push(
          `${killedLoadBearing.length} load-bearing claim(s) did not survive the fact-check: ` +
            killedLoadBearing.map((v) => `${v.claimId} (${v.verdict})`).join(', ') +
            '. The thesis rests on them, so the argument needs rebuilding rather than patching.'
        );
      }
      const survivors = verdicts.filter((v) => ['established', 'disputed'].includes(v.verdict));
      if (survivors.length < 8) {
        blocking.push(`Only ${survivors.length} claims survived; that is not enough material for a film.`);
      }

      info(
        `established ${summary.established} · disputed ${summary.disputed} · ` +
          `unsupported ${summary.unsupported} · false ${summary.false}`
      );
      for (const v of verdicts.filter((x) => x.verdict === 'false')) {
        warn(`${v.claimId} FALSE — ${byId.get(v.claimId)?.statement?.slice(0, 90)}…`);
        if (v.correctedStatement) step(`  corrected: ${v.correctedStatement}`);
      }
      for (const v of verdicts.filter((x) => x.verdict === 'unsupported')) {
        warn(`${v.claimId} UNSUPPORTED (cut) — ${byId.get(v.claimId)?.statement?.slice(0, 90)}…`);
      }

      return { verdicts, summary, blocking };
    },
  });
}

/**
 * Applies the fact-check to the claim ledger: drops what did not survive,
 * substitutes corrections, and attaches the hedge the narration must carry.
 * This is the only view of the claims the writer is ever shown.
 */
export function applyVerdicts(claims, factcheck) {
  const byClaim = new Map(factcheck.verdicts.map((v) => [v.claimId, v]));
  const kept = [];
  const dropped = [];

  for (const claim of claims.claims) {
    const v = byClaim.get(claim.id);
    if (!v || v.verdict === 'unsupported') {
      dropped.push({ ...claim, reason: v ? 'unsupported' : 'no verdict returned' });
      continue;
    }
    if (v.verdict === 'false' && !v.correctedStatement) {
      dropped.push({ ...claim, reason: 'false, no correction available' });
      continue;
    }
    kept.push({
      ...claim,
      statement: v.correctedStatement || claim.statement,
      verdict: v.verdict === 'false' ? 'established' : v.verdict, // corrected claims re-enter as their corrected form
      corrected: Boolean(v.correctedStatement),
      confidence: v.confidence,
      requiredHedge: v.requiredHedge || null,
      sourceIds: v.supportingSourceIds?.length ? v.supportingSourceIds : claim.sourceIds,
    });
  }

  const keptIds = new Set(kept.map((c) => c.id));
  const sections = claims.sections.map((s) => ({ ...s, claimIds: s.claimIds.filter((id) => keptIds.has(id)) }));

  return { ...claims, claims: kept, sections, droppedClaims: dropped };
}
