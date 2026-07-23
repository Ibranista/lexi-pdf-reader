/**
 * Midpoint of the commonly cited 250–300 WPM average adult reading range.
 * Progress is based on time spent on each page, capped at that page's
 * word-count-derived reading time.
 */
export const AVERAGE_READING_WPM = 275;

export function countWords(text: string): number {
  return text.trim().match(/\S+/g)?.length ?? 0;
}

export function expectedReadingMs(wordCount: number): number {
  return Math.max(1, Math.round((wordCount / AVERAGE_READING_WPM) * 60_000));
}

/** Split plain text into page-like, 300-word reading units. */
export function textPageReadingPlan(text: string, wordsPerPage = 300): number[] {
  const wordCount = countWords(text);
  if (!wordCount) return [expectedReadingMs(1)];
  const pages: number[] = [];
  for (let remaining = wordCount; remaining > 0; remaining -= wordsPerPage) {
    pages.push(expectedReadingMs(Math.min(wordsPerPage, remaining)));
  }
  return pages;
}
