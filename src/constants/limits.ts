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
