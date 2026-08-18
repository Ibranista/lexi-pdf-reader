export interface SpokenWord {
  w: string;
  s: number;
  e: number;
}

export interface WordSpan {
  i: number;
  s: number;
  e: number;
}

const LOOKAHEAD = 8;

export function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((part) => part.length > 0);
}

const fold = (word: string): string =>
  word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

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
  });

  return spans;
}
