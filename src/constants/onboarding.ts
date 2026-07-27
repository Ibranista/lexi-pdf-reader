/**
 * Onboarding options — the actual copy lives in `src/locales/en/onboarding.json`
 * and is read through i18next, so translators can add new languages without
 * touching this file or the screen.
 */

export type ReadingInterest =
  | 'academic-papers'
  | 'biographies'
  | 'business'
  | 'essays'
  | 'fiction'
  | 'history'
  | 'language-learning'
  | 'manuals'
  | 'novels'
  | 'philosophy'
  | 'reports'
  | 'science'
  | 'self-improvement'
  | 'short-stories'
  | 'textbooks'
  | 'work-documents';

/** Display order of the chips — study material, then work, ideas, stories. */
export const READING_INTEREST_IDS: ReadingInterest[] = [
  'textbooks',
  'academic-papers',
  'science',
  'language-learning',
  'work-documents',
  'reports',
  'business',
  'manuals',
  'philosophy',
  'history',
  'self-improvement',
  'essays',
  'biographies',
  'fiction',
  'novels',
  'short-stories',
];

export type ReaderType = 'casual' | 'professional' | 'researcher' | 'student';

/**
 * Reader type is no longer asked for directly — it's inferred from what the
 * reader says they read, and still keys the demo "Auto-filled for you"
 * fixtures in `constants/library.ts`.
 */
const READER_TYPE_BY_INTEREST: Record<ReadingInterest, ReaderType> = {
  'academic-papers': 'researcher',
  biographies: 'casual',
  business: 'professional',
  essays: 'casual',
  fiction: 'casual',
  history: 'casual',
  'language-learning': 'student',
  manuals: 'professional',
  novels: 'casual',
  philosophy: 'casual',
  reports: 'professional',
  science: 'researcher',
  'self-improvement': 'casual',
  'short-stories': 'casual',
  textbooks: 'student',
  'work-documents': 'professional',
};

/** Tie-break order, and the fallback when nothing has been picked. */
const READER_TYPE_PRIORITY: ReaderType[] = [
  'student',
  'researcher',
  'professional',
  'casual',
];

/** The reader type implied by a set of interests — the most-voted-for one. */
export function readerTypeFor(interests: ReadingInterest[]): ReaderType {
  const votes = new Map<ReaderType, number>();
  for (const id of interests) {
    const type = READER_TYPE_BY_INTEREST[id];
    votes.set(type, (votes.get(type) ?? 0) + 1);
  }

  let best = READER_TYPE_PRIORITY[0];
  for (const type of READER_TYPE_PRIORITY) {
    if ((votes.get(type) ?? 0) > (votes.get(best) ?? 0)) best = type;
  }
  return best;
}
