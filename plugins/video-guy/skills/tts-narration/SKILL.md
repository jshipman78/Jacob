---
name: tts-narration
description: Use when synthesizing narration audio, managing narrator voices, or fixing pronunciation — running the pipeline's narrate stage, maintaining a pronunciation dictionary, auditioning voices, and diagnosing bad synthesis. Triggers include "generate the voiceover", "it's pronouncing X wrong", "change the narrator", "re-record that line", and any TTS work in this repo.
version: 1.0.0
---

# TTS narration

## One implementation

`scripts/tts.mjs` is the only synthesizer and the only source of the timeline.
Per-sentence Kokoro synthesis, content-hash caching, pause insertion, measured
timing. Do not write a second one.

The narrate stage reaches it without editing it: it mirrors `scripts/` into a
runtime overlay at `pipeline/work/<slug>/rt/` with the generated script in place
of the hand-authored one, so every path `tts.mjs` computes lands inside the
overlay. The repository's `public/` is never touched and two productions can
narrate concurrently.

```bash
npm run make-video -- "<topic>" --slug=<slug> --only=narrate --voice=Voice1
```

Outputs: `rt/public/audio/narration.wav`, `rt/public/timing.json`.

## Voices

`scripts/voices.mjs` maps a channel-stable **name** to an engine model.
`Voice1` = Kokoro `am_michael`: American English, male, deep and measured,
chosen in a head-to-head audition for the most deliberate delivery.

Always refer to a voice by name. Changing a voice's model changes the
per-sentence cache key, so a voice change re-synthesizes the entire film — never
do it casually, and never mid-production.

## Caching

Sentences are cached by content hash in `.cache/`. Rewrite one sentence and only
that sentence re-synthesizes. This makes fix-and-re-run cheap, which is why
fixing a mispronunciation properly is always better than living with it.

## Pronunciation

Corrections reach the synthesizer through the script's `tts` field, never
through a separate lexicon file:

```
Ypres              EE-pruh
Guadalcanal        gwah-dul-kuh-NAL
Tsutomu Yamaguchi  tsoo-TOH-moo yah-mah-GOO-chee
Beauchamp (UK)     BEE-chum
1932               nineteen thirty-two
```

Keep the working list at `productions/<id>/audio/pronunciation.md`. Get names
right per the culture they come from, and note deliberate anglicisations.

`text` is what subtitles show; `tts` is what the narrator says. Never restate a
full sentence in `tts` — that is how audio and captions drift apart.

## Audit the output

Synthesis that ran without error is not synthesis that is good. Listen for:
every proper noun and number; questions landing as statements; clicks at joins;
clipped word starts; one sentence at the wrong level. Fix pace with `PAUSE`
values and sentence length, never with the speed setting.
