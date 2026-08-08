---
name: documentary-motion-graphics
description: Use when building the graphic layer of a documentary — titles, lower thirds, date stamps, animated timelines, statistics, quotations, newspaper treatments and kinetic typography. Triggers include "add a lower third", "animate this timeline", "on-screen text", "title card", "show the quote", and any shot with visualType TYPOGRAPHY, TIMELINE, DATA_VIZ or TITLE_CARD.
version: 1.0.0
---

# Documentary motion graphics

For a history channel this layer matters more than AI video. It is cheap,
deterministic, re-renders identically, and it is most of what makes a film look
made rather than assembled.

## The vocabulary

| Element | Job | Duration |
| --- | --- | --- |
| Title card | Name the film, set the tone | 2–4 s |
| Section title | Mark a beat; give the viewer a breath | 1.5–2.5 s |
| Lower third | Who or where, on first appearance only | 3–4 s |
| Date stamp | Anchor a moment in time | 2–3 s |
| Timeline | Show *when*, especially when the gap is the point | 6–12 s |
| Statistic | One number, big, held | 3–5 s |
| Quotation | Verbatim words, with attribution | Reading time × 1.5 |
| Newspaper | Headline as artefact | 4–6 s |
| Diagram | How a thing worked or failed | 8–15 s |

## Rules

**Type is the film's voice.** One display face, one text face, for the whole
film and ideally the whole channel. This repo ships Cinzel and Inter.

**Animate in, hold, animate out — and the hold is the longest part.** Motion
that never settles cannot be read. Entrances 0.3–0.5 s, exits 0.2–0.3 s.

**One idea per graphic.** A lower third with a name, a role, dates and a location
is four graphics fighting.

**Reading time is a measurement.** ~200 words per minute silently, and the
viewer is also listening. A quotation needs 1.5× its reading time on screen.

**Never make the viewer read what they are hearing**, word for word. On-screen
text should carry what the narration cannot: the spelling of a name, a figure,
the exact wording of a document.

**Kinetic typography is punctuation.** One or two per film, on the line the
whole thing turns on. Constant kinetic type is a lyric video.

**Safe areas**: nothing within 5% of the edge; keep the lower third of frame
clear when captions are burned in.

## Timelines

The strongest timeline shows an interval that surprises. Draw the axis, place
the marks, then emphasise the gap the narration is arguing about — the
`timeline` scene kind takes `span`, `marks` and `emphasizeGap` exactly for this.
Animate left to right at reading pace; hold the finished state long enough to be
read as a whole.

## Newspapers

Use real scans from the archivist. Push in on the headline, hold, then reveal
the sub-head. Never generate a newspaper — generated text is gibberish and a
fabricated headline is a fabricated source.

## In this repo

Build these as Remotion scenes in `src/scenes/`, styled per the run's style id,
resolved through `timing.style`. Deterministic components mean a re-render is
identical, which is what makes fixing one graphic cheap.
