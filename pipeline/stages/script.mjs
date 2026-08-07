// Stage 4 — writing the narration.
//
// Written one section at a time, because a single call asked for fifteen
// minutes of narration flattens: the cold open gets all the craft and the last
// four sections turn into a summary of themselves. Per-section calls also let
// each one carry the tail of the previous section, so the seams hold.
//
// The writer only ever sees claims that survived the fact-check, annotated
// with the hedge each disputed claim must carry. It cannot cite what was cut
// because it is never shown it.
//
// The validator is mechanical and strict — banned constructions, rhythm,
// repeated sentence openings, pause discipline, hedge compliance — and its
// complaints are fed back to the model for another pass. That converts the
// craft rules from advice into something enforced.

import { runStage } from '../core/cache.mjs';
import { callClaudeJson } from '../core/llm.mjs';
import { info, step, warn } from '../core/log.mjs';
import { CRAFT, EXEMPLARS, DELIVERY, writerSystemPrompt } from '../prompts/house-style.mjs';
import { CHANNEL } from '../channel.mjs';

export const SCRIPT_VERSION = 4;

const PAUSE_KEYS = ['sentence', 'paragraph', 'effect', 'beat', 'section'];

const BANNED = [
  'little did they know', 'the rest is history', 'stood the test of time',
  'in this video', 'let us dive in', "let's dive in", 'buckle up', 'picture this',
  'needless to say', 'it goes without saying', 'a testament to', 'a stark reminder',
  'forever changed the course of', 'quite literally', 'delve into', 'tapestry of',
  'shrouded in mystery', 'lost to the sands of time',
];

const WEASEL = [/\bsome say\b/i, /\bit is believed\b/i, /\bmany believe\b/i, /\bhistorians say\b/i];

const words = (s) => s.trim().split(/\s+/).filter(Boolean);
const wordCount = (s) => words(s).length;

function sentencesOf(paragraphs) {
  return paragraphs.flatMap((p) => p.sentences ?? []);
}

function validateSection({ section, budget, allowedClaims, isFinalSection }) {
  const claimIds = new Set(allowedClaims.map((c) => c.id));
  const hedged = allowedClaims.filter((c) => c.requiredHedge);

  return (data) => {
    const p = [];
    if (!data || !Array.isArray(data.paragraphs) || data.paragraphs.length === 0) {
      return ['Top level must be {"paragraphs": [ ... ]} with at least one paragraph.'];
    }

    data.paragraphs.forEach((par, i) => {
      const at = `paragraphs[${i}]`;
      if (!par.shotHint || typeof par.shotHint !== 'string') {
        p.push(`${at}.shotHint must be a short kebab-case slug describing this shot, e.g. "harbour-burning".`);
      } else if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(par.shotHint)) {
        p.push(`${at}.shotHint "${par.shotHint}" must be lowercase kebab-case.`);
      }
      if (!PAUSE_KEYS.includes(par.pauseAfter)) {
        p.push(`${at}.pauseAfter must be one of ${PAUSE_KEYS.join('|')}.`);
      }
      if (typeof par.visualIntent !== 'string' || par.visualIntent.trim().length < 10) {
        p.push(`${at}.visualIntent must say in one line what the viewer should be looking at.`);
      }
      if (!Array.isArray(par.sentences) || par.sentences.length === 0) {
        p.push(`${at}.sentences must be a non-empty array.`);
        return;
      }
      par.sentences.forEach((s, j) => {
        const sat = `${at}.sentences[${j}]`;
        if (typeof s.text !== 'string' || !s.text.trim()) {
          p.push(`${sat}.text is required.`);
          return;
        }
        if (!/[.?!”"]$/.test(s.text.trim())) p.push(`${sat}.text must end with terminal punctuation.`);
        if (s.tts !== undefined && s.tts !== null) {
          if (typeof s.tts !== 'string' || !s.tts.trim()) p.push(`${sat}.tts must be a non-empty string when present.`);
          else if (s.tts.trim() === s.text.trim()) p.push(`${sat}.tts is identical to text — omit it.`);
          else {
            const ratio = wordCount(s.tts) / Math.max(1, wordCount(s.text));
            if (ratio < 0.6 || ratio > 2.2) {
              p.push(`${sat}.tts differs too much from text — respell numerals only, never rewrite the sentence.`);
            }
          }
        }
        if (s.claimIds !== undefined) {
          if (!Array.isArray(s.claimIds)) p.push(`${sat}.claimIds must be an array.`);
          else {
            const bad = s.claimIds.filter((id) => !claimIds.has(id));
            if (bad.length) {
              p.push(
                `${sat}.claimIds references ${bad.join(', ')}, which is not available to this section. ` +
                  `Available: ${[...claimIds].join(', ') || '(none)'}.`
              );
            }
          }
        }
      });
    });

    const all = sentencesOf(data.paragraphs);
    if (all.length === 0) return p;

    // --- unverified-digit check: a number on screen must trace to a claim ---
    for (const s of all) {
      if (!s.text) continue;
      const hasFigure = /\b\d{2,}\b|\b(?:thousand|million|hundred thousand)\b/i.test(s.text);
      if (hasFigure && (!Array.isArray(s.claimIds) || s.claimIds.length === 0)) {
        p.push(
          `A sentence states a figure but cites no claim: "${s.text.slice(0, 80)}…". ` +
            'Every number on screen must carry the claimIds it came from, or be cut.'
        );
      }
    }

    // --- banned constructions ---
    const joined = all.map((s) => s.text).join(' ').toLowerCase();
    for (const phrase of BANNED) {
      if (joined.includes(phrase)) p.push(`Banned construction present: "${phrase}". Rewrite that sentence.`);
    }
    for (const re of WEASEL) {
      const hit = all.find((s) => re.test(s.text));
      if (hit) {
        p.push(
          `Weasel attribution in "${hit.text.slice(0, 70)}…" — name who holds the view and on what basis, ` +
            'or state it flatly if it is established.'
        );
      }
    }

    // --- rhythm ---
    const lens = all.map((s) => wordCount(s.text));
    let run = 1;
    for (let i = 1; i < lens.length; i++) {
      const medium = (n) => n >= 12 && n <= 30;
      run = medium(lens[i]) && medium(lens[i - 1]) ? run + 1 : 1;
      if (run >= 4) {
        p.push('Four or more consecutive medium-length sentences. Break the run with something very short or very long.');
        break;
      }
    }
    if (section.beat !== 'outro' && lens.length >= 6 && !lens.some((n) => n <= 7)) {
      p.push('No short sentence (7 words or fewer) anywhere in this section. The rhythm needs one.');
    }

    // --- repeated openings ---
    const firsts = all.map((s) => words(s.text)[0]?.toLowerCase().replace(/[^a-z']/g, '') ?? '');
    for (let i = 1; i < firsts.length; i++) {
      if (firsts[i] && firsts[i] === firsts[i - 1]) {
        p.push(`Two consecutive sentences both begin with "${firsts[i]}". Vary the opening.`);
        break;
      }
    }
    const conj = firsts.filter((w) => ['and', 'but', 'so'].includes(w)).length;
    if (conj > Math.ceil(all.length / 5)) {
      p.push(`${conj} of ${all.length} sentences open with And/But/So. Cut that to at most ${Math.ceil(all.length / 5)}.`);
    }

    // --- hedge compliance ---
    for (const c of hedged) {
      const cited = all.some((s) => (s.claimIds ?? []).includes(c.id));
      if (!cited) continue;
      const hedgeWords = words(c.requiredHedge.toLowerCase()).filter((w) => w.length > 3);
      const carriers = all.filter((s) => (s.claimIds ?? []).includes(c.id)).map((s) => s.text.toLowerCase());
      const nearby = carriers.join(' ');
      const overlap = hedgeWords.filter((w) => nearby.includes(w)).length;
      if (hedgeWords.length && overlap < Math.min(2, hedgeWords.length)) {
        p.push(
          `Claim ${c.id} is disputed and must be delivered with qualifying language to this effect: ` +
            `"${c.requiredHedge}". The sentence citing it states it flatly. Rework it so the uncertainty is spoken aloud.`
        );
      }
    }

    // --- length ---
    const total = all.reduce((n, s) => n + wordCount(s.text), 0);
    const lo = Math.round(budget.wordBudget * 0.7);
    const hi = Math.round(budget.wordBudget * 1.3);
    if (total < lo) p.push(`Section is ${total} words; the budget is ~${budget.wordBudget} (minimum ${lo}). Develop it further.`);
    if (total > hi) p.push(`Section is ${total} words; the budget is ~${budget.wordBudget} (maximum ${hi}). Cut.`);

    // --- pause discipline ---
    const lastPause = data.paragraphs.at(-1).pauseAfter;
    const wanted = isFinalSection ? 'paragraph' : 'section';
    if (lastPause !== wanted) {
      p.push(`The last paragraph of this section must have pauseAfter "${wanted}", not "${lastPause}".`);
    }
    const midSection = data.paragraphs.slice(0, -1).filter((x) => x.pauseAfter === 'section');
    if (midSection.length) p.push('pauseAfter "section" may only appear on the final paragraph of a section.');

    return p;
  };
}

function buildPrompt({ topic, section, budget, plan, allowedClaims, research, previousTail, isFinalSection, isFirstSection }) {
  const claimBlock = allowedClaims.length
    ? allowedClaims
        .map((c) => {
          const flags = [c.verdict, c.importance, c.corrected ? 'CORRECTED BY FACT-CHECK' : null]
            .filter(Boolean)
            .join(' · ');
          return (
            `${c.id} [${flags}]\n    ${c.statement}` +
            (c.requiredHedge ? `\n    ⚠ MUST BE SPOKEN WITH QUALIFICATION TO THIS EFFECT: "${c.requiredHedge}"` : '')
          );
        })
        .join('\n\n')
    : '(No verified claims are assigned to this section. Write it as narration that carries the argument ' +
      'forward using only what earlier sections established — assert no new facts.)';

  const outroBlock = isFinalSection
    ? `
THIS IS THE OUTRO. It must, in this order:
  1. State the channel's through-line explicitly, in the narrator's own words:
     "${CHANNEL.theme}"
  2. Fold this specific story into it in two or three sentences — what this
     subject turns out to be a case study in.
${CHANNEL.previousVideoPlug ? `  3. Plug the previous video: ${CHANNEL.previousVideoPlug.replace('{topic}', topic)}\n` : ''}  ${CHANNEL.previousVideoPlug ? '4' : '3'}. Close on exactly these two sentences, as their own final paragraph:
     "${CHANNEL.signoff.join('" / "')}"
Do not summarise the video. Do not introduce new evidence.
`.trim()
    : '';

  const openBlock = isFirstSection
    ? `
THIS IS THE COLD OPEN. The planned hook is:
  ${plan.coldOpen}
Open on that, concretely, in the first sentence. Follow the exemplar's shape:
one long accumulating sentence of specifics → a short reversal → staccato
identification → a long sentence with the sting in an em-dash aside → the
question the film exists to answer. The film's title is "${plan.title}"; the
last paragraph of this section should land it.
`.trim()
    : '';

  return `
Write section ${section.order + 1} of ${plan.sections.length} of a documentary about: ${topic}

THE FILM'S THESIS: ${plan.thesis}
THE THROUGH-LINE: ${plan.throughline}

FULL STRUCTURE (for your bearings — write ONLY the section marked ►):
${plan.sections
  .map((s, i) => `${i === section.order ? '►' : ' '} ${i + 1}. ${s.title} [${s.beat}] — ${s.intent}`)
  .join('\n')}

THIS SECTION
  title: ${section.title}
  beat:  ${section.beat}
  job:   ${budget.job}
  size:  about ${budget.wordBudget} words, roughly ${budget.sentenceTarget} sentences,
         split across about ${budget.shotTarget} paragraphs (one paragraph = one shot = one idea).

${previousTail ? `THE PREVIOUS SECTION ENDED:\n  "${previousTail}"\nPick up from there without repeating it.\n` : ''}
${openBlock}
${outroBlock}

VERIFIED CLAIMS AVAILABLE TO THIS SECTION
These have passed an adversarial fact-check. You may state these. You may NOT
state any other fact, figure, date or name that is not general knowledge —
anything unsupported was cut for a reason, and inventing a replacement is the
one unforgivable failure here.
${claimBlock}

CONTEXT FROM RESEARCH (background only — do not treat as licence to assert)
  ${research.summary}
  Historiography: ${research.historiography}

${CRAFT}

${DELIVERY}

WORKED EXAMPLES FROM THE CHANNEL'S BEST SCRIPT
${EXEMPLARS}

RETURN a single JSON object, no prose around it:
{
  "paragraphs": [
    { "shotHint": "kebab-case-slug",
      "visualIntent": "One line: what the viewer should be looking at while this is spoken.",
      "pauseAfter": "${PAUSE_KEYS.join('|')}",
      "sentences": [
        { "text": "Exactly what appears in the subtitles, properly punctuated.",
          "tts": "Only when a numeral or abbreviation needs respelling; otherwise omit.",
          "claimIds": ["C1"] }
      ] }
  ]
}
Every sentence containing a figure, date or named individual MUST carry the
claimIds it rests on. Purely rhetorical or transitional sentences carry [].
`.trim();
}

export async function scriptStage({
  slug, topic, style, research, verifiedClaims, claimsKey, factcheckKey, minutes, force = false, model = 'sonnet',
}) {
  const budget = verifiedClaims.budget;
  const plan = {
    thesis: verifiedClaims.thesis,
    throughline: verifiedClaims.throughline,
    coldOpen: verifiedClaims.coldOpen,
    title: research.workingTitle,
    sections: verifiedClaims.sections,
  };
  const claimById = new Map(verifiedClaims.claims.map((c) => [c.id, c]));

  return runStage({
    slug,
    stage: 'script',
    version: SCRIPT_VERSION,
    inputs: { topic, claimsKey, factcheckKey, minutes, style: style.id, model, channel: CHANNEL.theme },
    force,
    detail: `${plan.sections.length} sections`,
    async produce() {
      const sections = [];
      let previousTail = null;

      for (let i = 0; i < plan.sections.length; i++) {
        const sectionPlan = plan.sections[i];
        const sectionBudget = budget.sections[i] ?? budget.sections.at(-1);
        const allowedClaims = sectionPlan.claimIds.map((id) => claimById.get(id)).filter(Boolean);
        const isFinalSection = i === plan.sections.length - 1;

        step(`${i + 1}/${plan.sections.length} ${sectionPlan.title} — ${allowedClaims.length} verified claims`);

        // eslint-disable-next-line no-await-in-loop
        const { data } = await callClaudeJson({
          label: `script#${i + 1}`,
          slug,
          model,
          system: writerSystemPrompt(),
          prompt: buildPrompt({
            topic,
            section: { ...sectionPlan, order: i },
            budget: sectionBudget,
            plan,
            allowedClaims,
            research,
            previousTail,
            isFinalSection,
            isFirstSection: i === 0,
          }),
          validate: validateSection({
            section: sectionPlan,
            budget: sectionBudget,
            allowedClaims,
            isFinalSection,
          }),
          attempts: 4,
          timeoutMs: 15 * 60 * 1000,
        });

        // Namespace shot ids by section so two sections can both want "aftermath".
        const paragraphs = data.paragraphs.map((par) => ({
          shot: `${sectionPlan.id}-${par.shotHint}`,
          visualIntent: par.visualIntent,
          pauseAfter: par.pauseAfter,
          sentences: par.sentences.map((s) => ({
            text: s.text.trim(),
            ...(s.tts ? { tts: s.tts.trim() } : {}),
            claimIds: Array.isArray(s.claimIds) ? s.claimIds : [],
          })),
        }));

        sections.push({ id: sectionPlan.id, title: sectionPlan.title, beat: sectionPlan.beat, paragraphs });
        const tail = paragraphs.at(-1).sentences.slice(-2).map((s) => s.text).join(' ');
        previousTail = tail;
      }

      // Collapse duplicate shot ids that landed in the same section.
      const seen = new Map();
      for (const sec of sections) {
        for (const par of sec.paragraphs) {
          const n = (seen.get(par.shot) ?? 0) + 1;
          seen.set(par.shot, n);
          if (n > 1) par.shot = `${par.shot}-${n}`;
        }
      }

      const shots = [];
      for (const sec of sections) {
        for (const par of sec.paragraphs) {
          shots.push({ id: par.shot, sectionId: sec.id, intent: par.visualIntent });
        }
      }

      const allSentences = sections.flatMap((s) => s.paragraphs).flatMap((p) => p.sentences);
      const totalWords = allSentences.reduce((n, s) => n + wordCount(s.text), 0);
      const estMinutes = totalWords / 143;
      info(
        `${allSentences.length} sentences · ${totalWords} words · ` +
          `~${Math.floor(estMinutes)}:${String(Math.round((estMinutes % 1) * 60)).padStart(2, '0')} estimated · ` +
          `${shots.length} shots · ${allSentences.filter((s) => s.tts).length} pronunciation overrides`
      );
      if (Math.abs(estMinutes - minutes) > minutes * 0.35) {
        warn(`Estimated runtime ${estMinutes.toFixed(1)}m is well off the ${minutes}m target.`);
      }

      return { title: research.workingTitle, topic, style: style.id, thesis: plan.thesis, sections, shots };
    },
  });
}
