/**
 * Product limits that aren't secrets — kept here so they're easy to find and
 * tune in one place.
 */

/**
 * Most words a single selection may send to the AI word card (Translate /
 * Explain). Long enough for a paragraph you want explained, short enough that
 * nobody can paste a chapter — or the whole book — into one request. The
 * backend enforces its own limit too (AI_TRANSLATE_MAX_WORDS), so this is the
 * friendly front-line gate, not the only guard.
 */
export const MAX_TRANSLATE_WORDS = 80;

/**
 * Fewest letters a selection needs before Translate / Explain will run.
 *
 * Two, not one: it's what separates a word from a stray character. A page
 * number, a bullet, a footnote marker or a stranded initial ("42", "—", "e.")
 * has nothing to explain, and sending one spends a credit to be told so.
 */
const MIN_TRANSLATE_LETTERS = 2;

/**
 * Letters in any script — Latin, Arabic, Ethiopic alike — which is why this is
 * `\p{L}` and not `[a-z]`. Digits, punctuation and symbols are not letters, so
 * they simply don't count towards the minimum.
 */
const LETTER = /\p{L}/gu;

/**
 * Whether a selection is worth sending to the word card.
 *
 * The rule is only about *substance*, never length: "COVID-19" and "Chapter 5"
 * pass on their letters, while "123", "!!!" and "a." have no word in them to
 * translate and are refused before they cost the reader anything.
 */
export function isTranslatable(text: string): boolean {
  return (text.match(LETTER) ?? []).length >= MIN_TRANSLATE_LETTERS;
}
