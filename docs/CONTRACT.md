# Pipeline data contract

**This file is normative.** Every stage reads and writes exactly these shapes.
If you think a shape needs to change, say so — do not change it unilaterally,
because another workstream is coding against it right now.

Stage artifacts live at `pipeline/work/<slug>/stages/<stage>.json`, each wrapped
in an envelope written by `pipeline/core/cache.mjs`:

```jsonc
{ "stage": "research", "version": 1, "key": "<hash>", "generatedAt": "...", "slug": "...", "data": { /* the shapes below */ } }
```

Stages only ever see `data`. `runStage()` handles the envelope.

---

## 1. `research` → `data`

```jsonc
{
  "topic": "the fall of Carthage",
  "workingTitle": "THE CITY ROME COULD NOT FORGIVE",
  "period": "264–146 BCE",
  "summary": "2–4 sentences of neutral orientation.",
  "keyQuestions": ["The questions a viewer would actually want answered."],
  "historiography": "Where historians disagree, and why. 2–5 sentences.",
  "sources": [
    {
      "id": "S1",                       // stable, referenced everywhere downstream
      "title": "...",
      "author": "...",                  // "" when institutional
      "publisher": "...",               // journal, press, museum, encyclopedia
      "year": "1990",                   // "" when unknown — never guess
      "url": "https://...",             // must be a URL actually visited
      "kind": "academic|reference|museum|primary|news|other",
      "reliability": "high|medium|low",
      "accessedAt": "2026-08-07",
      "summary": "What this source establishes, in one or two sentences.",
      "excerpts": [ { "quote": "...", "supports": "what this passage backs up" } ]
    }
  ],
  "cautions": ["Known myths, popular misconceptions, or contested figures to watch for."]
}
```

Rules: at least 8 sources; at least 3 with `reliability: "high"`; every `url`
must have been fetched or returned by a search, never recalled. Primary sources
(Polybius, Appian…) are `kind: "primary"` and are **evidence about what was
claimed**, not automatically evidence about what happened.

## 2. `claims` → `data`

The argument, drafted before a word of narration is written.

```jsonc
{
  "thesis": "One sentence. The argument the film makes, not the subject it covers.",
  "throughline": "How the argument is carried across sections. 2–3 sentences.",
  "coldOpen": "The concrete, specific hook the film opens on — an image or a fact, never a summary.",
  "sections": [
    { "id": "hook", "title": "SECTION TITLE IN CAPS", "beat": "cold-open|setup|turn|evidence|complication|verdict|outro",
      "intent": "What this section must accomplish.", "claimIds": ["C1","C2"] }
  ],
  "claims": [
    { "id": "C1",
      "statement": "A single falsifiable assertion, stated flatly.",
      "kind": "date|number|person|event|quote|interpretation|context",
      "sourceIds": ["S1","S3"],
      "importance": "load-bearing|supporting|color" }
  ]
}
```

Rules: 5–8 sections, first `beat: "cold-open"`, last `beat: "outro"`. Every
claim carries at least one `sourceIds` entry. One assertion per claim — split
compound sentences.

## 3. `factcheck` → `data`

```jsonc
{
  "verdicts": [
    { "claimId": "C1",
      "verdict": "established|disputed|unsupported|false",
      "confidence": "high|medium|low",
      "supportingSourceIds": ["S1"],
      "contradictingSourceIds": [],
      "falsification": "What would make this false, what was searched for, and what was found. Required, non-empty.",
      "requiredHedge": null,             // e.g. "generally placed around", "if it happened at all"
      "correctedStatement": null,        // replaces `statement` downstream when non-null
      "note": "" }
  ],
  "summary": { "established": 0, "disputed": 0, "unsupported": 0, "false": 0 },
  "blocking": ["Human-readable problems that should stop the run."]
}
```

Rules: exactly one verdict per claim. `unsupported` and `false` claims are
**dropped** before scripting. `disputed` claims survive only with a
`requiredHedge`, which the script must use verbatim-in-spirit.

## 4. `script` → `data`

Mirrors `scripts/script-data.mjs` — that structure is the contract the TTS and
render machinery already consumes — plus provenance and scene assignment.

```jsonc
{
  "title": "THE CITY ROME COULD NOT FORGIVE",
  "style": "archival",
  "topic": "the fall of Carthage",
  "sections": [
    { "id": "hook", "title": "THE CITY ROME COULD NOT FORGIVE",
      "paragraphs": [
        { "shot": "hook-harbour",              // -> becomes `image` in script-data.mjs
          "pauseAfter": "effect",              // key of PAUSE: sentence|paragraph|effect|beat|section
          "sentences": [
            { "text": "In 146 BC, ...",        // what the subtitles show
              "tts": "In one forty-six BC, ...", // optional: what the narrator says
              "claimIds": ["C1"] }             // [] for rhetorical/transitional lines
          ] }
      ] }
  ],
  "shots": [
    { "id": "hook-harbour",
      "intent": "Why this shot exists, one line.",
      "scene": { "kind": "atmosphere", "options": { "mood": "fire", "intensity": 0.8 } },
      "prompt": "Art direction for still-image fallback. The run's style suffix is appended, never inlined." }
  ]
}
```

Rules:
- Every `paragraphs[].shot` must appear in `shots[]`; every `shots[].id` must be used.
- Adjacent paragraphs may share a shot (`tts.mjs` merges them into one shot).
- `scene.kind` must be one of `SCENE_KINDS` in `pipeline/core/styles.mjs`.
- `tts` is present **only** where the written form would be misread — years,
  Roman numerals, "BCE", "c.", symbols. Never restate the sentence.
- Last section's `paragraphs.at(-1).pauseAfter` should be `"paragraph"`.

## 5. `timing.json` (produced by `scripts/tts.mjs`, then enriched)

`tts.mjs` writes its existing schema unchanged. The visuals stage then adds two
**additive** fields, so old consumers keep working:

```jsonc
{
  "fps": 30, "sampleRate": 24000, "voice": "Voice1", "voiceModel": "am_michael",
  "durationSec": 0, "sentences": [], "sections": [],
  "shots": [ { "imageId": "hook-harbour", "start": 0, "end": 21.4,
               "scene": { "kind": "atmosphere", "options": {} } } ],   // ADDED
  "style": "archival",                                                  // ADDED
  "topic": "the fall of Carthage",                                      // ADDED
  "title": "..."                                                        // ADDED
}
```

`style` is how visual direction reaches the renderer: the composition takes no
new props, it reads `timing.style`. See `docs/scene-layer-contract.md`.

## 6. `citations` → `out/<slug>/citations.md` + `citations.json`

`citations.json` is the machine-readable join of the three artifacts above:

```jsonc
{
  "topic": "...", "title": "...", "generatedAt": "...",
  "sources": [ /* research.sources, unchanged, plus "citedBy": ["C1","C4"] */ ],
  "claims": [ { "id": "C1", "statement": "...", "verdict": "established",
                "sourceIds": ["S1"], "sectionId": "hook",
                "sentenceIndices": [0, 1] } ],
  "unusedSources": ["S9"],
  "summary": { "sourceCount": 0, "claimCount": 0, "established": 0, "disputed": 0, "droppedUnsupported": 0 }
}
```

---

## Shared modules (already written — use them, do not reimplement)

| Module | Exports |
| --- | --- |
| `pipeline/core/paths.mjs` | `ROOT`, `slugify`, `workDir`, `stagePath`, `overlayDir/Scripts/Public/Timing/Audio`, `outDir`, `ensureDir`, `rel` |
| `pipeline/core/log.mjs` | `stageStart/stageEnd`, `info/step/warn/fail/cached`, `PipelineError`, `reportFatal`, colour helpers |
| `pipeline/core/cache.mjs` | `runStage({slug,stage,version,inputs,force,produce})`, `readStage`, `clearStage`, `hashOf`, `stageStatus` |
| `pipeline/core/llm.mjs` | `callClaude`, `callClaudeJson`, `WEB_TOOLS`, `extractJson`, `costSoFar` |
| `pipeline/core/styles.mjs` | `STYLES`, `STYLE_IDS`, `DEFAULT_STYLE`, `resolveStyle`, `SCENE_KINDS`, `validateScene`, `probeSceneLayer`, `planStyle` |

`callClaudeJson({ prompt, system, tools, requireTools, validate, label, slug })`
retries on malformed output, feeding the validation errors back to the model.
Pass `requireTools: ['WebSearch']` on any stage that must not answer from
memory — the call **fails loudly** if the model never hit the network.
