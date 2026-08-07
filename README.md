# The Man Who Lied His Way to Troy

A ~15 minute documentary video about Heinrich Schliemann and the excavation of
Troy, built with [Remotion](https://remotion.dev). Narration is synthesized with
an open-weight TTS model, subtitles are generated from the same timing data that
drives the edit, and each shot is illustrated with a generated image.

```
scripts/script-data.mjs    narration script + per-shot art direction (source of truth)
scripts/tts.mjs            synthesizes narration.wav + timing.json
scripts/gen-images.mjs     generates the 29 shot images (Fal.ai or Gemini)
scripts/make-placeholders.mjs  generates stand-in art so the video renders without a key
src/                       the Remotion composition
public/audio/narration.wav the narration track            (generated)
public/timing.json         sentence/section/shot timeline (generated)
public/images/<id>.jpg     one image per shot             (generated)
```

## Build it

```bash
npm install
npm run tts        # narration + timing manifest
npm run images     # shot artwork (needs a provider key, see below)
npm run render     # -> out/troy-video.mp4
npm run dev        # Remotion Studio, for previewing and tweaking
```

`script-data.mjs` is the single source of truth. Every sentence carries the text
shown on screen, and where a written form would be mispronounced ("1873",
"Troy VIIa", "2400 BCE") it also carries a spoken variant. The subtitles always
show the written form; the narrator always speaks the spoken one.

`timing.json` is what couples the three pipelines together. It records the real
measured start and end of every spoken sentence, so the subtitles, the section
title cards, and the image cuts are all driven by the actual audio rather than
by estimates. Regenerating the narration automatically re-times the whole edit.

## Supplying the Fal key

You never need to paste a key into chat. Three options, best first:

1. **Environment secret (recommended).** Add `FAL_KEY` to this Claude Code
   environment's configured environment variables. It is then present in every
   future session, and no key ever touches the repo or the transcript. See
   https://code.claude.com/docs/en/claude-code-on-the-web for where environment
   variables are configured.
2. **A local `.env` file.** `cp .env.example .env` and fill in `FAL_KEY`.
   `.env` is gitignored. `gen-images.mjs` parses it directly — no dotenv
   dependency. This is the right choice when running the pipeline on your own
   machine.
3. **Shell environment for one run:** `FAL_KEY=... npm run images`.

The generator never logs the key, and `.env` / `.env.local` are gitignored.

## Network policy note

This project's image step calls `queue.fal.run`. If you are running inside a
Claude Code web environment, its egress policy must permit that host —
otherwise the request is refused at the proxy before it reaches Fal, and no
amount of key configuration will help. `gen-images.mjs` preflights the host and
tells you plainly if it is blocked. The same applies to
`generativelanguage.googleapis.com` if you use the Gemini provider instead.

Until a provider is reachable, `npm run placeholders` generates atmospheric
stand-in art for all 29 shots so the full video still renders end to end.

## Cost

`gen-images.mjs` estimates spend before it starts, refuses to exceed a $2
ceiling, and prints a running total. Use `--dry-run` to see the prompts and the
projected cost without spending anything, and `--only=<id>,<id>` to re-roll
individual shots.
