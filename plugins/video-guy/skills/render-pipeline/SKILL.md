---
name: render-pipeline
description: Use when driving the end-to-end make-video pipeline — stage order and caching, running or re-running individual stages, reading status, previewing, comparing styles, and diagnosing pipeline failures. Triggers include "run the pipeline", "make-video", "re-run from the script stage", "why did the pipeline fail", "--only", "--refresh", and any orchestration of the CLI.
version: 1.0.0
---

# Render pipeline

`pipeline/cli.mjs` turns a topic into a finished, cited documentary in ten
cached stages.

```
research → claims → factcheck → script → verify → revise → visuals → narrate → render → citations
```

## Running it

```bash
npm run make-video -- "the fall of Carthage"
npm run make-video -- "<topic>" --slug=<slug> --style=hand-drawn --minutes=8
npm run make-video -- "<topic>" --slug=<slug> --status        # what is cached
npm run make-video -- "<topic>" --slug=<slug> --only=script   # exactly one stage
npm run make-video -- "<topic>" --slug=<slug> --from=visuals  # this stage onward
npm run make-video -- "<topic>" --slug=<slug> --refresh=research,claims
npm run make-video -- "<topic>" --slug=<slug> --preview=30    # first 30 s
npm run make-video -- "<topic>" --slug=<slug> --compare-styles
npm run make-video -- "<topic>" --list-styles
```

## Caching

Every stage writes `pipeline/work/<slug>/stages/<stage>.json` keyed by a hash of
its inputs. Change an input and that stage plus everything downstream re-runs;
change nothing and nothing re-runs. This is why an afternoon's work survives a
crash at render time, and why `--only` and `--from` are safe.

`--status` before you do anything. Re-running a cached research stage is
money spent to produce a file you already have.

## Files

| | |
| --- | --- |
| Working state | `pipeline/work/<slug>/` |
| Runtime overlay (audio, timing) | `pipeline/work/<slug>/rt/public/` |
| Deliverables | `out/<slug>/` |

Nothing outside those two trees is ever written to. That is what lets a
generated topic build in the same repo as the hand-authored film.

## The gates that stop a run

- **Research must reach the network.** Stages requiring live sources declare
  `requireTools: ['WebSearch']` and fail if the model answered from memory.
- **Fewer than six surviving claims** stops the run — there is not enough
  established material for a film. Re-frame the topic and refresh research.
- **High-severity audit findings** stop the run. The `revise` stage applies the
  auditor's own suggested corrections and re-audits. `--allow-findings` exists;
  using it to get a render moving is how a channel ships an error.

## Diagnosing

Read the actual error before retrying. Common causes:

| Symptom | Cause |
| --- | --- |
| Research fails immediately | no network access, or web tools not permitted |
| "Only N claims survived" | topic too thin or too mythic; re-frame |
| Render finds no timeline | `narrate` has not run for this slug |
| All styles look identical | scene layer resolves by shot id — see `--list-styles` |
| Wrong film rendered | slug collision; pass `--slug` explicitly |

Three attempts, then escalate with the error text. Do not route around a failing
stage by hand-writing its artifact.
