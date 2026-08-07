# Architecture

```
npm run make-video -- "the fall of Carthage" --style=archival
```

Nine stages. Each one writes a JSON artifact to
`pipeline/work/<slug>/stages/<stage>.json`, keyed by a hash of its inputs —
the topic, its own version number, and the resolved keys of every upstream
stage it consumed. If the key matches what is on disk, the stage is skipped.

That is the same idea `scripts/tts.mjs` already uses to cache individual
utterances, applied at stage granularity, because these stages cost minutes
rather than seconds and a crash at render time must not cost an afternoon of
research.

```
   topic ──▶ research ──▶ claims ──▶ factcheck ──▶ script ──▶ verify
                                                                │
                                            visuals ◀───────────┘
                                                │
                                            narrate ──▶ render ──▶ citations
```

## The stages

### 1. `research` — collect real sources

A headless `claude -p` call with `WebSearch` and `WebFetch`, told to run at
least six distinct searches and to record only URLs it actually opened.

The important part is not the prompt. It is that `callClaude` reads
`--output-format stream-json` and **counts actual tool invocations**, and this
stage declares `requireTools: ['WebSearch']`. A model asked to research a topic
will otherwise answer from memory and return confident, plausible, unverifiable
citations — which is strictly worse than no citations file, because it looks
like diligence. If the network was never touched, the stage fails with an
explanation and a one-line command to reproduce the problem.

Rejects its own output unless there are 8+ sources with 3+ marked high
reliability, each carrying a quoted excerpt.

### 2. `claims` — draft the argument, not the prose

Produces a thesis, a section plan on the house beat sheet, and a ledger of
falsifiable assertions with sources attached — one assertion per claim, dates
and figures broken out as their own claims.

This is separate from writing for a reason. Ask a model for a script and a
bibliography in one pass and the prose leads: it writes what it wants and
attaches whichever citation is nearest. Splitting the stages inverts that. The
film commits to specific checkable statements, those get attacked, and only the
survivors reach the writer. It also gives the fact-checker something small to
work on instead of having to reverse-engineer claims out of finished prose.

Section budgets come from `budgetFor(minutes)` in `prompts/house-style.mjs`,
calibrated against the finished Troy video: 1,984 words → 13:52 of narration,
so 143 words per minute including every pause.

### 3. `factcheck` — try to falsify each claim

Framed as an attack, in batches of six, with live web access.

A checker asked "is this supported?" reads the claim, reads the source that was
attached to it, finds them compatible, and approves. That is a rubber stamp with
extra steps. So this stage is told its job is to get claims retracted; it must
write down what it searched for that *would have* falsified each claim; and the
validator rejects generic falsification notes ("the sources support this",
"no contradicting evidence found") and re-runs the batch.

Four verdicts, and the distinction between them is the whole point:

| verdict | meaning | what happens |
| --- | --- | --- |
| `established` | multiple independent reliable sources, no credible dissent | may be stated flatly |
| `disputed` | genuine scholarly disagreement, or an uncorroborated single-source figure | survives **only** with a `requiredHedge` the narration must speak aloud |
| `unsupported` | not disproven, just not shown | cut before writing |
| `false` | evidence it is wrong | cut, or replaced by `correctedStatement` |

Dates, numbers, named individuals and quotations are flagged HIGH SCRUTINY,
because those are what a viewer checks and what documentaries most often get
wrong. Figures from ancient or contemporary writers are treated as evidence of
what that writer *asserted* — at best `disputed` unless modern scholarship
independently supports them.

If a claim marked `load-bearing` does not survive, that is reported as blocking:
the thesis rested on it, so the argument needs rebuilding rather than patching.

### 4. `script` — write the narration

One call per section, not one call for the film. A single call flattens: the
cold open gets all the craft and the last four sections summarise themselves.
Per-section calls also carry the tail of the previous section, so the seams
hold.

The writer sees only claims that survived, annotated with the hedge each
disputed one must carry. It cannot cite what was cut because it is never shown
it.

The validator is mechanical and its complaints are fed back for another pass,
which turns the house style from advice into something enforced:

- banned constructions ("little did they know", "a testament to", "delve into")
- weasel attributions ("some say", "it is believed") — name who, and on what basis
- rhythm: no four consecutive medium-length sentences; every section needs a
  sentence of seven words or fewer
- no two consecutive sentences opening with the same word; And/But/So openings
  capped at one in five
- **hedge compliance**: if a sentence cites a disputed claim and states it
  flatly, the section is rejected with the required qualification quoted back
- **unverified figures**: any sentence containing a number that cites no claim
  is rejected
- pause discipline, word budget, `tts` overrides that respell rather than rewrite

`prompts/house-style.mjs` holds the beat sheet, the craft rules with their
reasoning attached, and annotated passages from the Troy script as exemplars.
Channel identity — the through-line, the promise, the sign-off — is in
`pipeline/channel.mjs`, which is the one file to edit to point this at a
different channel.

### 5. `verify` — audit the finished narration

Fact-checking the ledger is necessary but not sufficient. Between the ledger and
the script a writer smooths a hedge away, rounds a figure, promotes "one ancient
writer reports" into "we know", or adds a connecting fact that felt obvious.
Those are exactly the errors a viewer catches, because they read as confident.

So the prose gets its own adversarial pass, matching every factual assertion in
the text back to a verified claim, and reporting OVERREACH, LOST HEDGE,
UNTRACED, RESURRECTED, CONTRADICTION or MISATTRIBUTION. High-severity findings
stop the build unless `--allow-findings` is passed. Everything found is written
into the citations file either way.

### 6. `visuals` — assign a scene per shot

One shot per paragraph, resolved to a *scene kind* — `map`, `timeline`,
`ledger`, `statement`, `atmosphere`, … — with its options filled from the
narration itself. Weighted by the style's `sceneBias`, so a motion-graphics
film leans typographic and a cinematic one leans atmospheric. Rejected if fewer
than three distinct kinds appear across six or more shots.

See `docs/scene-layer-contract.md` for how a kind becomes a component.

### 7. `narrate` — synthesize, via the existing pipeline

`scripts/tts.mjs` already does per-sentence Kokoro synthesis with content-hash
caching, pause insertion, and measured timing. Reimplementing it would mean
maintaining two subtly different timelines.

The only obstacle to reusing it is that it derives every path from its own
location on disk. So this stage builds a **runtime overlay**: a throwaway mirror
of `scripts/` at `pipeline/work/<slug>/rt/scripts/`, with the generated
`script-data.mjs` in place of the hand-authored one, `.cache` and `node_modules`
symlinked back to the repo. Running the mirrored copy makes every path it
computes land inside the overlay.

The consequences are the point of the design:

- the repository's `public/timing.json` and `public/audio/` are never written to
- the hand-authored Troy video keeps building, byte-identically
- two topics can be produced concurrently without colliding
- `scripts/tts.mjs` remains the single implementation of the timeline
- the overlay is rebuilt from `scripts/` on every run, so it cannot drift

`scripts/validate-build.mjs` is mirrored and run too. Its artwork checks are
downgraded to warnings — this pipeline renders procedural scenes rather than
stills — while every timing check still fails the build.

Then `timing.json` is enriched with the two additive fields the scene layer
needs (`style`, and `scene` per shot).

### 8. `render` — Remotion, invoked not wrapped

`npx remotion render <composition> <out> --public-dir=<overlay>/public`.

The composition, its components and its scenes all belong to `src/` and are
consumed as they are. The only thing this stage controls is which public
directory Remotion reads, which is what lets a generated topic render from its
own overlay while the Troy build stays where it is.

`--compare-styles` reuses one synthesis and renders the same span once per
style, into `out/<slug>/compare/`, with a contact-sheet `index.html`. The span
is not the first minute by default: `pickSampleWindow` picks the window showing
the most distinct scene kinds, so a sample demonstrates a style's range rather
than whichever scene happens to open the film.

### 9. `citations` — the deliverable that makes the work visible

`out/<slug>/citations.md` and `citations.json`, joining all four upstream
artifacts, with **timecodes measured from the finished narration audio** so each
claim points at the moment it is spoken.

It records what did not survive as well as what did — the cut list, the
falsification attempted on each claim, the audit findings. A citations file that
lists only successes is marketing.

## Resumability

```bash
npm run make-video -- "the fall of Carthage" --status        # what is cached
npm run make-video -- "the fall of Carthage" --refresh=script # rewrite, keep research
npm run make-video -- "the fall of Carthage" --from=visuals   # re-run from there on
npm run make-video -- "the fall of Carthage" --only=render
```

Because a stage's key includes its upstream keys, editing a prompt (and bumping
that stage's `VERSION`) invalidates exactly the stages downstream of it and
nothing else. Re-running research invalidates everything; re-running visuals
invalidates nothing upstream and forces a re-render.

The narration cache is shared with the Troy build at `.cache/tts/`, keyed by
voice and sentence text, so rewriting one paragraph re-synthesizes one
paragraph.

## Cost and credentials

Every generative stage is a `claude -p` subprocess. There is no second API key:
if Claude Code runs in this repo, the pipeline runs. Per-call cost is recorded
to `pipeline/work/<slug>/llm-calls.jsonl` and totalled at the end of a run.

Kokoro's weights are read from `.cache/kokoro/` and are shared with the Troy
build. No image-generation provider is required — the film renders procedural
scenes — so `FAL_KEY` and `GEMINI_API_KEY` are not used by this pipeline.
