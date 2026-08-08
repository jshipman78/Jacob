---
name: asset-rights-tracking
description: Use when establishing and recording whether material can be used and how it must be credited — public-domain status, licence terms, attribution lines, and telling authentic archival material apart from AI recreations in the manifest. Triggers include "can we use this image", "what's the licence", "attribution", "rights clearance", and pre-delivery checks on assets.
version: 1.0.0
---

# Asset rights tracking

Two jobs, and the second is the one systems forget:

1. Can the film use this?
2. Can anyone tell, afterwards, what it is and where it came from?

## Status values

`public-domain` `cc0` `cc-by` `cc-by-sa` `licensed` `fair-use` `generated`
`unknown`

`unknown` at delivery is a blocking defect. Not a note.

## Public domain is jurisdictional

There is no global public domain. Record the **basis**, not just the label:

- US works published before 1930; US federal government works.
- Life of author + 70 years in most of Europe; +50 in some jurisdictions.
- Crown copyright expiry, which differs by country and by record type.
- A photograph of a public-domain painting is usually not a new copyright; a
  creative photograph of a public-domain sculpture may be.

"Wikimedia says public domain" is a lead, not a clearance. Follow to the
institution's own statement.

## Attribution

Copy the required credit line **verbatim** into `rights.attribution`. Where the
licence requires on-screen credit, it goes on screen; otherwise in the
description. CC-BY-SA imposes obligations on the finished work — know before
using it, not after.

## Authenticity is a separate axis from rights

| | |
| --- | --- |
| `authentic` | a real historical artefact |
| `recreation` | AI or illustration depicting a real event, person or place |
| `synthetic` | invented atmosphere |
| `diagram` | information design — maps, timelines, charts |

Rights answers "may we"; authenticity answers "is it real". A generated image is
`rights.status: "generated"` and `authenticity: "recreation"`, and it must never
be catalogued with an archival `kind`. `production.mjs check` fails the
production when it is.

## Record at acquisition

Not later. The moment an asset lands:

```bash
node plugins/video-guy/scripts/production.mjs asset <id> --json='{ "id": "...", "kind": "...",
  "authenticity": "...", "path": "...",
  "provenance": { "sourceName": "...", "sourceUrl": "...", "identifier": "...",
                  "creator": "...", "date": "...", "retrievedAt": "..." },
  "rights": { "status": "...", "attribution": "...", "licenseUrl": "...",
              "verifiedAt": "...", "notes": "basis for the status" } }'
```

Reconstructing provenance a week later is unreliable and it is how uncredited
material ships.

## Pre-delivery audit

Every asset used: cleared status, attribution present where required, generated
material disclosed in the description, and nothing in `assets[]` that the
storyboard does not use (and nothing the storyboard uses that is not in
`assets[]`).
