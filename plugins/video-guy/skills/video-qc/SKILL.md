---
name: video-qc
description: Use when quality-checking a finished cut before delivery — historical, visual, editing, audio and technical inspection with timecodes and severities, and the commands that make defects findable. Triggers include "QC this video", "check the final cut", "is this ready to publish", "review the render", and re-checking after fixes.
version: 1.0.0
---

# Video QC

QC is performed by someone who did not make the film. A maker checking their own
work reliably finds nothing.

## Inspect artefacts, not summaries

```bash
ffprobe -v error -show_entries format=duration,bit_rate:stream=index,codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels \
  -of default=noprint_wrappers=1 out/<slug>/<slug>.mp4
ffmpeg -i out/<slug>/<slug>.mp4 -af ebur128=peak=true -f null - 2>&1 | tail -20
ffmpeg -i out/<slug>/<slug>.mp4 -vf "blackdetect=d=0.4:pix_th=0.10" -an -f null - 2>&1 | grep blackdetect
ffmpeg -i out/<slug>/<slug>.mp4 -vf freezedetect=n=-60dB:d=2 -map 0:v -f null - 2>&1 | grep freeze
ffmpeg -i out/<slug>/<slug>.mp4 -vf fps=1/30 -q:v 2 productions/<id>/qc/frames/f_%03d.jpg
```

Then **look at the frames**. Most defects below are invisible to any command.

## Checklist

**Historical** — claims not in `citations.json`; "historians believe" with one
source or none; dates, names, figures and quotations spot-checked; missing
required hedges; true narration over an image implying something else.

**Visual** — any `recreation` or `synthetic` asset presented as archival
(**blocking**); period errors in clothing, weapons, vehicles, architecture,
vegetation; wrong place or person; the same asset inside 90 seconds or more than
three times; malformed generated imagery (hands, limbs, structure, legible
text); several identically framed shots in a row; text inside the outer 5% of
frame.

**Editing** — moments with no visual; holds over 20 s under speech; shots under
1.2 s; motion fighting the narration; broken or doubled transitions; anything on
screen that is not what `storyboard.json` specifies.

**Audio** — clipping anywhere; mispronunciations with timecodes; music above
about −18 LU relative to narration under speech; dropouts at section joins.

**Technical** — 16:9; correct resolution and constant frame rate; duration
within 1 s of `timing.durationSec`; −14 LUFS ±1 and true peak ≤ −1 dBTP; 48 kHz
stereo; faststart; captions present, in sync, carrying `text` not `tts`.

**Legal** — every asset rights-cleared; required attributions present;
AI-generated material disclosed.

## Severity

| | |
| --- | --- |
| **blocking** | false or unsupported claim; a recreation shown as authentic; uncleared rights; broken file; clipping |
| **high** | misleading juxtaposition; missing hedge; visible generation artefact; loudness out of spec |
| **medium** | duplicate asset; over-long hold; secondary mispronunciation; caption drift |
| **low** | rhythm, polish, a better image exists |

## Findings must be actionable

Every finding carries a timecode or path, the evidence, the severity, and the
agent that owns the fix. "The pacing feels slow" is not a finding.
"3:40–4:55 is four consecutive 18-second holds on static stills under continuous
narration — visual-director" is.

Verdict is one of **pass**, **pass with notes** (medium and low only), or
**fail** (any open blocking or high). Never soften a fail because the film is
nearly finished.
