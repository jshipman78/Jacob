// Stage 9 — the citations file.
//
// This is the deliverable that makes the accuracy work visible. It ships beside
// the mp4 and joins the four artifacts that produced it: which sources were
// collected, which claims the film stakes, what the adversarial check decided
// about each, and — using the measured narration timeline — the timecode at
// which each claim is actually spoken. A viewer or an editor can jump straight
// to the moment and check it.
//
// It records what did NOT survive as well as what did. A citations file that
// only lists successes is marketing.

import { writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { info } from '../core/log.mjs';
import { ensureDir, outDir, overlayTiming, rel } from '../core/paths.mjs';
import { CHANNEL } from '../channel.mjs';

export function buildCitations({ slug, topic, research, claims, factcheck, verifiedClaims, script, verify, styleId }) {
  const timing = JSON.parse(readFileSync(overlayTiming(slug), 'utf8'));

  // claim id -> the narration sentences that carry it, with real timecodes.
  const flat = script.sections.flatMap((sec) =>
    sec.paragraphs.flatMap((par) => par.sentences.map((s) => ({ ...s, sectionId: sec.id, sectionTitle: sec.title })))
  );
  const byClaim = new Map();
  flat.forEach((s, i) => {
    const t = timing.sentences[i];
    for (const id of s.claimIds ?? []) {
      if (!byClaim.has(id)) byClaim.set(id, []);
      byClaim.get(id).push({
        index: i,
        sectionId: s.sectionId,
        sectionTitle: s.sectionTitle,
        text: s.text,
        start: t?.start ?? null,
      });
    }
  });

  const verdictById = new Map(factcheck.verdicts.map((v) => [v.claimId, v]));
  const sourceById = new Map(research.sources.map((s) => [s.id, s]));

  const citedClaims = verifiedClaims.claims
    .filter((c) => byClaim.has(c.id))
    .map((c) => {
      const v = verdictById.get(c.id);
      const uses = byClaim.get(c.id);
      return {
        id: c.id,
        statement: c.statement,
        kind: c.kind,
        importance: c.importance,
        verdict: c.verdict,
        confidence: c.confidence ?? v?.confidence ?? null,
        corrected: Boolean(c.corrected),
        requiredHedge: c.requiredHedge ?? null,
        falsification: v?.falsification ?? null,
        sourceIds: c.sourceIds,
        spokenAt: uses.map((u) => ({ sectionTitle: u.sectionTitle, start: u.start, text: u.text })),
      };
    });

  const citedSourceIds = new Set(citedClaims.flatMap((c) => c.sourceIds));
  const sources = research.sources.map((s) => ({
    ...s,
    citedBy: citedClaims.filter((c) => c.sourceIds.includes(s.id)).map((c) => c.id),
  }));

  const unusedClaims = verifiedClaims.claims.filter((c) => !byClaim.has(c.id));

  return {
    topic,
    title: script.title,
    thesis: script.thesis,
    style: styleId,
    voice: timing.voice,
    durationSec: timing.durationSec,
    generatedAt: new Date().toISOString(),
    channelPromise: CHANNEL.promise,
    sources,
    claims: citedClaims,
    droppedClaims: (verifiedClaims.droppedClaims ?? []).map((c) => ({
      id: c.id,
      statement: c.statement,
      reason: c.reason,
      verdict: verdictById.get(c.id)?.verdict ?? 'no verdict',
      falsification: verdictById.get(c.id)?.falsification ?? null,
    })),
    verifiedButUnused: unusedClaims.map((c) => ({ id: c.id, statement: c.statement })),
    unusedSources: research.sources.filter((s) => !citedSourceIds.has(s.id)).map((s) => s.id),
    audit: { assessment: verify.assessment, findings: verify.findings },
    summary: {
      sourceCount: research.sources.length,
      sourcesCited: citedSourceIds.size,
      claimsProposed: claims.claims.length,
      claimsCited: citedClaims.length,
      established: citedClaims.filter((c) => c.verdict === 'established').length,
      disputed: citedClaims.filter((c) => c.verdict === 'disputed').length,
      droppedUnsupported: (verifiedClaims.droppedClaims ?? []).length,
      auditFindings: verify.findings.length,
      auditHigh: verify.findings.filter((f) => f.severity === 'high').length,
    },
  };
}

const tc = (sec) => {
  if (sec == null) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
};

export function renderCitationsMarkdown(c) {
  const L = [];
  L.push(`# ${c.title}`, '', `**Topic:** ${c.topic}  `, `**Thesis:** ${c.thesis}  `);
  L.push(
    `**Runtime:** ${tc(c.durationSec)} · **Visual style:** ${c.style} · **Narration voice:** ${c.voice}  `,
    `**Generated:** ${c.generatedAt}`,
    ''
  );
  L.push(
    '> ' + c.channelPromise.replace(/\n/g, ' '),
    '',
    '## How to read this file',
    '',
    'Every factual claim the narration makes was written down before the script was, then attacked by an',
    'adversarial fact-checker with live web access whose job was to get it retracted. Claims that could not',
    'be supported were cut from the film before a word of narration was written; the cut list is included',
    'below, because what a documentary chose not to say is part of its accuracy record. Timecodes are',
    'measured from the finished narration audio, so they point at the exact moment each claim is spoken.',
    '',
    '| | |',
    '| --- | --- |',
    `| Sources collected | ${c.summary.sourceCount} (${c.summary.sourcesCited} cited on screen) |`,
    `| Claims proposed | ${c.summary.claimsProposed} |`,
    `| Claims in the film | ${c.summary.claimsCited} — ${c.summary.established} established, ${c.summary.disputed} disputed |`,
    `| Claims cut for lack of support | ${c.summary.droppedUnsupported} |`,
    `| Narration audit findings | ${c.summary.auditFindings} (${c.summary.auditHigh} high severity) |`,
    ''
  );

  L.push('## Claims made in the film', '');
  for (const claim of c.claims) {
    const first = claim.spokenAt[0];
    const badge = claim.verdict === 'disputed' ? '⚠︎ disputed among historians' : 'established';
    L.push(`### ${claim.id} — ${badge}${claim.corrected ? ' · corrected by fact-check' : ''}`, '');
    L.push(`**${claim.statement}**`, '');
    L.push(`- First spoken at **${tc(first?.start)}** in *${first?.sectionTitle}*`);
    L.push(`- Kind: ${claim.kind} · importance: ${claim.importance} · confidence: ${claim.confidence ?? 'n/a'}`);
    if (claim.requiredHedge) L.push(`- Required qualification: _${claim.requiredHedge}_`);
    L.push(`- Sources: ${claim.sourceIds.join(', ')}`);
    if (claim.falsification) L.push(`- Falsification attempted: ${claim.falsification}`);
    L.push('');
    for (const u of claim.spokenAt) L.push(`  > ${tc(u.start)} — ${u.text}`);
    L.push('');
  }

  if (c.droppedClaims.length) {
    L.push('## Claims cut before writing', '', 'These did not survive the fact-check and are not in the film.', '');
    for (const d of c.droppedClaims) {
      L.push(`- **${d.id}** (${d.verdict}) — ${d.statement}`);
      if (d.falsification) L.push(`  - ${d.falsification}`);
    }
    L.push('');
  }

  if (c.audit.findings.length) {
    L.push('## Narration audit', '', c.audit.assessment, '');
    for (const f of c.audit.findings) {
      L.push(`- **${f.severity.toUpperCase()} · ${f.type}** — “${f.sentence}”`);
      L.push(`  - ${f.problem}`);
      L.push(`  - Suggested: ${f.fix}`);
    }
    L.push('');
  } else {
    L.push('## Narration audit', '', c.audit.assessment, '', 'No findings.', '');
  }

  L.push('## Sources', '');
  for (const s of c.sources) {
    const bits = [s.author, s.publisher, s.year].filter(Boolean).join(', ');
    L.push(
      `**${s.id}** — [${s.title}](${s.url})  `,
      `${bits ? `${bits}. ` : ''}*${s.kind}, reliability ${s.reliability}, accessed ${s.accessedAt}*  `,
      `${s.summary}  `,
      s.citedBy.length ? `Supports: ${s.citedBy.join(', ')}` : '_Collected but not cited in the final film._',
      ''
    );
  }
  return L.join('\n');
}

export function writeCitations({ slug, citations }) {
  const dir = ensureDir(outDir(slug));
  const jsonPath = path.join(dir, 'citations.json');
  const mdPath = path.join(dir, 'citations.md');
  writeFileSync(jsonPath, JSON.stringify(citations, null, 2));
  writeFileSync(mdPath, renderCitationsMarkdown(citations));
  info(`${rel(mdPath)} — ${citations.summary.claimsCited} claims, ${citations.summary.sourcesCited} sources cited`);
  return { jsonPath, mdPath };
}

/** A plain-text transcript, useful for descriptions, subtitles review and QA. */
export function writeTranscript({ slug, script, timing }) {
  const dir = ensureDir(outDir(slug));
  const p = path.join(dir, 'transcript.md');
  const lines = [`# ${script.title}`, '', `_${script.thesis}_`, ''];
  let i = 0;
  for (const sec of script.sections) {
    lines.push(`## ${sec.title}`, '');
    for (const par of sec.paragraphs) {
      const start = timing.sentences[i]?.start;
      lines.push(`**[${tc(start)}]** ${par.sentences.map((s) => s.text).join(' ')}`, '');
      i += par.sentences.length;
    }
  }
  writeFileSync(p, lines.join('\n'));
  return p;
}
