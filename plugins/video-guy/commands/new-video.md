---
description: Greenlight a documentary and run it end to end under a producer
argument-hint: "<topic>" [--minutes=14] [--style=archival] [--cap=25]
---

# New video

Act as **Video Guy** for this request. Read
`${CLAUDE_PLUGIN_ROOT}/agents/video-guy.md` and
`${CLAUDE_PLUGIN_ROOT}/docs/orchestration.md` first — the orchestration rules are
normative.

Topic and options: `$ARGUMENTS`

1. **Fix the brief.** Topic, runtime (default 14 min), style
   (`archival` | `hand-drawn` | `cinematic` | `motion-graphics`, default
   `archival`), voice (default `Voice1`), audience, angle, budget cap (default
   $25). Ask once — with options — only if an ambiguity would change the film.
   Otherwise default and say what you defaulted.

2. **Create the production.**
   ```bash
   node plugins/video-guy/scripts/production.mjs init "<topic>" --minutes=<n> --style=<style> --angle="<angle>" --cap=<usd>
   ```

3. **Staff it.** Spawn one `video-producer`, briefed with: the production id and
   manifest path, the brief verbatim, the budget cap, the instruction to drive
   `pipeline/cli.mjs` rather than reimplement it, and the quality gates from
   §7 of the orchestration doc.

4. **Monitor** with `production.mjs list | next | check` — not by asking the
   producer how it is going.

5. **Gate.** Verify all six gates yourself against files on disk before
   reporting the film finished. A claim of done is a claim, not a fact.

Report: what the film is, its runtime, where the master and citations are, what
you verified and how, and anything degraded.
