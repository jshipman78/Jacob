# Video Guy

A documentary production system for Claude Code: an executive-producer agent
running a slate, one producer per film, and eleven specialists doing the work.

It sits **on top of** this repository's existing pipeline rather than beside it.
`pipeline/cli.mjs` already turns a topic into a cited documentary through ten
cached stages, enforces live web search, refuses to answer from memory, and
tracks cost. Video Guy's agents drive that CLI for everything it does, and own
the parts it does not: topic scouting, story architecture, storyboarding,
archival sourcing, generated imagery, motion graphics, QC, and running several
films at once.

---

## Install

The repo root is a local marketplace, so:

```bash
/plugin marketplace add /Users/joeshipman/Desktop/ClaudApps/YoutubeApp
/plugin install video-guy@shipman-video
```

Or run Video Guy as the main agent for a session:

```bash
claude --agent video-guy
```

Verify with `/plugin` (agents, skills and commands should all be listed) and
`node plugins/video-guy/scripts/production.mjs list`.

---

## What's in it

```
plugins/video-guy/
├── .claude-plugin/plugin.json
├── agents/            13 agent definitions
├── skills/            25 SKILL.md packages
├── commands/          /new-video  /video-status  /scout-topics  /qc-video
├── hooks/             manifest guard
├── schemas/           production.schema.json
├── scripts/           production.mjs — the manifest CLI
└── docs/              orchestration.md (normative)
```

### The roster

| Agent | Job |
| --- | --- |
| `video-guy` | The slate: greenlight, staff, monitor, cost, gates, approve |
| `video-producer` | One film, start to finish; owns its manifest |
| `history-topic-scout` | Finds stories, not events; scores and angles them |
| `historical-researcher` | Sources, timeline, people, historiography, dossier |
| `historical-fact-checker` | Attacks the claims, then audits the narration |
| `documentary-story-editor` | Structure and retention |
| `documentary-scriptwriter` | The narration |
| `visual-director` | What is on screen, second by second; the storyboard |
| `historical-archivist` | Real material, and where every piece came from |
| `ai-visual-artist` | The pictures that do not exist — labelled as such |
| `voice-producer` | Narration audio and the master clock |
| `documentary-editor` | Assembly, mix, captions, render, delivery |
| `video-qc` | Independent verdict; gates delivery |

Models: `video-guy` runs on Opus 5 because slate decisions are expensive to get
wrong; everyone else runs on Sonnet 5, except `historical-fact-checker` and
`video-qc`. Those two are the agents whose whole job is catching confident,
plausible, wrong output — the one failure this system exists to prevent, and the
only one that is not cheap to re-run. Each model is set in the agent's own
frontmatter.

Phase 2, once the loop above runs end to end: `narration-director`,
`storyboard-director`, `motion-director`, `motion-graphics-editor`,
`photo-motion-editor`, `sound-designer`, `caption-editor`. Each splits a job a
current agent is already doing — their skills are already written and installed,
so promoting one is a matter of adding an agent file and a row in `GRAPH`.

### The skills

Research and truth — `historical-research`, `source-verification`,
`historical-fact-check`, `citation-ledger`.
Story — `documentary-story-structure`, `documentary-scriptwriting`,
`audience-retention`, `narration-timing`.
Picture — `visual-storytelling`, `storyboard-generation`, `timeline-manifest`,
`archival-asset-search`, `asset-rights-tracking`, `historical-image-prompting`,
`image-to-video`, `photo-parallax`, `animated-maps`,
`documentary-motion-graphics`.
Sound and assembly — `tts-narration`, `sound-design`, `remotion-video`,
`ffmpeg-video`, `subtitle-generation`, `render-pipeline`, `video-qc`.

---

## Using it

```
/scout-topics 1930s engineering failures    # ideas, scored
/new-video "the Great Molasses Flood" --minutes=14 --style=archival
/video-status                               # the slate
/video-status VID-2026-001                  # one film in detail
/qc-video VID-2026-001                      # independent check
```

Or in conversation: *"Video Guy, start the Emu War, the Dancing Plague and the
Molasses Flood."* Three productions, three producers, one slate.

---

## The manifest

`productions/<id>/production.json` is the source of truth. Not an agent's
context. If it is not in the manifest, it did not happen.

```bash
node plugins/video-guy/scripts/production.mjs init "the Great Emu War" --minutes=14 --style=archival
node plugins/video-guy/scripts/production.mjs next  VID-2026-001   # what is runnable, in parallel
node plugins/video-guy/scripts/production.mjs sync  VID-2026-001   # reconcile with the CLI's cache
node plugins/video-guy/scripts/production.mjs check VID-2026-001   # assert the invariants
node plugins/video-guy/scripts/production.mjs stage VID-2026-001 research done --artifact=... --cost=0.42
node plugins/video-guy/scripts/production.mjs cost  VID-2026-001 generated 3.60 "12 images @ $0.30"
```

Schema: `schemas/production.schema.json`. Writes are atomic and logged; a
PreToolUse hook blocks hand edits, because hand edits skip the log and lose
concurrent writes.

`next` is the important one — it computes runnable stages from a single graph so
five agents cannot each remember a different dependency order.

### Folder layout

```
productions/VID-2026-001/
├── production.json
├── research/dossier.md
├── story/architecture.md
├── storyboard/storyboard.json
├── assets/{archival,generated,maps,graphics,video}/
├── audio/pronunciation.md
└── qc/report.md
```

The film's working state and deliverables stay where the pipeline already puts
them — `pipeline/work/<slug>/` and `out/<slug>/` — and `slug` is the join key
between the two trees.

---

## The pipeline it drives

```
research → claims → factcheck → story → script → verify → visuals → storyboard
    → {archival ‖ generated ‖ motion} → render → qc → master
                narrate → sound / captions,  citations
```

CLI stages run as `npm run make-video -- "<topic>" --slug=<slug> --only=<stage>`
and are cached by input hash: change nothing and nothing re-runs. Agent stages
produce artifacts under `productions/<id>/`.

Three properties of the CLI that the agents are built around, and must not
undermine:

1. **Research must reach the network.** Stages requiring live sources declare
   `requireTools: ['WebSearch']` and fail if the model answered from memory.
2. **Fewer than six surviving claims stops the run.** Not enough established
   material for a film.
3. **High-severity audit findings stop the run.** The `revise` stage applies the
   auditor's own corrections and re-audits. `--allow-findings` exists; using it
   to get a render moving is how a channel ships an error.

---

## Rules that make it work

Full text in `docs/orchestration.md` — normative, and read before the first
dispatch of a session. The short version:

- **Only the producer writes the manifest.** Specialists report; the producer
  records.
- **Every agent owns explicit paths** and writes nowhere else.
- **Serialize only real dependencies.** Everything else runs concurrently.
- **Three attempts per stage, then escalate** with the actual error.
- **Re-running a stage marks everything downstream stale** (`--invalidate`).
- **Three films at once, $25 each**, and no paid generation without the user's
  approval for that production.
- **Six gates before delivery**, verified against files on disk, with QC
  performed by an agent that did not make the film.
- **A recreation catalogued as archival is a shipping-stop defect.** Every asset
  carries `authenticity` and cleared rights.

---

## Extending it

**Adding an agent**: write `agents/<name>.md`, add a row to `GRAPH` in
`production.mjs` with its `needs` and `executor`, and add the stage to the
`propertyNames` enum in the schema. `next` picks it up with no other changes.

**Adding a skill**: `skills/<name>/SKILL.md` with `name`, `description` and
`version`. The description is what gets it invoked, so write it as trigger
phrases.

**Adding a visual style**: add an entry to `STYLES` in
`pipeline/core/styles.mjs` and register scenes for it in `src/scenes/`. Never
edit a stage — style is a parameter of the pipeline, not a fork in it. See
`docs/scene-layer-contract.md`.

**Where the picture still thins out.** The scene layer resolves by scene kind,
so `--style` reaches a generated topic and the visual director's assignments
actually land. Two bounded gaps remain, and the CLI reports both rather than
letting them be found on screen:

- `archival`, `cinematic` and `motion-graphics` natively treat 3 of 9 scene
  kinds; the rest fall through to the base hand-drawn scenes. `--list-styles`
  prints `partial · 3/9` for those. Closing it means adding scene components.
- `map`, `timeline`, `strata` and `relay` still draw Troy's content rather than
  reading their options, so for a generated topic they degrade to atmosphere —
  a plainer picture rather than the wrong one. Each disappears from
  `PORTABLE_KINDS` in `src/scenes/styles/registry.ts` the moment its scene reads
  its options; the pipeline already fills them.
