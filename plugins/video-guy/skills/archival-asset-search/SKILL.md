---
name: archival-asset-search
description: Use when finding real historical material — photographs, film, newspapers, maps, documents — in public-domain and institutional collections, and when verifying that an image is actually what its caption says. Triggers include "find archival photos", "is there footage of", "public domain images of", "search the Library of Congress", and sourcing the archival shots in a storyboard.
version: 1.0.0
---

# Archival asset search

## Where to look, in order

| Collection | Good for |
| --- | --- |
| Library of Congress (loc.gov) | US photographs, Chronicling America newspapers, maps |
| US National Archives (catalog.archives.gov) | government records, military, film |
| Trove (trove.nla.gov.au) | Australian newspapers — outstanding for 20th-century AU topics |
| Wikimedia Commons | wide, but always follow through to the original institution |
| Internet Archive | books, ephemera, film |
| National/state archives | of the country and its regions |
| Museum collection portals | objects, often the only source |
| University digital collections | papers, finding aids, local history |
| David Rumsey / national surveys | historical maps |
| Europeana, IWM, Bundesarchiv, LAC | European and Commonwealth material |

The dossier's "imagery leads" section was written for this. Start there.

## Search technique

- Search the **institution's** catalogue, not a general web search that happens
  to surface it. You need the record, not the picture.
- Use period vocabulary: "aeroplane", "motor lorry", the contemporary place name.
- Search adjacent subjects: the building, the ship, the company, the street.
- Search the photographer or the collection when you find one good image — the
  rest of the shoot is usually there.
- Newspapers give you headlines as artefacts and dates you can trust to the day.

## Verify the picture, not the caption

Aggregator captions are wrong constantly, and a misattributed photograph is a
factual error narration cannot fix.

- **Date fit**: clothing, vehicles, uniforms, signage, building state,
  photographic process.
- **Place fit**: terrain, architecture, vegetation, language on signs.
- **Is it the famous wrong photo?** Many events have a canonical image that
  turns out to be a film still, a different event, or a later reconstruction. An
  image that is everywhere deserves *more* suspicion.
- **Reconstruction or reenactment?** Common in early-20th-century press. If so
  it is `authenticity: "recreation"`, whatever the archive calls it.
- **Altered?** Historical propaganda photos were routinely retouched.

Failing any of these means not using it. Uncertain means flagging it for the
fact-checker.

## Resolution

Take the highest resolution offered. A 480-pixel thumbnail will not survive a
1080p frame with a parallax push on it, and upscaling shows.

## Record everything

Institution (not the aggregator), catalogue identifier, creator, date, rights
status checked on the institution's own page, the required attribution line, the
URL fetched, and when. Then catalogue it through
`plugins/video-guy/scripts/production.mjs asset`.
