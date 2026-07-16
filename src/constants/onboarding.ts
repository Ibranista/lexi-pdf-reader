/**
 * Onboarding copy — questions, options, and summary text shown while a new
 * reader sets up their defaults.
 *
 * This is plain static data today. It's shaped so a future version can be
 * swapped for a fetched equivalent (e.g. `GET /onboarding/config`) without
 * touching the screens that render it — components only ever consume the
 * exported types and arrays below, never the literal values.
 */

export type ReaderType = 'student' | 'researcher' | 'professional' | 'casual';

export type ReadingHelp = 'focus' | 'explain' | 'remember' | 'organize';

export interface ReaderTypeOption {
  id: ReaderType;
  title: string;
  description: string;
}

export interface ReadingHelpOption {
  id: ReadingHelp;
  title: string;
  description: string;
}

export interface OnboardingSummaryRow {
  title: string;
  description: string;
}

export interface OnboardingStepCopy {
  title: string;
  subtitle: string;
  ctaLabel: string;
}

// ---------------------------------------------------------------------------
// Step 1 — reader type (single-select)
// ---------------------------------------------------------------------------

export const READER_TYPE_OPTIONS: ReaderTypeOption[] = [
  { id: 'student', title: 'Student', description: 'Textbooks, lectures, exam prep' },
  { id: 'researcher', title: 'Researcher', description: 'Papers, citations, deep reading' },
  { id: 'professional', title: 'Professional', description: 'Docs, reports, contracts' },
  { id: 'casual', title: 'Casual reader', description: 'Books, articles, curiosity' },
];

// ---------------------------------------------------------------------------
// Step 2 — reading helps (multi-select)
// ---------------------------------------------------------------------------

export const READING_HELP_OPTIONS: ReadingHelpOption[] = [
  {
    id: 'focus',
    title: 'Staying focused',
    description: 'Focus mode & gentle sessions turned on',
  },
  {
    id: 'explain',
    title: 'Understanding difficult concepts',
    description: '"Explain this" close at hand',
  },
  {
    id: 'remember',
    title: 'Remembering information',
    description: 'Highlights become gentle review cards',
  },
  {
    id: 'organize',
    title: 'Organizing notes',
    description: 'Collections & auto-filing set up for you',
  },
];

// ---------------------------------------------------------------------------
// Step 3 — ready summary
// ---------------------------------------------------------------------------

/** Confirmation row shown per selected reading help on the "ready" screen. */
export const READING_HELP_SUMMARY: Record<ReadingHelp, OnboardingSummaryRow> = {
  focus: {
    title: 'Focus reminders on',
    description: 'Gentle nudges to keep your momentum',
  },
  explain: {
    title: '"Explain this" close at hand',
    description: 'One tap on any selection, at your level',
  },
  remember: {
    title: 'Highlights become review cards',
    description: 'Gentle spaced review — no scores',
  },
  organize: {
    title: 'Auto-filing switched on',
    description: 'New PDFs get a suggested collection',
  },
};

/** Confirmation row for the chosen reader type on the "ready" screen. */
export const READER_TYPE_SUMMARY: Record<ReaderType, OnboardingSummaryRow> = {
  student: {
    title: 'Set up for students',
    description: 'Calm defaults for textbooks, lectures and exam prep',
  },
  researcher: {
    title: 'Set up for researchers',
    description: 'Calm defaults for papers, citations and deep reading',
  },
  professional: {
    title: 'Set up for professionals',
    description: 'Calm defaults for docs, reports and contracts',
  },
  casual: {
    title: 'Set up for casual reading',
    description: 'Calm defaults for books, articles and curiosity',
  },
};

// ---------------------------------------------------------------------------
// Step copy
// ---------------------------------------------------------------------------

export const ONBOARDING_STEPS: OnboardingStepCopy[] = [
  {
    title: 'What type of reader are you?',
    subtitle: 'This only sets calm defaults. You can change anything later.',
    ctaLabel: 'Continue',
  },
  {
    title: 'What helps you read better?',
    subtitle: 'Pick as many as you like.',
    ctaLabel: 'Set up my reader',
  },
  {
    title: 'Your reader is ready',
    subtitle: 'Set from your answers — change anything in Settings.',
    ctaLabel: 'Start reading',
  },
];
