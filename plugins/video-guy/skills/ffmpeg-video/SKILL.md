---
name: ffmpeg-video
description: Use when encoding, probing, concatenating, mixing or measuring video and audio with FFmpeg — delivery encodes, loudness measurement, black and freeze detection, frame extraction, and diagnosing a bad output file. Triggers include "ffmpeg", "ffprobe", "encode this", "check the audio levels", "extract frames", and any technical verification of a rendered file.
version: 1.0.0
---

# FFmpeg

## Probe first, always

```bash
ffprobe -v error -show_entries format=duration,bit_rate:stream=index,codec_type,codec_name,width,height,r_frame_rate,pix_fmt,sample_rate,channels \
  -of default=noprint_wrappers=1 out/<slug>/<slug>.mp4
```

Assert: 16:9 at 1920×1080 or 3840×2160, the declared frame rate, `yuv420p`,
h264 High or hevc, AAC ≥192k stereo at 48 kHz, and duration within a second of
`timing.durationSec`.

## Delivery encode

```bash
ffmpeg -i in.mov \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -profile:v high -level 4.1 \
  -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -movflags +faststart out.mp4
```

`yuv420p` is not optional — other pixel formats fail to play on a lot of
hardware. `+faststart` moves the index to the front so the file streams.

## Audio

```bash
# integrated loudness and true peak
ffmpeg -i in.mp4 -af ebur128=peak=true -f null - 2>&1 | tail -20

# normalise to -14 LUFS, two-pass (measure, then apply the measured values)
ffmpeg -i in.mp4 -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - 2>&1 | tail -14
ffmpeg -i in.mp4 -af loudnorm=I=-14:TP=-1:LRA=11:measured_I=..:measured_TP=..:measured_LRA=..:measured_thresh=..:linear=true \
  -c:v copy out.mp4

# mix narration with a ducked music bed
ffmpeg -i narration.wav -i music.wav \
  -filter_complex "[1:a][0:a]sidechaincompress=threshold=0.05:ratio=8:attack=200:release=600[duck];[0:a][duck]amix=inputs=2:normalize=0[a]" \
  -map "[a]" mix.wav
```

Single-pass `loudnorm` is dynamic and will not hit the target. Two passes.

## QC helpers

```bash
ffmpeg -i in.mp4 -vf "blackdetect=d=0.4:pix_th=0.10" -an -f null - 2>&1 | grep blackdetect
ffmpeg -i in.mp4 -vf freezedetect=n=-60dB:d=2 -map 0:v -f null - 2>&1 | grep freeze
ffmpeg -i in.mp4 -af astats=metadata=1 -f null - 2>&1 | grep -iE "peak level|clipped"
ffmpeg -i in.mp4 -vf fps=1/30 -q:v 2 qc/frames/f_%03d.jpg      # a frame every 30 s
ffmpeg -ss 00:04:12 -i in.mp4 -frames:v 1 -q:v 2 qc/at-4-12.jpg # one exact moment
```

## Rules

- **Never re-encode when you can copy.** `-c copy` for trims and remuxes;
  generational loss is real and cumulative.
- **Concatenate identical formats only.** The concat demuxer with a file list,
  not the filter, unless the inputs genuinely differ.
- **Burned captions are a separate render.** Never modify the master to add
  them.
- **Check the exit code and read stderr.** FFmpeg writes a file on partial
  success; a non-zero exit with an output present is a corrupt deliverable.
