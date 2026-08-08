---
name: historical-research
description: Use when establishing the factual foundation for a history video — collecting sources, building a timeline, identifying people and places, capturing quotations, and mapping where historians disagree. Triggers include "research this topic", "build a dossier", "what do we actually know about", running the pipeline's research stage, or judging whether a research artifact is good enough to build a film on.
version: 1.0.0
---

# Historical research

Research establishes what is known, how well, and who says so. It is not
writing, and it is not fact-checking. Its output is a foundation somebody else
builds on.

## Run it through the pipeline

```bash
npm run make-video -- "<topic>" --slug=<slug> --only=research
```

`pipeline/stages/research.mjs` calls the model with `requireTools:
['WebSearch']`. If the model never reaches the network, the call **fails** — a
confident uncited answer from memory is treated as an error, not a degradation.
Never work around that by supplying recalled sources.

Output shape: `docs/CONTRACT.md` §1. Minimums are ≥8 sources and ≥3 at
`reliability: "high"`.

## What makes a source usable

| Tier | | Weight |
| --- | --- | --- |
| Academic | peer-reviewed monographs, journal articles, university presses | highest |
| Institutional | national archives, major museums, government records | high |
| Reference | major encyclopedias, scholarly reference works | orienting only |
| Primary | contemporary documents, letters, official reports, newspapers | evidence of *what was claimed* |
| Popular | general-audience history, documentaries, blogs | leads, never citations |

**Primary is not automatic truth.** A 1919 newspaper reporting 200 dead is
evidence about what the paper printed. Contemporary casualty figures, costs and
crowd sizes are wrong constantly. Triangulate or hedge.

## Meeting the minimum is not the same as being usable

Ask of a finished research artifact:

- Do these sources address the **film's argument**, or the general subject?
- Are the high-reliability ones actually load-bearing, or are they three
  encyclopedia entries?
- Is the historiography section a real account of a live disagreement, or one
  sentence of throat-clearing?
- Do the cautions name the specific myths this topic attracts?

If any answer is no, re-frame the topic and re-run with
`--refresh=research,claims`. Say what you changed.

## The dossier

The stage artifact is for machines. Write
`productions/<id>/research/dossier.md` for the humans and agents downstream:
short version, timeline, people, places, what the sources say per claim, where
historians disagree, myths to kill, quotable material, imagery leads, open
questions. The archivist reads the imagery leads; the story editor reads the
disagreements; the fact-checker reads the cautions.

## Never

- Reconstruct a citation from memory.
- Guess a year, page, publisher or spelling. Leave it empty.
- Resolve a live scholarly disagreement into one confident sentence.
- Promote an unsourced claim to "probably true". It is unverified, and it goes
  in the cautions list.
