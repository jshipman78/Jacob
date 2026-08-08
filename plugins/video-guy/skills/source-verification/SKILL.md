---
name: source-verification
description: Use when checking whether a source is what it claims to be and whether it actually supports the claim attached to it — triangulating across independent sources, tracing a repeated fact back to its origin, auditing citations, and detecting circular sourcing. Triggers include "verify this source", "is this citation real", "where does this claim come from", "triangulate", and auditing a citations file before delivery.
version: 1.0.0
---

# Source verification

Three separate questions, and they fail differently:

1. **Does the source exist and say what is claimed?**
2. **Is the source any good for this claim?**
3. **Do independent sources agree?**

## Triangulation

A claim is `established` when **independent** sources agree. Independence is the
hard part.

Trace the chain. Five websites, a documentary and a popular history all saying
the same striking number is not five confirmations — it is usually one source
copied six times. Follow it back:

- Where does the earliest version appear?
- Is the number in a **primary** record, or first attested in a retelling
  decades later?
- Does the wording drift on the way? Drifting wording is the signature of a
  chain of copies.
- Do modern academic works cite it, or ignore it? Being ignored by the
  literature is informative.

If the chain converges on one source, the claim carries the reliability of that
source, no matter how many pages repeat it.

## Verifying a citation

- The URL resolves and the page holds the claimed content.
- Author, publisher and year match what the page actually says.
- The quoted passage exists **verbatim**, and the surrounding text does not
  reverse its meaning.
- The work is in the field it is being cited for. A distinguished physicist on
  medieval trade is a popular source.
- The date is the date of the edition consulted.

## Red flags

- A specific number with no primary attestation.
- A quotation attributed to a famous person and to nobody else — famous quotes
  are misattributed more often than not.
- "According to historians" with no historian named.
- A source that exists but does not contain the claim — the most common failure
  in machine-assembled research, and invisible unless you open the page.
- A Wikipedia claim whose footnote is dead, or points at a page that says
  something else.

## Auditing a citations file

Before delivery, take `out/<slug>/citations.json` and check:

- Every load-bearing claim has ≥1 source, and disputed claims have their hedge.
- Every source was actually reached (`accessedAt` present, URL live).
- `unusedSources` is not most of the list — that means the research and the film
  are about different things.
- No source is doing more work than it can bear: one medium-reliability page
  supporting six load-bearing claims is a thin film wearing a thick bibliography.
