# Documentary video pipeline

Turn a historical topic into a finished, historically accurate, cited
documentary video.

```bash
npm run make-video -- "the fall of Carthage"
```

That researches the topic against live sources, attacks every claim it intends
to make, writes narration in the channel's house style, synthesizes it, assigns
a visual treatment to every shot, renders the film, and ships a citations file
beside it.

The repository contains two things:

| | |
| --- | --- |
| `pipeline/` | the generalized CLI — any topic, any of four visual styles |
| `scripts/` + `src/` | the hand-authored **Troy** video the pipeline was generalized from, still building unchanged |

---

## Requirements

- **Node 18+** and `npm install`.
- **Claude Code on `PATH`.** Every generative stage is a headless `claude -p`
  subprocess, which is also how the pipeline gets live web search. There is no
  second API key to provision: if `claude --version` works here, the pipeline
  works. Check with:
  ```bash
  printf 'Use WebSearch to find the capital of Portugal.' | claude -p --allowedTools WebSearch
  ```
  If that answers without searching, or errors, research will **fail loudly**
  rather than quietly writing a script from memory — see [Accuracy](#accuracy).
- **Python 3** with the Kokoro ONNX runtime, and the model weights in
  `.cache/kokoro/` (`kokoro-v1.0.onnx`, `voices-v1.0.bin`). Running the Troy
  build once populates them; `scripts/tts.mjs` documents where they come from
  and why huggingface.co is not used.
- **No image-generation key.** The film renders procedural animated scenes, so
  `FAL_KEY` / `GEMINI_API_KEY` are unused by this pipeline. They still apply to
  the Troy video's optional still artwork.

## Usage

```bash
npm run make-video -- "<topic>" [flags]
npm run make-video -- --help
```

### Visual style

Every video starts from an explicit style choice.

```bash
npm run make-video -- "the fall of Carthage" --style=hand-drawn
npm run make-video -- --list-styles
```

| id | |
| --- | --- |
| `archival` | Engraved information design — strata columns, deep-time axes, claim ledgers, survey maps, as if plated into a 19th-century monograph. **Default.** |
| `hand-drawn` | Period illustration — pen-and-ink linework and washed colour, the look of a plate torn from a contemporary account. |
| `cinematic` | Layered parallax and volumetric depth — dust in shafts of light, foreground silhouettes against far horizons. |
| `motion-graphics` | Kinetic typography led — the argument is set in type and moves with the voice. |

An unknown style is rejected with the valid list. A **valid but not-yet-built**
style is accepted with a warning: the script, shot plan and art direction are
all built for it, and only the on-screen look falls back — see
[`docs/scene-layer-contract.md`](docs/scene-layer-contract.md).

Style is a parameter threaded end to end, never a fork in the code. It reaches
the renderer inside `timing.json`, so no render command or composition prop
changes.

### Choosing a style by eye

```bash
npm run make-video -- "the fall of Carthage" --compare-styles
```

Renders the same one-minute span of the same narration once per available
style and writes `out/<slug>/compare/index.html` — a contact sheet you can open
and watch side by side before committing to a full render. The span is chosen
for the *most distinct scene kinds*, not simply the opening minute, so each
sample shows what a style can do. Add `--compare-seconds=90` to lengthen it.

Styles the scene layer has not built yet are listed as pending rather than
rendered — four identical clips under four names would be worse than saying so.

### Everything else

```
--minutes=<n>          Target runtime (default 14). Sets the section and word budget.
--voice=<name>         Narration voice from scripts/voices.mjs (default Voice1).
--preview[=<seconds>]  Render only the first N seconds. Fast end-to-end check.
--no-render            Stop after narration; still writes citations.
--status               Which stages are cached for this topic.
--from=<stage>         Re-run from this stage onward.
--only=<stage>         Run exactly one stage.
--refresh=<a,b>        Discard those caches, then run normally.
--allow-findings       Proceed despite high-severity audit findings.
--composition=<id>     Remotion composition (default TroyVideo).
--model=<id>           Model for the generative stages (default sonnet).
```

## What comes out

```
out/<slug>/
  <slug>.mp4          the film
  citations.md        every claim, its verdict, its sources, and the timecode it is spoken at
  citations.json      the same, machine-readable
  transcript.md       the narration with timecodes
  compare/index.html  style comparison contact sheet (with --compare-styles)

pipeline/work/<slug>/
  stages/*.json       each stage's cached artifact
  rt/                 the runtime overlay: generated script, narration.wav, timing.json
  llm-calls.jsonl     per-call cost ledger
```

## Accuracy

This is the part that justifies the pipeline existing.

1. **Research cannot be faked.** The transport counts real tool invocations. If
   the research stage never reaches the network, it fails with an explanation
   instead of returning remembered citations. A fabricated bibliography looks
   exactly like a real one, which makes it worse than none.
2. **The argument is committed before the prose.** The film writes down its
   claims — one falsifiable assertion each, dates and figures broken out — and
   only then writes narration. Prose cannot lead the evidence around.
3. **The fact-check is adversarial.** It is told to get claims retracted, given
   live search to hunt for *contradicting* evidence, and made to record what it
   looked for that would have falsified each claim. Generic approvals are
   rejected by the validator and re-run.
4. **Three outcomes, not two.** `established` may be stated flatly. `disputed`
   survives only with a required hedge the narration must speak aloud —
   "generally placed around", "our only source for this is", "if it happened at
   all". `unsupported` and `false` are cut before a word is written.
5. **The finished prose is audited separately**, because writers smooth hedges
   away and round figures. High-severity findings stop the build.
6. **The citations file records the cuts**, the falsification attempted on each
   claim, and the audit findings — not just the successes.

Full detail: [`docs/architecture.md`](docs/architecture.md).

## Documentation

| | |
| --- | --- |
| [`docs/architecture.md`](docs/architecture.md) | the nine stages, and why each is shaped the way it is |
| [`docs/CONTRACT.md`](docs/CONTRACT.md) | the normative data shapes exchanged between stages |
| [`docs/scene-layer-contract.md`](docs/scene-layer-contract.md) | the interface between the pipeline and `src/scenes/` |
| [`pipeline/channel.mjs`](pipeline/channel.mjs) | channel identity — edit this to repoint at a different channel |
| [`pipeline/prompts/house-style.mjs`](pipeline/prompts/house-style.mjs) | the beat sheet, the craft rules, the exemplars |

---

# The Troy video

The hand-authored ~15-minute documentary about Heinrich Schliemann that this
pipeline was generalized from. It still builds exactly as before; the pipeline
never writes to `public/`.

```
scripts/script-data.mjs        narration script + per-shot art direction (source of truth)
scripts/tts.mjs                synthesizes narration.wav + timing.json
scripts/validate-build.mjs     cross-pipeline validation gate
scripts/gen-images.mjs         still artwork (Fal.ai or Gemini)
scripts/make-placeholders.mjs  stand-in art so the video renders without a key
src/                           the Remotion composition and its animated scenes
public/timing.json             sentence/section/shot timeline (generated)
public/audio/narration.wav     the narration track (generated)
```

```bash
npm run tts        # narration + timing manifest
npm run images     # shot artwork (needs a provider key, see below)
npm run render     # -> out/troy-video.mp4
npm run dev        # Remotion Studio
```

`script-data.mjs` is the single source of truth. Every sentence carries the text
shown on screen, and where a written form would be mispronounced ("1873",
"Troy VIIa", "2400 BCE") it also carries a spoken variant. The subtitles always
show the written form; the narrator always speaks the spoken one.

`timing.json` couples the three pipelines together. It records the real measured
start and end of every spoken sentence, so the subtitles, the section title
cards and the image cuts are all driven by the actual audio rather than by
estimates. Regenerating the narration re-times the whole edit.

## Supplying the Fal key

Only needed for the Troy video's still artwork. Three options, best first:

1. **Environment secret (recommended).** Add `FAL_KEY` to this Claude Code
   environment's configured environment variables — it is then present in every
   session and never touches the repo or a transcript.
2. **A local `.env` file.** `cp .env.example .env` and fill in `FAL_KEY`.
   `.env` is gitignored and `gen-images.mjs` parses it directly.
3. **Shell environment for one run:** `FAL_KEY=... npm run images`.

## Network policy note

The image step calls `queue.fal.run`. Inside a Claude Code web environment the
egress policy must permit that host, or the request is refused at the proxy
before it reaches Fal. `gen-images.mjs` preflights the host and says so plainly.
The same applies to `generativelanguage.googleapis.com` for the Gemini provider.
Until a provider is reachable, `npm run placeholders` generates stand-in art so
the full video still renders.

## Cost

`gen-images.mjs` estimates spend before it starts, refuses to exceed a $2
ceiling, and prints a running total. `--dry-run` shows the prompts and projected
cost without spending; `--only=<id>,<id>` re-rolls individual shots.
