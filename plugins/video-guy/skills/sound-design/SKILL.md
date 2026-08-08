---
name: sound-design
description: Use when designing the audio bed under narration — music cues, ambience, effects, ducking, silence, and loudness mastering for delivery. Triggers include "add music", "the music is too loud", "sound effects", "audio mix", "ducking", "LUFS", and any pass over a documentary's audio that is not the narration itself.
version: 1.0.0
---

# Sound design

Narration is the priority at all times. Everything else supports it.

## Levels

| | |
| --- | --- |
| Narration | −16 LUFS integrated, true peak ≤ −1 dBTP, never clipping |
| Music under speech | 18–22 LU below narration |
| Music between sections | up to 10–12 LU below |
| Effects | peaks below narration; never a surprise |
| Final master | −14 LUFS integrated, true peak ≤ −1 dBTP |

Measure, do not judge by ear alone:

```bash
ffmpeg -i out/<slug>/<slug>.mp4 -af ebur128=peak=true -f null - 2>&1 | tail -20
```

## Ducking

Sidechain the music to the narration: ~200 ms attack, ~600 ms release,
6–10 dB of reduction. A hard gate sounds like a mistake; a slow duck sounds like
a mix. Release long enough that music does not pump between sentences.

## The cue sheet

Write cues before placing audio: start, end, track, intent, level.

```
0:00–0:32   bed-tension-low     cold open, under; out on the reveal
0:32–1:28   —                   silence. the question is doing the work
1:28–3:40   bed-procedural      setup and world, low
...
```

Music should change at story beats, not on a timer. A cue that runs across the
turn tells the viewer nothing changed.

## Silence

The most underused tool available. A full second before the film's most
important sentence does more than any stinger. Silence after a number lets it
land. Never fill every second — wall-to-wall music is what makes videos feel
machine-made.

## Ambience

One bed per location, low, and let it change when the place changes. Ambience
is how a still photograph becomes a place. Period-plausible: no diesel engines
in 1890, no jet noise before 1950.

## Effects

Punctuation, not decoration. One good hit at the turn beats a wash of atmosphere
under everything. Match to the picture: a shutter on a photograph, a page turn
on a document, a low hit on a title card. Never comedy effects in a film about
people dying.

## Mastering

Consistent loudness across the channel matters more than any single mix. Master
every film to the same target. Check mono compatibility — a lot of viewing is on
a phone speaker, where a phase-cancelling stereo bed disappears and narration
does not.
