#!/usr/bin/env node
// make-video — turn a historical topic into a finished, cited documentary.
//
//   npm run make-video -- "the fall of Carthage" --style=hand-drawn
//
// Nine stages, each cached to disk under pipeline/work/<slug>/stages/ and keyed
// by its inputs. Research is slow and script writing is iterative, so nothing
// downstream of a change re-runs unless it has to, and a crash at render time
// costs a render, not an afternoon.
//
//   research   collect real sources, with live search (fails rather than recalls)
//   claims     draft the argument as a ledger of falsifiable assertions
//   factcheck  attack every claim adversarially; cut what does not survive
//   script     write the narration in the house style, from survivors only
//   verify     audit the written narration for overreach and dropped hedges
//   visuals    assign a scene treatment to every shot, in the chosen style
//   narrate    synthesize narration and measure the timeline (reuses scripts/tts.mjs)
//   render     render the film with Remotion
//   citations  emit the citations file beside the video
//
// Run `node pipeline/cli.mjs --help` for the full flag list.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { slugify, workDir, outDir, ensureDir, overlayPublic, overlayTiming, rel, ROOT } from './core/paths.mjs';
import { PipelineError, reportFatal, info, warn, step, stageStart, stageEnd, bold, dim, green, yellow } from './core/log.mjs';
import { costSoFar } from './core/llm.mjs';
import { stageStatus, clearStage } from './core/cache.mjs';
import { STYLES, STYLE_IDS, DEFAULT_STYLE, planStyle, probeSceneLayer } from './core/styles.mjs';
import { CHANNEL, DEFAULT_MINUTES } from './channel.mjs';

import { researchStage, assertResearchUsable } from './stages/research.mjs';
import { claimsStage } from './stages/claims.mjs';
import { factcheckStage, applyVerdicts } from './stages/factcheck.mjs';
import { scriptStage } from './stages/script.mjs';
import { verifyStage, assertVerifyPassed } from './stages/verify.mjs';
import { reviseStage } from './stages/revise.mjs';
import { visualsStage } from './stages/visuals.mjs';
import { narrateStage } from './stages/narrate.mjs';
import { renderVideo, compareStyles, assertComposition, pickSampleWindow, secondsToFrames, DEFAULT_COMPOSITION } from './stages/render.mjs';
import { buildCitations, writeCitations, writeTranscript } from './stages/citations.mjs';

export const STAGES = ['research', 'claims', 'factcheck', 'script', 'verify', 'revise', 'visuals', 'narrate', 'render', 'citations'];

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const o = {
    topic: null,
    style: DEFAULT_STYLE,
    minutes: DEFAULT_MINUTES,
    voice: CHANNEL.voice,
    model: 'sonnet',
    composition: DEFAULT_COMPOSITION,
    concurrency: null,
    preview: null,
    compareStyles: false,
    compareSeconds: 60,
    from: null,
    only: null,
    refresh: [],
    allowFindings: false,
    fixFindings: true,
    noRender: false,
    status: false,
    listStyles: false,
    help: false,
    slug: null,
    out: null,
  };
  const rest = [];

  for (const arg of argv) {
    if (!arg.startsWith('--')) {
      rest.push(arg);
      continue;
    }
    const [rawKey, ...valueParts] = arg.slice(2).split('=');
    const key = rawKey;
    const value = valueParts.join('=');
    switch (key) {
      case 'help': case 'h': o.help = true; break;
      case 'status': o.status = true; break;
      case 'list-styles': o.listStyles = true; break;
      case 'style': o.style = value; break;
      case 'minutes': o.minutes = Number(value); break;
      case 'voice': o.voice = value; break;
      case 'model': o.model = value; break;
      case 'composition': o.composition = value; break;
      case 'concurrency': o.concurrency = Number(value); break;
      case 'slug': o.slug = value; break;
      case 'out': o.out = value; break;
      case 'preview': o.preview = value === '' ? 30 : Number(value); break;
      case 'compare-styles': o.compareStyles = true; break;
      case 'compare-seconds': o.compareSeconds = Number(value); break;
      case 'from': o.from = value; break;
      case 'only': o.only = value; break;
      case 'refresh': o.refresh = value.split(',').map((s) => s.trim()).filter(Boolean); break;
      case 'allow-findings': o.allowFindings = true; break;
      case 'no-fix-findings': o.fixFindings = false; break;
      case 'no-render': o.noRender = true; break;
      default:
        throw new PipelineError(`Unknown option "--${key}".`, 'Run with --help for the supported flags.');
    }
  }
  o.topic = rest.join(' ').trim() || null;

  for (const [name, list] of [['--from', o.from ? [o.from] : []], ['--only', o.only ? [o.only] : []], ['--refresh', o.refresh]]) {
    const bad = list.filter((s) => !STAGES.includes(s));
    if (bad.length) {
      throw new PipelineError(
        `${name} names unknown stage(s): ${bad.join(', ')}.`,
        `Valid stages, in order: ${STAGES.join(' → ')}`
      );
    }
  }
  if (!Number.isFinite(o.minutes) || o.minutes < 1 || o.minutes > 60) {
    throw new PipelineError(`--minutes must be between 1 and 60 (got "${o.minutes}").`);
  }
  return o;
}

const HELP = `
${bold('make-video')} — turn a historical topic into a finished, cited documentary.

  npm run make-video -- "the fall of Carthage"
  npm run make-video -- "the fall of Carthage" --style=hand-drawn --minutes=8
  npm run make-video -- "the fall of Carthage" --compare-styles

${bold('VISUAL STYLE')}
  --style=<id>            ${STYLE_IDS.join(' | ')}   (default: ${DEFAULT_STYLE})
  --list-styles           Describe each style and report which the scene layer implements.
  --compare-styles        Render the same one-minute span once per available style, side by
                          side, so you can choose by eye before committing to a full render.
                          Writes out/<slug>/compare/index.html.
  --compare-seconds=<n>   Length of the comparison sample. Default 60.

${bold('THE FILM')}
  --minutes=<n>           Target runtime. Default ${DEFAULT_MINUTES}. Sets the section and word budget.
  --voice=<name>          Narration voice from scripts/voices.mjs. Default ${CHANNEL.voice}.
  --model=<id>            Model for the generative stages. Default sonnet.

${bold('RUNNING PARTS OF IT')}
  --status                Show which stages are cached for this topic, and exit.
  --from=<stage>          Re-run from this stage onward, reusing everything before it.
  --only=<stage>          Run exactly one stage (its inputs must already be cached).
  --refresh=<a,b>         Discard those stages' caches, then run normally.
  --preview[=<seconds>]   Render only the first N seconds. Default 30. Fast end-to-end check.
  --no-render             Stop after narration; still writes citations.
  --allow-findings        Proceed even when the narration audit raises high-severity findings.
  --no-fix-findings       Do not apply the audit's own suggested corrections (they are applied by
                          default, then the revised script is audited again).

${bold('OTHER')}
  --composition=<id>      Remotion composition to render. Default ${DEFAULT_COMPOSITION}.
  --concurrency=<n>       Remotion render concurrency.
  --slug=<slug>           Override the working directory name derived from the topic.
  --out=<path>            Override the output mp4 path.

  Stages: ${STAGES.join(' → ')}
  Working state: pipeline/work/<slug>/     Deliverables: out/<slug>/
`.trim();

function printStyles() {
  const layer = probeSceneLayer();
  process.stdout.write(`\n${bold('Visual styles')}\n\n`);
  for (const id of STYLE_IDS) {
    const s = STYLES[id];
    const ready = layer.styles.includes(id);
    process.stdout.write(
      `  ${bold(id.padEnd(17))}${ready ? green('implemented') : yellow('not yet in the scene layer')}\n` +
        `  ${' '.repeat(17)}${dim(s.summary)}\n\n`
    );
  }
  const keying = {
    'scene-kind': 'resolves scenes by scene kind — style reaches any topic',
    'shot-id': 'resolves scenes by shot id, keyed to the Troy shots — style does NOT reach a generated topic',
    none: 'exposes no style-aware resolver yet',
  }[layer.keying];
  process.stdout.write(
    dim(
      `  Scene layer: src/scenes/ — ${keying}.\n` +
        `  Its own style ids: [${(layer.sceneLayerStyles ?? layer.styles).join(', ')}]` +
        ' (both spellings are accepted on --style).\n' +
        '  See docs/scene-layer-contract.md for the interface this pipeline expects.\n\n'
    )
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) return void process.stdout.write(`${HELP}\n`);
  if (opts.listStyles) return void printStyles();
  if (!opts.topic) {
    throw new PipelineError(
      'No topic given.',
      'Usage: npm run make-video -- "the fall of Carthage" [--style=archival]\nRun with --help for all flags.'
    );
  }

  const slug = opts.slug ?? slugify(opts.topic);

  if (opts.status) {
    const rows = stageStatus(slug, STAGES);
    process.stdout.write(`\n${bold(opts.topic)}  ${dim(rel(workDir(slug)))}\n\n`);
    for (const r of rows) {
      process.stdout.write(
        `  ${r.present ? green('✔') : dim('·')} ${r.stage.padEnd(11)}` +
          `${r.present ? dim(`${r.key}  ${r.generatedAt}`) : dim('not run')}\n`
      );
    }
    process.stdout.write('\n');
    return;
  }

  // --- style resolution --------------------------------------------------
  const plan = planStyle(opts.style);
  const styleForContent = plan.style;

  process.stdout.write(
    `\n${bold(`make-video`)} ${dim('·')} ${bold(opts.topic)}\n` +
      `  style ${bold(styleForContent.id)} ${dim(`(${styleForContent.label})`)} · ` +
      `${opts.minutes} min target · voice ${opts.voice} · slug ${slug}\n`
  );
  if (plan.message) warn(plan.message);

  for (const stage of opts.refresh) clearStage(slug, stage);
  const fromIndex = opts.from ? STAGES.indexOf(opts.from) : 0;
  const onlyStage = opts.only;
  const shouldRun = (stage) => (onlyStage ? stage === onlyStage : STAGES.indexOf(stage) >= fromIndex);
  const forced = (stage) => opts.refresh.includes(stage) || (!onlyStage && opts.from === stage) || onlyStage === stage;

  ensureDir(workDir(slug));
  const common = { slug, topic: opts.topic, model: opts.model };

  // --- 1. research -------------------------------------------------------
  const research = await researchStage({ ...common, force: forced('research') && shouldRun('research') });
  assertResearchUsable(research.data);

  // --- 2. claims ---------------------------------------------------------
  const claims = await claimsStage({
    ...common,
    research: research.data,
    researchKey: research.key,
    minutes: opts.minutes,
    style: styleForContent,
    force: forced('claims') && shouldRun('claims'),
  });

  // --- 3. factcheck ------------------------------------------------------
  const factcheck = await factcheckStage({
    ...common,
    research: research.data,
    researchKey: research.key,
    claims: claims.data,
    claimsKey: claims.key,
    force: forced('factcheck') && shouldRun('factcheck'),
  });
  for (const b of factcheck.data.blocking ?? []) warn(b);
  const verifiedClaims = applyVerdicts(claims.data, factcheck.data);
  if (verifiedClaims.claims.length < 6) {
    throw new PipelineError(
      `Only ${verifiedClaims.claims.length} claim(s) survived the fact-check — not enough to build a film on.`,
      'Re-run research with a narrower or better-documented framing of the topic:\n' +
        `  npm run make-video -- "${opts.topic}" --refresh=research,claims,factcheck`
    );
  }
  info(`${verifiedClaims.claims.length} claims survived; ${verifiedClaims.droppedClaims.length} cut.`);

  // --- 4. script ---------------------------------------------------------
  const script = await scriptStage({
    ...common,
    style: styleForContent,
    research: research.data,
    verifiedClaims,
    claimsKey: claims.key,
    factcheckKey: factcheck.key,
    minutes: opts.minutes,
    force: forced('script') && shouldRun('script'),
  });

  // --- 5. verify (and, where the audit supplies a fix, apply it) ----------
  let verify = await verifyStage({
    ...common,
    script: script.data,
    scriptKey: script.key,
    verifiedClaims,
    force: forced('verify') && shouldRun('verify'),
  });

  // The audit writes a specific replacement sentence for every finding. Left
  // unapplied, that is wasted: the build stops and the only options are to
  // reroll a whole section and hope, or to wave the finding through. Applying
  // the correction the auditor already wrote is strictly better than both, and
  // the revised script is then audited again rather than trusted.
  let finalScript = script.data;
  let finalScriptKey = script.key;
  if (opts.fixFindings && verify.data.findings.some((f) => f.severity !== 'low')) {
    const revised = await reviseStage({
      slug,
      script: script.data,
      scriptKey: script.key,
      verify: verify.data,
      verifyKey: verify.key,
      model: opts.model,
      force: forced('revise'),
    });
    if (revised.data.applied > 0) {
      finalScript = revised.data.script;
      finalScriptKey = revised.key;
      verify = await verifyStage({
        ...common,
        script: finalScript,
        scriptKey: finalScriptKey,
        verifiedClaims,
        stageName: 'verify-revised',
        force: forced('verify'),
      });
    }
  }
  assertVerifyPassed(verify.data, { allowFindings: opts.allowFindings });

  // --- 6. visuals --------------------------------------------------------
  const visuals = await visualsStage({
    ...common,
    script: finalScript,
    scriptKey: finalScriptKey,
    style: styleForContent,
    force: forced('visuals') && shouldRun('visuals'),
  });

  // --- 7. narrate --------------------------------------------------------
  const narration = await narrateStage({
    slug,
    topic: opts.topic,
    script: finalScript,
    scriptKey: finalScriptKey,
    visuals: visuals.data,
    visualsKey: visuals.key,
    styleId: styleForContent.id,
    effectiveStyleId: plan.effectiveStyleId,
    voice: opts.voice,
    force: forced('narrate') && shouldRun('narrate'),
  });

  // --- 8. render ---------------------------------------------------------
  if (!existsSync(overlayTiming(slug))) {
    throw new PipelineError(
      `No narration timeline at ${rel(overlayTiming(slug))}, so there is nothing to render or cite.`,
      'Run the narrate stage first: --from=narrate (or drop --only=<stage>).'
    );
  }
  const timing = JSON.parse(readFileSync(overlayTiming(slug), 'utf8'));
  const results = { video: null, compare: null };

  if (!opts.noRender && shouldRun('render')) {
    await assertComposition(opts.composition);

    if (opts.compareStyles) {
      stageStart('compare-styles', `${opts.compareSeconds}s per style`);
      const layer = probeSceneLayer();
      const renderable = STYLE_IDS.filter((id) => layer.styles.includes(id));
      const skipped = STYLE_IDS.filter((id) => !renderable.includes(id));
      if (skipped.length) {
        warn(
          `Only ${renderable.length} of ${STYLE_IDS.length} styles are implemented by the scene layer. ` +
            `Skipping ${skipped.join(', ')} — rendering them now would produce identical clips under different ` +
            'names, which is worse than saying so. They appear in the contact sheet marked as pending.'
        );
      }
      results.compare = await compareStyles({
        slug,
        styleIds: renderable,
        seconds: opts.compareSeconds,
        composition: opts.composition,
        concurrency: opts.concurrency,
        visualsFor: async (styleId) =>
          (
            await visualsStage({
              ...common,
              script: script.data,
              scriptKey: script.key,
              style: STYLES[styleId],
              stageName: `visuals-${styleId}`,
            })
          ).data,
      });
      for (const id of skipped) {
        results.compare.results.push({ styleId: id, ok: false, error: 'Not yet implemented by src/scenes/.' });
      }
      stageEnd('compare-styles', rel(results.compare.indexPath));
    } else {
      stageStart('render', opts.preview ? `preview, first ${opts.preview}s` : `${timing.durationSec.toFixed(0)}s`);
      const outPath = opts.out
        ? path.resolve(ROOT, opts.out)
        : path.join(ensureDir(outDir(slug)), opts.preview ? `${slug}-preview.mp4` : `${slug}.mp4`);
      const frames = opts.preview
        ? [0, Math.min(secondsToFrames(opts.preview, timing.fps), Math.ceil(timing.durationSec * timing.fps)) - 1]
        : null;
      results.video = await renderVideo({
        slug,
        composition: opts.composition,
        publicDir: overlayPublic(slug),
        outPath,
        frames,
        concurrency: opts.concurrency,
        label: opts.preview ? 'preview' : 'film',
      });
      stageEnd('render', rel(outPath));
    }
  }

  // --- 9. citations ------------------------------------------------------
  stageStart('citations');
  const citations = buildCitations({
    slug,
    topic: opts.topic,
    research: research.data,
    claims: claims.data,
    factcheck: factcheck.data,
    verifiedClaims,
    script: finalScript,
    verify: verify.data,
    styleId: plan.effectiveStyleId,
  });
  const { mdPath, jsonPath } = writeCitations({ slug, citations });
  const transcriptPath = writeTranscript({ slug, script: finalScript, timing });
  stageEnd('citations', rel(mdPath));

  // --- report ------------------------------------------------------------
  const cost = costSoFar();
  process.stdout.write(`\n${bold(green('Done.'))} ${bold(finalScript.title)}\n\n`);
  info(`${dim('thesis    ')} ${finalScript.thesis}`);
  info(`${dim('runtime   ')} ${Math.floor(narration.data.durationSec / 60)}:${String(Math.round(narration.data.durationSec % 60)).padStart(2, '0')} · ${narration.data.sentenceCount} sentences · ${narration.data.shotCount} shots`);
  info(`${dim('accuracy  ')} ${citations.summary.claimsCited} claims cited (${citations.summary.established} established, ${citations.summary.disputed} disputed), ${citations.summary.droppedUnsupported} cut, ${citations.summary.auditFindings} audit findings`);
  info(`${dim('style     ')} requested ${styleForContent.id}${plan.supported ? '' : ` → rendered ${plan.effectiveStyleId} (scene layer)`}`);
  if (results.video) info(`${dim('video     ')} ${rel(results.video.path)}`);
  if (results.compare) info(`${dim('compare   ')} ${rel(results.compare.indexPath)}`);
  info(`${dim('citations ')} ${rel(mdPath)}`);
  info(`${dim('transcript')} ${rel(transcriptPath)}`);
  info(`${dim('model cost')} $${cost.costUsd.toFixed(2)} across ${cost.calls} calls`);
  process.stdout.write('\n');
}

main().catch((err) => {
  reportFatal(err);
  process.exit(1);
});
