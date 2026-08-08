// Stage 6 — visual assignment.
//
// One shot per paragraph, each resolved to a *scene kind* rather than to a
// component. The pipeline decides what kind of visual the narration needs —
// a map, a timeline, a claim ledger, a typographic beat — which is a content
// decision that follows from the script. The scene layer under src/scenes/
// decides what that kind looks like in the chosen style, which is a design
// decision. Neither side has to know the other's catalogue, which is what
// makes adding a fifth style a matter of registering scenes rather than
// editing this pipeline.
//
// See docs/scene-layer-contract.md for the interface, and
// pipeline/core/styles.mjs for the vocabulary and the style bias table.

import { runStage } from '../core/cache.mjs';
import { callClaudeJson } from '../core/llm.mjs';
import { info, warn } from '../core/log.mjs';
import { SCENE_KINDS, SCENE_KIND_IDS, validateScene, FALLBACK_SCENE } from '../core/styles.mjs';

export const VISUALS_VERSION = 3;

function validate(shotIds) {
  return (data) => {
    const p = [];
    if (!data || !Array.isArray(data.shots)) return ['Top level must be {"shots": [...]}.'];
    const seen = new Set();
    data.shots.forEach((s, i) => {
      const at = `shots[${i}]`;
      if (!shotIds.has(s.id)) {
        p.push(`${at}.id "${s.id}" is not a shot in this script. Valid ids: ${[...shotIds].slice(0, 12).join(', ')}…`);
        return;
      }
      if (seen.has(s.id)) p.push(`${at}: duplicate assignment for "${s.id}".`);
      seen.add(s.id);
      p.push(...validateScene(s.scene, at));
      if (typeof s.prompt !== 'string' || s.prompt.trim().length < 30) {
        p.push(`${at}.prompt must be a still-image art direction of at least 30 characters.`);
      }
    });
    const missing = [...shotIds].filter((id) => !seen.has(id));
    if (missing.length) p.push(`No assignment returned for: ${missing.join(', ')}.`);

    // A film that is all one scene kind is a failure of assignment, not a style.
    const kinds = new Set(data.shots.map((s) => s.scene?.kind).filter(Boolean));
    if (shotIds.size >= 6 && kinds.size < 3) {
      p.push(`Only ${kinds.size} distinct scene kind(s) used across ${shotIds.size} shots. Vary the visual grammar.`);
    }
    return p;
  };
}

function buildPrompt({ topic, script, style }) {
  const vocabulary = Object.entries(SCENE_KINDS)
    .map(([kind, def]) => {
      const bias = style.sceneBias[kind] ?? 1;
      const weight = bias >= 2 ? 'STRONG in this style' : bias <= 0.7 ? 'weak in this style — use sparingly' : 'neutral';
      return (
        `"${kind}" (${weight})\n    ${def.purpose}\n    options: ` +
        Object.entries(def.options).map(([k, v]) => `${k}: ${v}`).join('; ')
      );
    })
    .join('\n\n');

  const shotBlock = script.sections
    .map(
      (sec) =>
        `## ${sec.title} [${sec.beat}]\n` +
        sec.paragraphs
          .map(
            (par) =>
              `${par.shot}\n    intent: ${par.visualIntent}\n    narration: ` +
              par.sentences.map((s) => s.text).join(' ')
          )
          .join('\n\n')
    )
    .join('\n\n');

  return `
Assign a visual treatment to every shot in this documentary about "${topic}".

VISUAL STYLE FOR THIS FILM: ${style.label}
  ${style.summary}
  Shared art direction (appended to every image prompt automatically — do not
  repeat it in your prompts): ${style.artDirection}

SCENE VOCABULARY — choose exactly one kind per shot
${vocabulary}

HOW TO CHOOSE
  - Put explanatory scenes where the narration is making a factual argument the
    viewer benefits from *seeing*: a gap in time under a sentence about a gap in
    time, a ledger under a sentence contrasting claim and record, a map the
    first time a place is named.
  - Put atmospheric and typographic scenes under narrative and rhetorical
    passages, where a diagram would be literal-minded and wrong.
  - Never repeat the same kind on two consecutive shots unless the options
    differ meaningfully — the picture must change when the paragraph changes.
  - "statement" is the strongest card in the deck and goes stale fast. Use it
    for the line a section turns on, no more than once per section.
  - Fill the options properly. A "timeline" with no marks, a "ledger" with no
    rows, or a "map" with no places is worse than not using it: the scene will
    render empty. Draw the option content from the narration itself.
  - Respect the style weighting above. A motion-graphics film that is mostly
    atmosphere is not a motion-graphics film.

THE SHOTS
${shotBlock}

RETURN a single JSON object, no prose around it:
{
  "shots": [
    { "id": "exact-shot-id",
      "scene": { "kind": "${SCENE_KIND_IDS.join('|')}", "options": { } },
      "prompt": "Still-image art direction for this shot: subject, composition, light. One sentence. No style words — the shared art direction is appended automatically." }
  ]
}
Return one entry for every shot listed, in the same order.
`.trim();
}

/**
 * @param {string} [o.stageName] Cache slot. Comparison runs assign the same
 *   shots under several styles at once, so each style gets its own slot
 *   ("visuals-cinematic") and none of them evict the primary one.
 */
export async function visualsStage({
  slug, topic, script, scriptKey, style, force = false, model = 'sonnet', stageName = 'visuals',
}) {
  const shotIds = new Set(script.shots.map((s) => s.id));

  return runStage({
    slug,
    stage: stageName,
    version: VISUALS_VERSION,
    inputs: { topic, scriptKey, style: style.id, model },
    force,
    detail: `${shotIds.size} shots · style ${style.id}`,
    async produce() {
      const { data } = await callClaudeJson({
        label: 'visuals',
        slug,
        model,
        system:
          'You are the art director for a documentary channel. You choose what the viewer looks at while ' +
          'each line is spoken, and you are ruthless about whether a picture is earning its place. ' +
          'You return only JSON.',
        prompt: buildPrompt({ topic, script, style }),
        validate: validate(shotIds),
        attempts: 3,
        timeoutMs: 15 * 60 * 1000,
      });

      const byId = new Map(data.shots.map((s) => [s.id, s]));
      const shots = script.shots.map((s) => {
        const assigned = byId.get(s.id);
        if (!assigned) {
          warn(`No visual assigned to "${s.id}" — falling back to ${FALLBACK_SCENE.kind}.`);
          return { ...s, scene: { ...FALLBACK_SCENE }, prompt: s.intent };
        }
        return {
          ...s,
          scene: { kind: assigned.scene.kind, options: assigned.scene.options ?? {} },
          prompt: `${assigned.prompt.trim().replace(/[.\s]+$/, '')}, ${style.artDirection}`,
        };
      });

      const tally = shots.reduce((acc, s) => ({ ...acc, [s.scene.kind]: (acc[s.scene.kind] || 0) + 1 }), {});
      info(
        Object.entries(tally)
          .sort((a, b) => b[1] - a[1])
          .map(([k, v]) => `${k} ×${v}`)
          .join(' · ')
      );
      return { style: style.id, artDirection: style.artDirection, shots };
    },
  });
}
