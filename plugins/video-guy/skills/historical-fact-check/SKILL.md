---
name: historical-fact-check
description: Use when adversarially testing historical claims or auditing written narration for overreach — assigning verdicts, requiring hedges, detecting myths and weasel phrasing like "historians believe", and running the pipeline's factcheck and verify stages. Triggers include "fact check this", "is this true", "verify the script", "did that actually happen", and any claim that sounds too good.
version: 1.0.0
---

# Historical fact-check

The job is to make claims fail. What survives, the channel can say out loud.

Whoever fact-checks must not be whoever produced the work.

## Two stages

```bash
npm run make-video -- "<topic>" --slug=<slug> --only=factcheck   # attack the claims
npm run make-video -- "<topic>" --slug=<slug> --only=verify      # audit the narration
```

`factcheck` labels claims before writing; `verify` audits the written sentences
afterwards. Both are needed — most real damage is done in phrasing, after the
claims were approved.

## Verdicts

| Verdict | Test | Downstream |
| --- | --- | --- |
| `established` | multiple independent reliable sources, nothing serious against | stated flatly |
| `disputed` | genuine scholarly disagreement, or sources conflict | survives only with a `requiredHedge` |
| `unsupported` | nobody credible actually says it | dropped |
| `false` | contradicted by the evidence | dropped, and often worth correcting on screen |

Two more labels for the prose report, which the contract does not carry:
**high confidence** (one strong source, nothing contradicting) and **anecdotal**
(traceable to a single retelling). Anecdotal material may appear — as an
anecdote, said to be one.

Every verdict needs a non-empty `falsification`: what would make this false,
what was searched, what was found. Without it, it is an opinion.

## Weasel phrases to hunt

- "Historians believe…" — name two, or it is false as written. The single most
  common failure in history video.
- "It is said…", "Legend has it…" used once, then treated as fact for a minute.
- "Many scholars now think…" attached to one paper.
- Round numbers as counts: "thousands died" where the record says "at least 60".
- Post hoc dressed as causal: after ≠ because.
- Drifted quotations — check wording, speaker and date.
- Confident dates for events sources place "around".
- Certainty about anyone's private motives.

## Myth detection

A myth usually has a tell: it is too neat, it has a punchline, it appears in
popular retellings before it appears in records, and its earliest attestation is
decades after the event. Trace the origin. Naming the myth and where it came
from is better television than quietly omitting it.

## Make findings actionable

Every finding carries a **specific replacement sentence**. The `revise` stage
applies proposed corrections automatically and re-audits the result; a finding
with no fix forces a choice between rerolling a section and waving the problem
through. Never advise `--allow-findings` to get a render moving.
