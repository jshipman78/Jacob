// Named narration voices for this channel.
//
// Scripts and manifests refer to a voice by its NAME ('Voice1'), never by the
// underlying model's internal id. That keeps the channel's voice identity
// stable in the repo even if the engine or the model id changes underneath,
// and gives a place to add Voice2, Voice3 and so on as the channel grows.
//
// Selection: `node scripts/tts.mjs --voice=Voice1`, or the VOICE env var.
// Changing a voice's `model` changes the per-sentence cache key, so switching
// voices re-synthesizes rather than serving the previous voice's audio.

export const VOICES = {
  Voice1: {
    engine: 'kokoro',
    model: 'am_michael',
    speed: 1,
    lang: 'en-us',
    description:
      'The channel narrator. American English, male, deep and measured. ' +
      'Chosen over am_fenrir, am_puck and bm_george in a head-to-head ' +
      'audition for having the slowest, most deliberate delivery of the ' +
      'candidates, which suits long-form documentary narration and matches ' +
      'the American-style number expansions in the script.',
  },
  Voice2: {
    engine: 'kokoro',
    model: 'bm_george',
    speed: 1,
    lang: 'en-gb',
    description:
      'British English, male, the most deliberate of Kokoro\'s eight en-GB ' +
      'voices — measurably so: on an identical line it ran 7.25s against ' +
      '5.50s for the briskest of them. Chosen for the vertical short. Note ' +
      'the lang: en-gb is what gives the British vowels, and running a bm_ ' +
      'voice at en-us produces an accent that slips rather than a dialect.',
  },
};

export const DEFAULT_VOICE_NAME = 'Voice1';

/**
 * Resolves a voice name to its definition. Accepts the name from an explicit
 * argument, the VOICE environment variable, or falls back to the default.
 */
export function resolveVoice(name = process.env.VOICE || DEFAULT_VOICE_NAME) {
  const voice = VOICES[name];
  if (!voice) {
    const known = Object.keys(VOICES).join(', ');
    throw new Error(`Unknown voice "${name}". Known voices: ${known}`);
  }
  return { name, ...voice };
}
