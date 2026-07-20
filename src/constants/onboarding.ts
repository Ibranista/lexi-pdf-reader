/**
 * Onboarding option ids — the actual copy (titles, descriptions, summaries)
 * lives in `src/locales/en/onboarding.json` and is read through i18next, so
 * translators can add new languages without touching this file or any screen.
 */

export type ReaderType = 'student' | 'researcher' | 'professional' | 'casual';

export type ReadingHelp = 'focus' | 'explain' | 'remember' | 'organize';

export const READER_TYPE_IDS: ReaderType[] = ['student', 'researcher', 'professional', 'casual'];

export const READING_HELP_IDS: ReadingHelp[] = ['focus', 'explain', 'remember', 'organize'];
