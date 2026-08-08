# Orchestration rules

**Normative.** Video Guy and every producer follow this. Where an agent's own
instructions and this file disagree, this file wins.

---

## 1. The hierarchy

```
video-guy                        (executive producer — main agent)
├── history-topic-scout          (ideas, on demand)
├── VIDEO-001 ── video-producer  ── specialists
├── VIDEO-002 ── video-producer  ── specialists
└── VIDEO-003 ── video-producer  ── specialists
```

Who may spawn what:

| Agent | May spawn |
| --- | --- |
| `video-guy` | `video-producer`, `history-topic-scout` — nothing else |
| `video-producer` | any specialist |
| specialists | nothing |

A specialist that wants another specialist's work done reports the need to its
producer. Specialists spawning specialists is how a run loses track of who owns
which file.

---

## 2. The stage graph

Defined once, in `plugins/video-guy/scripts/production.mjs` (`GRAPH`), and
queried with `production.mjs next <id>`. Do not re-derive it from memory.

```
scout
  │
research → claims → factcheck → story → script → verify ─┬─→ citations
                                                          │
                                                          └─→ visuals ─┬─→ narrate ─┬─→ sound
                                                                       │            ├─→ captions
                                                                       │            └──────┐
                                                                       └─→ storyboard ─┬─→ archival  ┐
                                                                                       ├─→ generated ├─→ render → qc → master
                                                                                       └─→ motion    ┘
```

| Stage | Owner | Executor |
| --- | --- | --- |
| `scout` | history-topic-scout | agent |
| `research` | historical-researcher | `cli --only=research` |
| `claims` | historical-researcher | `cli --only=claims` |
| `factcheck` | historical-fact-checker | `cli --only=factcheck` |
| `story` | documentary-story-editor | agent |
| `script` | documentary-scriptwriter | `cli --only=script` |
| `verify` | historical-fact-checker | `cli --only=verify` (+ `revise`) |
| `visuals` | visual-director | `cli --only=visuals` |
| `storyboard` | visual-director | agent |
| `archival` | historical-archivist | agent |
| `generated` | ai-visual-artist | agent |
| `motion` | visual-director | agent |
| `narrate` | voice-producer | `cli --only=narrate` |
| `sound` | documentary-editor | agent |
| `render` | documentary-editor | `cli --only=render` |
| `captions` | documentary-editor | agent |
| `citations` | documentary-editor | `cli --only=citations` |
| `qc` | video-qc | agent |
| `master` | documentary-editor | agent |

**Serialize only where there is a real data dependency.** Research before
claims, narration before precise timing, timing before assembly. Everything else
runs concurrently — dispatch all of `next`'s runnable list in one message.

The widest fan-out is after `storyboard`: archival, generated and motion all run
at once, while `narrate → sound`, `captions` and `citations` run alongside them.

---

## 3. State

`productions/<id>/production.json` is the source of truth. Not an agent's
context, not a summary in a message.

- **Only the producer writes the manifest.** Specialists report; the producer
  records. Two agents writing it concurrently loses a write.
- Every mutation goes through `production.mjs`. It writes atomically
  (temp + rename) and appends to the log.
- On resume, `production.mjs sync <id>` reconciles the CLI stages against what
  `pipeline/cli.mjs --status` actually has cached, before anything is dispatched.
- `production.mjs check <id>` asserts the invariants. Run it before claiming
  anything is finished.

### Filesystem ownership

| Path | Owner |
| --- | --- |
| `productions/<id>/production.json` | producer, exclusively |
| `productions/<id>/research/` | historical-researcher |
| `productions/<id>/story/` | documentary-story-editor |
| `productions/<id>/storyboard/` | visual-director |
| `productions/<id>/assets/archival/`, `assets/maps/` | historical-archivist |
| `productions/<id>/assets/generated/`, `assets/video/` | ai-visual-artist |
| `productions/<id>/assets/graphics/` | visual-director |
| `productions/<id>/audio/` | voice-producer |
| `productions/<id>/qc/` | video-qc |
| `pipeline/work/<slug>/` | the CLI — no agent writes here by hand |
| `out/<slug>/` | the CLI and documentary-editor |
| `src/` | visual-director and documentary-editor, for scene components |

Every specialist is briefed with its own paths and told not to write elsewhere.

---

## 4. Concurrency

- **3 productions** in `in-production` at once. More starves each of them.
- **6 concurrent specialists** per production.
- **12 concurrent agents** overall across the slate.

Additional approved topics wait in `state: "approved"` — that is what the state
is for.

---

## 5. Cost

| | |
| --- | --- |
| Per film | $25 |
| Per batch | $75 |
| Paid image/video generation | requires the user's explicit approval, per production |

Every spend is logged as it happens: `production.mjs cost <id> <stage> <usd>
"<what>"`. The command exits non-zero over the cap.

Approaching a cap is a decision, not an emergency: stop, and bring the user a
concrete choice — raise the cap, cut scope, or ship what exists. Never spend past
a cap on the theory that it is nearly finished.

Cheap before expensive: preview renders before full renders, parallax on real
photographs before generated motion, motion graphics before generated imagery.

---

## 6. Failure and restart

1. Record `failed` with `--error=<actual error text>`.
2. Read the error. Diagnose the cause.
3. Fix the cause and retry. **Three attempts maximum.**
4. Then escalate to Video Guy with the error text and what was tried.

Never:

- retry a fourth time hoping for different output;
- route around a failing stage by hand-writing its artifact;
- substitute a weaker output and continue silently;
- mark a stage `done` when its artifact is missing or malformed.

**Invalidation.** Re-running a stage marks everything downstream `stale`:
`production.mjs stage <id> <stage> done --invalidate`. A stale stage must re-run
before delivery. This is the only defence against a film assembled from a script
that has since changed.

---

## 7. Quality gates

A film may be reported finished only when all of these hold, verified against
files on disk:

1. `verify` passed with no unresolved high-severity findings, and `--allow-findings`
   was not used.
2. `out/<slug>/citations.md` exists, and load-bearing claims carry sources.
3. Every asset has an `authenticity` value and a cleared `rights.status`. An AI
   recreation catalogued as archival is a shipping-stop defect.
4. `qc.status` is `pass` or `pass-with-notes`, with zero open `blocking`
   findings, produced by an agent that did not make the film.
5. The master was probed — 16:9, correct resolution and frame rate, duration
   within a second of `timing.durationSec`, loudness in spec — and frames were
   looked at.
6. `production.mjs check <id>` is clean.

A failed gate goes back to the owning agent with the defect, the evidence, and
what fixed looks like.

---

## 8. Reporting

Lead with the outcome. What the film is, where it is, what was verified and how,
what is degraded and why, and the one next action if there is one.

Never represent a partial result as complete. If a film ships with a fallback
voice, placeholder art or a trimmed section, say exactly that.
