---
description: Show the state of the documentary slate, or one production in detail
argument-hint: "[VID-2026-001]"
---

# Video status

Read state from disk. Do not summarize from memory or from an agent's report.

Without an argument — the whole slate:

```bash
node plugins/video-guy/scripts/production.mjs list
```

With a production id (`$ARGUMENTS`):

```bash
node plugins/video-guy/scripts/production.mjs sync  $ARGUMENTS
node plugins/video-guy/scripts/production.mjs next  $ARGUMENTS
node plugins/video-guy/scripts/production.mjs check $ARGUMENTS
npm run make-video -- "<topic from the manifest>" --slug=<slug> --status
```

Report, per production:

- state, and how many stages are done, running, failed or stale;
- what is runnable right now and who owns it;
- spend against cap;
- open QC findings by severity;
- anything `check` flagged;
- the single next action.

If a stage has failed three or more times, lead with that — it is the thing that
needs a decision, not the progress bar.
