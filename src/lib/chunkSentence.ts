import {
  SUBTITLE_TARGET_WORDS_PER_CHUNK,
  SUBTITLE_MAX_WORDS_PER_CHUNK,
} from '../constants';

export type SubtitleChunk = {
  text: string;
  start: number;
  end: number;
};

/**
 * Splits a sentence into readable subtitle chunks of roughly
 * SUBTITLE_MIN..MAX words each, and distributes the sentence's [start, end]
 * window across those chunks proportionally to each chunk's word count so
 * pacing feels natural (a longer chunk gets more screen time).
 *
 * Short sentences (<= SUBTITLE_MAX_WORDS_PER_CHUNK words) come back as a
 * single chunk spanning the whole sentence.
 */
export function chunkSentence(
  text: string,
  start: number,
  end: number
): SubtitleChunk[] {
  const words = text.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return [{ text, start, end }];
  }

  if (words.length <= SUBTITLE_MAX_WORDS_PER_CHUNK) {
    return [{ text: words.join(' '), start, end }];
  }

  const numChunks = Math.ceil(words.length / SUBTITLE_TARGET_WORDS_PER_CHUNK);
  const base = Math.floor(words.length / numChunks);
  const remainder = words.length % numChunks;

  const wordGroups: string[][] = [];
  let cursor = 0;
  for (let i = 0; i < numChunks; i++) {
    // Distribute the remainder one extra word at a time to the first chunks
    // so no group is starved down to a tiny tail chunk.
    const size = base + (i < remainder ? 1 : 0);
    wordGroups.push(words.slice(cursor, cursor + size));
    cursor += size;
  }

  const totalWords = words.length;
  const duration = end - start;
  let elapsed = 0;

  return wordGroups.map((group) => {
    const share = group.length / totalWords;
    const chunkStart = start + elapsed;
    const chunkDuration = duration * share;
    elapsed += chunkDuration;
    return {
      text: group.join(' '),
      start: chunkStart,
      end: chunkStart + chunkDuration,
    };
  });
}
