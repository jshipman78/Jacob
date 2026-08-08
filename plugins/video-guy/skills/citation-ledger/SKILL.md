---
name: citation-ledger
description: Use when producing or auditing the citation record that ships with a documentary — mapping every narration sentence back to a claim and every claim back to sources, generating citations.md and citations.json, and disclosing AI-generated assets. Triggers include "generate citations", "what backs this sentence", "citation file", "attribution", and pre-delivery checks on sourcing.
version: 1.0.0
---

# Citation ledger

The ledger is how this channel keeps its promise: it says plainly what is
established, what is argued about, and what is just a story people repeat. Treat
it as a deliverable, not a by-product.

## Generate it

```bash
npm run make-video -- "<topic>" --slug=<slug> --only=citations
```

Writes `out/<slug>/citations.md`, `citations.json` and the transcript. The JSON
is the machine-readable join of research, claims, factcheck and script
(`docs/CONTRACT.md` §6): every source with the claims it supports, every claim
with its verdict, its sources, its section, and the sentence indices where it
was actually said.

## The chain that must hold

```
sentence  →  claimIds  →  claim  →  verdict  →  sourceIds  →  source (url, accessed)
```

Break it anywhere and the film is asserting something it cannot back. Audit in
both directions:

- **Forward:** every load-bearing claim reaches at least one live source.
- **Backward:** every factual sentence in the narration reaches a claim.
  Sentences with `claimIds: []` must be genuinely rhetorical or transitional —
  a factual assertion with no claim id is an unsourced statement that slipped
  past the ledger, and it is the most common way accuracy leaks out of a
  pipeline that is otherwise careful.

## What the shipped file must contain

- Sources: title, author, publisher, year, URL, kind, reliability, date accessed.
- Claims: statement as said, verdict, hedge if any, sources.
- What was **cut** and why. Publishing the cuts is more credible than publishing
  only the survivors, and it is cheap.
- Where historians disagree, with both positions.
- **Asset provenance**: archival material with its holding institution and
  identifier, AI-generated material disclosed as generated.

## Attribution

Some institutions require a specific credit line. Carry it verbatim from
`assets[].rights.attribution` into the video description, and on screen where
required. An asset whose `rights.status` is `unknown` at delivery is a blocking
defect, not a note.

## Disclose the recreations

Any asset with `authenticity` of `recreation` or `synthetic` is disclosed in the
description, and never captioned or graded to read as archival. A viewer must be
able to tell which pictures are real. The manifest already knows — the ledger
just has to say it.
