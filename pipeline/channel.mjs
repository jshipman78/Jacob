// Channel identity.
//
// This is the one file to edit to point the pipeline at a different channel.
// Everything here is *editorial* — who is talking, what they believe, how they
// sign off. The craft rules that make the narration sound like this channel
// live in pipeline/prompts/house-style.mjs; the two are kept apart so you can
// change the channel's name and premise without disturbing its prose.

export const CHANNEL = {
  name: 'this channel',

  /**
   * The through-line every video eventually lands on. The outro calls back to
   * it explicitly — see the Troy script's closing section, which is titled
   * with it. Keep it to one sentence a narrator can say out loud.
   */
  theme:
    'Almost every great historical story has a real event buried somewhere underneath layers ' +
    'of exaggeration, myth, and people rewriting the record to make themselves look better.',

  /** The short form of the theme, used as the closing section's title. */
  themeTitle: 'EVERY LEGEND HAS A LAYER OF TRUTH',

  /**
   * The channel's stated commitment, which is also this pipeline's reason to
   * exist. The fact-check stage enforces it; the script stage is told about it
   * so the prose *sounds* like it is being careful, rather than merely being
   * careful behind the scenes.
   */
  promise:
    'We say plainly what is established, what historians still argue about, and what is simply a ' +
    'story people repeat. Uncertainty is part of the telling, not something hidden from the viewer.',

  /** Closing lines. Kept verbatim so the channel ends the same way every time. */
  signoff: ['Thanks for watching.', 'I’ll see you in the next one.'],

  /**
   * Optional plug for a previous video, spoken just before the sign-off. Set to
   * null to omit it. `{topic}` is substituted with the current video's topic.
   */
  previousVideoPlug: null,

  /** Narration voice, from scripts/voices.mjs. */
  voice: 'Voice1',
};

/** Default runtime, in minutes, when the CLI is not told otherwise. */
export const DEFAULT_MINUTES = 14;

/**
 * Measured from the Troy script: 1,984 words rendered to 831.8 seconds of
 * narration including every pause. Used to convert a target runtime into a
 * word budget the writer can actually hit.
 *
 * The figure is Voice1's, which is the one that matters — `CHANNEL.voice`
 * above is what the pipeline narrates with, so that is what the budget has to
 * be calibrated against. The same script in Voice2 runs 822.3 seconds, or
 * about 145 wpm; re-measure this constant if the channel voice ever changes,
 * because a 2 wpm error is roughly twenty words across a fourteen-minute film.
 */
export const WORDS_PER_MINUTE = 143;
