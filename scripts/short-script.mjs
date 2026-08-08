// Script for the 30-second vertical short about this repository.
//
// One entry per spoken line. The line is the editing unit: it owns a scene,
// a caption, and the pause that follows it. `tts` overrides what the narrator
// says where the written form would be mispronounced — same convention as
// scripts/script-data.mjs.
//
//   text        what the caption shows
//   tts         what the narrator says (defaults to text)
//   scene       which scene in src/short/scenes renders under it
//   emphasis    words the caption should hit hard (matched case-insensitively,
//               punctuation-stripped)
//   gapWeight   relative share of the leftover time given to the pause after
//               this line, so the whole thing lands on exactly 30.000s
//
// Total spoken length is deliberately under budget: the slack becomes breath
// between lines, which is what makes a short feel confident rather than
// rushed.

// The short's narrator. The film keeps Voice1; the short is a different room
// and gets a different reader. Override for one run with `--voice=<Name>`.
export const VOICE_NAME = 'Voice2';

export const TOTAL_SEC = 30;
export const LEAD_IN_SEC = 0.35;
export const MIN_TAIL_SEC = 0.9;
export const MIN_GAP_SEC = 0.14;
export const MAX_GAP_SEC = 1.1;

export const LINES = [
  {
    id: 'hook',
    scene: 'hook',
    text: 'I built a machine that makes documentaries.',
    emphasis: ['machine', 'documentaries'],
    gapWeight: 1.4,
  },
  {
    id: 'command',
    scene: 'command',
    text: 'One topic in. A finished film out.',
    emphasis: ['One', 'film'],
    gapWeight: 1.2,
  },
  {
    id: 'research',
    scene: 'research',
    text: "It researches live. If it can't reach the web, it refuses to write.",
    tts: "It researches live. If it can't reach the web, it refuses to write.",
    emphasis: ['live', 'refuses'],
    gapWeight: 1.1,
  },
  {
    id: 'claims',
    scene: 'claims',
    text: 'Every claim is attacked by a fact-checker paid to kill it.',
    tts: 'Every claim is attacked by a fact checker paid to kill it.',
    emphasis: ['attacked', 'kill'],
    gapWeight: 1.0,
  },
  {
    id: 'verdicts',
    scene: 'verdicts',
    text: 'Unproven? Cut. Disputed? It says so out loud.',
    emphasis: ['Cut.', 'loud.'],
    gapWeight: 1.2,
  },
  {
    id: 'render',
    scene: 'render',
    text: 'Then it narrates, animates, and renders itself.',
    emphasis: ['renders'],
    gapWeight: 1.0,
  },
  {
    id: 'output',
    scene: 'output',
    text: 'Fourteen minutes. Cited line by line.',
    emphasis: ['Fourteen', 'Cited'],
    gapWeight: 1.5,
  },
  {
    id: 'endcard',
    scene: 'endcard',
    text: 'One command.',
    emphasis: ['One', 'command.'],
    gapWeight: 0.6,
  },
];
