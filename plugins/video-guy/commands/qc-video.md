---
description: Run independent quality control on a finished cut
argument-hint: "VID-2026-001"
---

# QC a video

Dispatch the `video-qc` agent for `$ARGUMENTS`.

It must be independent of the agents that made the film. If this session's
producer or editor made the cut, spawn a fresh QC agent — do not have a maker
check its own work.

Brief it with:

- the production id, manifest path, and the master's path;
- `productions/<id>/storyboard/storyboard.json` — what should be on screen;
- `out/<slug>/citations.json` — what the film is allowed to assert;
- the asset manifest — which pictures are real and which are recreations.

It inspects the file (`ffprobe`, `ebur128`, `blackdetect`, `freezedetect`,
extracted frames) **and looks at the frames**, then reports findings with
timecodes, severities and fix owners, and a verdict of pass / pass with notes /
fail.

Record the result:

```bash
node plugins/video-guy/scripts/production.mjs set <id> qc.status <verdict>
node plugins/video-guy/scripts/production.mjs stage <id> qc done --artifact=productions/<id>/qc/report.md
```

Any open blocking or high finding means the film does not ship. Route each to
its owner, re-run the affected stages, and re-check.
