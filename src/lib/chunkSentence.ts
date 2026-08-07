import {
  SUBTITLE_MIN_WORDS_PER_CHUNK,
  SUBTITLE_TARGET_WORDS_PER_CHUNK,
  SUBTITLE_MAX_WORDS_PER_CHUNK,
} from '../constants';

export type SubtitleChunk = {
  text: string;
  start: number;
  end: number;
};

// Words that read badly at the end of a subtitle line, because they leave the
// viewer hanging on a phrase that hasn't arrived yet ("...a glint of").
const DANGLING_TAIL_WORDS = new Set([
  'a', 'an', 'the', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'from', 'by',
  'as', 'into', 'onto', 'upon', 'over', 'under', 'about', 'through', 'across',
  'and', 'or', 'but', 'nor', 'so', 'yet', 'than', 'that', 'which', 'who',
  'his', 'her', 'its', 'their', 'our', 'your', 'my', 'this', 'these', 'those',
  'is', 'was', 'were', 'are', 'be', 'been', 'being', 'had', 'has', 'have',
  'he', 'she', 'they', 'we', 'you', 'it', 'not', 'no', 'more', 'most', 'very',
]);

// Words that comfortably START a line — breaking just before one of these
// lands on a clause boundary.
const CLAUSE_OPENERS = new Set([
  'and', 'but', 'or', 'so', 'because', 'which', 'who', 'that', 'when', 'while',
  'after', 'before', 'though', 'although', 'since', 'until', 'unless', 'if',
  'as', 'where', 'whereas', 'then', 'yet', 'nor',
]);

const STRONG_PUNCT = /[.!?]["'”’)]?$/;
const MEDIUM_PUNCT = /[,;:—–]["'”’)]?$/;

const normalizeWord = (w: string) => w.replace(/[^\p{L}\p{N}']/gu, '').toLowerCase();

/**
 * Cost of breaking a line immediately AFTER word index `i` (so the next chunk
 * starts at `i + 1`). Lower is better. Punctuation is the strongest signal
 * that a phrase has closed; a dangling function word is the strongest signal
 * that it hasn't.
 */
function breakCost(words: string[], i: number): number {
  const prev = words[i];
  const next = words[i + 1];
  if (next === undefined) return 0; // end of sentence, always a clean break

  let cost: number;
  if (STRONG_PUNCT.test(prev)) cost = 0;
  else if (MEDIUM_PUNCT.test(prev)) cost = 0.6;
  else if (CLAUSE_OPENERS.has(normalizeWord(next))) cost = 1.2;
  else cost = 3;

  if (DANGLING_TAIL_WORDS.has(normalizeWord(prev))) cost += 5;
  return cost;
}

// How much a chunk being off the target length matters, relative to the
// break-quality costs above. Tuned so a genuinely good clause boundary can
// pull a chunk a few words away from target, but not to either extreme.
const LENGTH_WEIGHT = 0.5;

function lengthCost(len: number): number {
  const deviation = (len - SUBTITLE_TARGET_WORDS_PER_CHUNK) / SUBTITLE_TARGET_WORDS_PER_CHUNK;
  return LENGTH_WEIGHT * deviation * deviation * 10;
}

/**
 * Splits a sentence into readable subtitle chunks and distributes the
 * sentence's [start, end] window across them proportionally to word count, so
 * a longer chunk gets more screen time.
 *
 * Break points are chosen by dynamic programming over the whole sentence
 * rather than greedily, minimizing the combined cost of awkward break
 * positions and off-target chunk lengths. Breaking purely on word count
 * routinely severed phrases mid-thought ("...he had personally spotted a
 * glint of"); scoring punctuation and clause openers against dangling
 * function words keeps lines landing where the sentence actually breathes.
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

  if (words.length === 0) return [{ text, start, end }];
  if (words.length <= SUBTITLE_MAX_WORDS_PER_CHUNK) {
    return [{ text: words.join(' '), start, end }];
  }

  const n = words.length;
  // best[i] = cheapest way to chunk words[i..n-1]; from[i] = chosen chunk end.
  const best = new Array<number>(n + 1).fill(Infinity);
  const from = new Array<number>(n + 1).fill(-1);
  best[n] = 0;

  for (let i = n - 1; i >= 0; i--) {
    const remaining = n - i;
    for (let len = SUBTITLE_MIN_WORDS_PER_CHUNK; len <= SUBTITLE_MAX_WORDS_PER_CHUNK; len++) {
      if (len > remaining) break;
      const j = i + len; // chunk is words[i..j-1]
      // Never leave a runt final chunk: if the remainder can't itself form a
      // valid chunk, this split is invalid.
      const leftover = n - j;
      if (leftover > 0 && leftover < SUBTITLE_MIN_WORDS_PER_CHUNK) continue;
      if (best[j] === Infinity) continue;

      const cost = lengthCost(len) + breakCost(words, j - 1) + best[j];
      if (cost < best[i]) {
        best[i] = cost;
        from[i] = j;
      }
    }
  }

  // Fall back to even splitting if no valid segmentation exists (possible for
  // awkward lengths just above MAX, e.g. MAX+1 words).
  const groups: string[][] = [];
  if (best[0] === Infinity) {
    const numChunks = Math.ceil(n / SUBTITLE_TARGET_WORDS_PER_CHUNK);
    const base = Math.floor(n / numChunks);
    const remainder = n % numChunks;
    let cursor = 0;
    for (let k = 0; k < numChunks; k++) {
      const size = base + (k < remainder ? 1 : 0);
      groups.push(words.slice(cursor, cursor + size));
      cursor += size;
    }
  } else {
    for (let i = 0; i < n; i = from[i]) {
      groups.push(words.slice(i, from[i]));
    }
  }

  const duration = end - start;
  let elapsed = 0;
  return groups.map((group) => {
    const chunkStart = start + elapsed;
    const chunkDuration = (duration * group.length) / n;
    elapsed += chunkDuration;
    return {
      text: group.join(' '),
      start: chunkStart,
      end: chunkStart + chunkDuration,
    };
  });
}
