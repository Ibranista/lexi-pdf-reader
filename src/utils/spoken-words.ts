/**
 * Lining up what is being *said* with what is on the *screen*.
 *
 * The two are not the same string. Narration substitutes anything nobody could
 * pronounce — "Physics_Notes_2024_final_v3.pdf" is spoken as "Physics Notes
 * final" — so the spoken word list drifts from the displayed text, and timings
 * applied by position would highlight steadily further from the voice with
 * every substitution.
 *
 * So they are matched by content rather than by count: each spoken word is
 * looked for in the words still ahead on screen, and a spoken word that isn't
 * there is skipped rather than being allowed to shift everything after it.
 */

/** A word and when it is spoken, as the server measured it. */
export interface SpokenWord {
  w: string;
  /** Seconds into the clip. */
  s: number;
  e: number;
}

/** When to light up the token at `i` in the tokens the text was split into. */
export interface WordSpan {
  i: number;
  s: number;
  e: number;
}

/**
 * How far ahead to look for a spoken word before giving up on it. Enough to
 * step over a substituted filename or a number read as several words, small
 * enough that a genuine mismatch doesn't drag the highlight off down the page.
 */
const LOOKAHEAD = 8;

/**
 * Split text for display, keeping the whitespace as its own tokens so the
 * pieces can be laid back down in order without inventing or losing spaces.
 */
export function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((part) => part.length > 0);
}

/** Letters and digits only, folded — "Edison's," and "edisons" are one word. */
const fold = (word: string): string =>
  word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/**
 * Attach each spoken word's timing to the token on screen that says it.
 *
 * Tokens with no match — because they were never spoken — simply get no span,
 * and the highlight passes over them.
 */
export function alignWords(
  tokens: string[],
  spoken: readonly SpokenWord[],
): WordSpan[] {
  const folded = tokens.map(fold);
  const spans: WordSpan[] = [];
  let cursor = 0;

  spoken.forEach((word) => {
    const want = fold(word.w);
    if (!want) return;

    const limit = Math.min(folded.length, cursor + LOOKAHEAD);
    for (let i = cursor; i < limit; i += 1) {
      if (!folded[i] || folded[i] !== want) continue;
      spans.push({ e: word.e, i, s: word.s });
      cursor = i + 1;
      return;
    }
    // Said but not shown — a substituted name, or a number read as words.
    // Dropped rather than guessed at: a wrong span moves the highlight
    // somewhere the voice isn't, which is worse than it standing still.
  });

  return spans;
}
