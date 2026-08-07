// The house style: reusable structure and craft guidance, derived by reading
// the finished Troy script closely rather than by describing it loosely.
//
// This is the most load-bearing file in the pipeline. A thin prompt ("write a
// documentary script in an engaging style") produces a Wikipedia summary read
// aloud. What the Troy script actually does is specific and copyable, so it is
// encoded here as three separate things:
//
//   1. STRUCTURE — the beat sheet, and a budget calculator that turns a target
//      runtime into per-section sentence and word counts.
//   2. CRAFT     — the prose rules, stated as things to do and things never to
//      do, with the reasoning attached so the model can generalise them.
//   3. EXEMPLARS — annotated passages from the Troy script. Showing the model
//      the real thing beats any amount of description.

import { CHANNEL, WORDS_PER_MINUTE } from '../channel.mjs';

// ---------------------------------------------------------------------------
// 1. Structure
// ---------------------------------------------------------------------------

/**
 * The beat sheet. Every video walks these beats in order; only `evidence` and
 * `complication` repeat, and only when the runtime affords it.
 *
 * `share` is the fraction of the total word budget the beat gets, before
 * normalisation. Taken from the Troy script's actual distribution.
 */
export const BEATS = [
  {
    id: 'cold-open',
    share: 0.09,
    title: 'The film’s own title, in caps.',
    job:
      'Open on one concrete, specific, slightly outrageous fact — an image the viewer can see. ' +
      'Then reverse it. Then name the subject. Then ask the question the film will answer. ' +
      'Never open with context, a date range, or "In order to understand X, we must first…".',
  },
  {
    id: 'setup',
    share: 0.15,
    title: 'A short noun phrase in caps — the idea, not the chapter number.',
    job:
      'Establish who and where, but only the parts the argument later needs. ' +
      'Plant at least one detail the film will come back and complicate.',
  },
  {
    id: 'turn',
    share: 0.18,
    title: 'Caps.',
    job:
      'The thing actually happens. This is the section with the most forward motion; keep the ' +
      'narrator out of the way and let events run.',
  },
  {
    id: 'evidence',
    share: 0.2,
    title: 'Caps.',
    job:
      'What the record actually shows, set against what people believe. This is where numbers, ' +
      'dates and named individuals earn their place, and where disagreement between historians ' +
      'is stated openly rather than smoothed over.',
  },
  {
    id: 'complication',
    share: 0.18,
    title: 'Caps — ideally a phrase that contains a tension, like "BEING WRONG AND STILL BEING RIGHT".',
    job:
      'Refuse the easy verdict. Give the strongest version of the opposing reading, then say what ' +
      'survives it. The film must be more interesting after this section than before it.',
  },
  {
    id: 'verdict',
    share: 0.12,
    title: 'Caps.',
    job:
      'Land the thesis. Not a summary of the video — the argument the video was making all along, ' +
      'now stated flatly because it has been earned.',
  },
  {
    id: 'outro',
    share: 0.08,
    title: 'The channel’s theme, in caps.',
    job:
      'Call back to the channel’s theme explicitly, connect this specific story to it, then sign off. ' +
      'Short. Do not re-litigate anything.',
  },
];

/**
 * Turns a target runtime into a concrete budget per beat.
 * Calibrated against the finished Troy video (1,984 words → 13:52 of narration).
 */
export function budgetFor(minutes) {
  const totalWords = Math.round(minutes * WORDS_PER_MINUTE);
  // Longer films get an extra evidence and an extra complication beat.
  const beats = minutes >= 11 ? [...BEATS.slice(0, 5), BEATS[3], ...BEATS.slice(5)] : BEATS;
  const totalShare = beats.reduce((n, b) => n + b.share, 0);
  const sections = beats.map((b, i) => {
    const words = Math.round((b.share / totalShare) * totalWords);
    return {
      order: i,
      beat: b.id,
      titleGuidance: b.title,
      job: b.job,
      wordBudget: words,
      // The Troy script averages 22.8 words per sentence across 87 sentences.
      sentenceTarget: Math.max(3, Math.round(words / 22)),
      // Roughly one shot per 27 seconds of narration, i.e. per ~65 words.
      shotTarget: Math.max(2, Math.round(words / 65)),
    };
  });
  return { minutes, totalWords, sections, totalSentences: sections.reduce((n, s) => n + s.sentenceTarget, 0) };
}

// ---------------------------------------------------------------------------
// 2. Craft
// ---------------------------------------------------------------------------

export const CRAFT = `
RHYTHM — this is what makes it sound like narration rather than an article.
  Vary sentence length hard and deliberately. The pattern that recurs through
  the reference script is: one long accumulating sentence, then another, then
  two or three very short declaratives, then a long one with an em-dash aside.
  The short ones are the point. They land because of what surrounds them.
    "His name was Heinrich Schliemann. He wasn't an archaeologist. He wasn't a
     historian. He was a retired businessman with a childhood obsession, a small
     fortune, and — as it turns out — a serious problem with the truth."
  At least four sentences in the film must be under six words. At least four
  must be over forty. Never write three medium-length sentences in a row.

ARGUMENT, NOT LIST. The film has a thesis and spends its runtime proving it.
  Every section must move that argument, not merely add facts in date order. If
  a paragraph could be deleted without weakening the argument, delete it. The
  reference script is not "the story of Schliemann"; it is the claim that
  Schliemann is a case study in how history gets shaped by whoever tells it,
  and every section is evidence for that claim.

ONE IDEA PER PARAGRAPH. A paragraph is a shot. When the idea changes, the
  paragraph ends and the picture changes with it.

CONCRETE OVER ABSTRACT. "Smuggled a king's ransom in gold out of the country in
  his wife's shawl" — not "removed artefacts without authorisation". Name the
  object, the number, the place. Abstraction is where scripts go to die.

EPISTEMIC HONESTY IS PART OF THE VOICE, not a disclaimer bolted on. The
  reference script says "generally placed around", "if it happened at all",
  "may itself be part myth", "records simply don't support", "only in recent
  decades have historians". Hedges are placed *inside* the sentence, in the
  narrator's own voice, and they make the film sound more authoritative rather
  than less. Never write "some say" or "it is believed" — say who, and on what
  basis. Never assert a contested figure flatly.

DIRECT ADDRESS, USED SPARINGLY. Two or three times in a film, the narrator
  turns to the viewer: "It's worth sitting with that for a second, because…",
  "That alone tells you something about how this story tends to get told." Any
  more than that and it becomes a tic.

RHETORICAL QUESTIONS ONLY IN THE COLD OPEN AND THE VERDICT. They set stakes at
  the top and sharpen the argument at the end. In the middle of the film they
  read as padding.

THE NARRATOR HAS A POSITION but arrives at it through evidence and says so.
  They are allowed to find something impressive, or infuriating, or sad. They
  are not allowed to be snide, and they never sneer at people in the past for
  not knowing what we know.

WORDS AND CONSTRUCTIONS THAT ARE BANNED OUTRIGHT
  - "Little did they know", "the rest is history", "stood the test of time"
  - "In this video we will", "let's dive in", "buckle up", "picture this"
  - "arguably", "quite literally", "needless to say", "it goes without saying"
  - "a testament to", "a stark reminder", "forever changed the course of"
  - Opening a sentence with "Interestingly," or "Ironically,"
  - Em-dash asides more than twice in any one paragraph
  - Any sentence whose only content is announcing what comes next

FIRST WORDS MATTER. No two consecutive sentences may begin with the same word,
  and "And" / "But" / "So" openings must total fewer than one in six sentences.
`.trim();

// ---------------------------------------------------------------------------
// 3. Exemplars
// ---------------------------------------------------------------------------

export const EXEMPLARS = `
COLD OPEN — one enormous accumulating sentence of pure specifics, then a short
reversal that reframes everything, then staccato identification, then a long
sentence with the sting in an em-dash aside:

  "In 1873, a man dug a massive trench straight through the middle of one of the
   most important archaeological sites on Earth, blew past nine separate layers
   of ancient history without properly recording most of them, smuggled a king's
   ransom in gold out of the country in his wife's shawl, and then lied about
   almost every part of the story."
  [pause for effect]
  "And he's still, to this day, credited as the man who proved Troy was real."
  [pause]
  "His name was Heinrich Schliemann."
  "He wasn't an archaeologist."
  "He wasn't a historian."
  "He was a retired businessman with a childhood obsession, a small fortune,
   and — as it turns out — a serious problem with the truth."

Note what the opening does NOT do: no date range, no "the ancient world was a
place of", no throat-clearing. It starts mid-outrage.

HANDLING A CLAIM THE SOURCES DO NOT SUPPORT — stated as a story first, enjoyed
for a beat, then dismantled with evidence, then generalised into the argument:

  "It's a great story. Ambitious kid, impossible dream, decades of determination."
  "There's just one issue historians keep running into with Heinrich Schliemann:
   he told a lot of great stories about himself."
  "And a disturbing number of them fall apart under scrutiny."
  "…So even the origin story — the entire reason we're told he became obsessed
   with Troy in the first place — may itself be part myth."

DIRECT ADDRESS THAT EARNS ITS PLACE — used to mark a pattern, not to fill time:

  "It's worth sitting with that for a second, because it's going to become a
   pattern with Schliemann: someone else does the careful, foundational work,
   and Schliemann ends up with the credit, the fame, and the version of the
   story that gets remembered."

GIVING CREDIT WHERE THE POPULAR VERSION DOES NOT — short sentences doing the
work of a paragraph:

  "But Calvert didn't have Schliemann's money."
  "Schliemann did."
  "And when the two men joined forces, it was Schliemann's name, not Calvert's,
   that history remembered."

OUTRO — theme first, then this specific story folded into it, then the sign-off:

  "If there's a theme connecting this channel, it's this: almost every great
   historical story has a real event buried somewhere underneath layers of
   exaggeration, myth, and people rewriting the record to make themselves look
   better."
  "Heinrich Schliemann didn't just find a lost city."
  "He became a perfect case study in how history gets shaped by the people who
   tell it — for better and for worse."
  "Thanks for watching."
  "I'll see you in the next one."
`.trim();

// ---------------------------------------------------------------------------
// Delivery mechanics
// ---------------------------------------------------------------------------

export const DELIVERY = `
PAUSES. Each paragraph declares a "pauseAfter" key, which becomes real silence
in the narration audio:
  "sentence"   0.35s  — the default gap between sentences; rarely used on a paragraph
  "paragraph"  0.70s  — ordinary paragraph break
  "beat"       0.90s  — a deliberate breath, after a reveal or a hard turn
  "effect"     1.10s  — after the line the section is built around. Use 2–4 per film
  "section"    1.40s  — MUST be the pauseAfter of the last paragraph of every
                        section except the final one, which uses "paragraph"

PRONUNCIATION OVERRIDES. Each sentence may carry a "tts" field. The subtitles
always show "text"; the narrator always says "tts". Supply it ONLY when the
written form would be misread, and change nothing else about the sentence:
  1873            -> "eighteen seventy-three"
  146 BC          -> "one forty-six B C"
  mid-1800s       -> "mid eighteen hundreds"
  Troy VIIa       -> "Troy seven-a"
  c. 2400 BCE     -> "around twenty-four hundred B C E"
  3rd             -> "third"
  %               -> "percent"
  Scipio Aemilianus -> leave alone; the engine handles Latin names well
Never rewrite a sentence in the "tts" field for style. If nothing needs
respelling, omit the field entirely. The reference script has 15 overrides
across 87 sentences — roughly one in six.

SUBTITLES. The "text" field is what appears on screen, so it must be correctly
punctuated prose with real apostrophes and em-dashes. Sentences longer than
about 45 words are chunked automatically at clause boundaries, so long
sentences are fine; unpunctuated ones are not.
`.trim();

/** The system prompt shared by the outline and script stages. */
export function writerSystemPrompt() {
  return [
    'You are the head writer for a long-form history documentary channel.',
    '',
    `The channel's through-line: ${CHANNEL.theme}`,
    `The channel's promise to viewers: ${CHANNEL.promise}`,
    '',
    'You write narration that is spoken aloud, not read. You have a strong, specific',
    'voice and you never pad. You are rigorous about what is known versus what is',
    'merely repeated, and you make that rigour part of the entertainment rather than',
    'a disclaimer. You return only the structured output you are asked for.',
  ].join('\n');
}
