/**
 * Demo content from the LexiPDF prototype — the sample book "The Age of Light",
 * library documents, collections, review cards and the tap-to-translate dictionary.
 */
import type { ReaderType } from '@/constants/onboarding';

export const BOOK_TITLE = 'The Age of Light';
export const BOOK_PAGES = 212;

export interface Chapter {
  n: number;
  t: string;
  p: number;
}

export const CHAPTERS: Chapter[] = [
  { n: 1, t: 'Fire and Tallow', p: 3 },
  { n: 2, t: 'The Gaslit Decades', p: 21 },
  { n: 3, t: 'The Electric Century', p: 44 },
  { n: 4, t: 'Neon Cities', p: 78 },
  { n: 5, t: 'The Fluorescent Office', p: 112 },
  { n: 6, t: 'Semiconductor Suns', p: 147 },
  { n: 7, t: 'Darkness, Reconsidered', p: 183 },
];

export function chapterOf(page: number): Chapter {
  let current = CHAPTERS[0];
  for (const c of CHAPTERS) {
    if (page >= c.p) current = c;
  }
  return current;
}

export interface RecentDoc {
  name: string;
  meta: string;
  badge: string;
  hot: boolean;
}

export const RECENT_DOCS: RecentDoc[] = [
  { name: 'Q3 Market Report.pdf', meta: '38 pages · yesterday', badge: '62%', hot: true },
  { name: 'Attention Is All You Need', meta: '15 pages · 2 days ago', badge: 'New', hot: false },
  { name: 'Rental Agreement — Final', meta: '12 pages · 3 days ago', badge: '100%', hot: true },
  { name: 'Amharic Phrasebook', meta: '96 pages · last week', badge: '8%', hot: false },
];

export const ALL_DOC_NAMES = [
  'The Age of Light',
  'Q3 Market Report',
  'Attention Is All You Need',
  'Rental Agreement — Final',
  'Amharic Phrasebook',
  'Deep Work — excerpt',
  'City Planning 101',
  'Tax Return 2025',
  'Recipe Collection',
];

export const FOLDERS = [
  { name: 'Downloads', meta: '12 PDFs' },
  { name: 'Documents', meta: '34 PDFs' },
  { name: 'WhatsApp Documents', meta: '7 PDFs' },
  { name: 'Books', meta: '18 PDFs' },
];

export interface LibraryEntry {
  name: string;
  meta: string;
  where: 'All PDFs' | 'Recent';
  isBook?: boolean;
}

export const LIBRARY_INDEX: LibraryEntry[] = [
  { name: 'The Age of Light', meta: '212 pages · reading', where: 'Recent', isBook: true },
  { name: 'Q3 Market Report.pdf', meta: '38 pages · yesterday', where: 'Recent' },
  { name: 'Attention Is All You Need', meta: '15 pages · 2 days ago', where: 'Recent' },
  { name: 'Rental Agreement — Final', meta: '12 pages · 3 days ago', where: 'Recent' },
  { name: 'Amharic Phrasebook', meta: '96 pages · last week', where: 'Recent' },
  { name: 'Deep Work — excerpt', meta: '24 pages', where: 'All PDFs' },
  { name: 'City Planning 101', meta: '140 pages', where: 'All PDFs' },
  { name: 'Tax Return 2025', meta: '8 pages', where: 'All PDFs' },
  { name: 'Recipe Collection', meta: '52 pages', where: 'All PDFs' },
];

export interface CollectionSet {
  label: string;
  colls: [emoji: string, name: string, meta: string][];
  filed: [name: string, coll: string, kind: string][];
}

export const COLLECTIONS: Record<ReaderType, CollectionSet> = {
  student: {
    label: 'Student',
    colls: [
      ['📚', 'Studying', '12 PDFs'],
      ['📖', 'Reading Later', '5 PDFs'],
      ['⭐', 'Important', '3 PDFs'],
      ['🧠', 'Review', '7 PDFs · 4 cards due'],
    ],
    filed: [
      ['Amharic Phrasebook', '📚 Studying', 'Textbook'],
      ['Attention Is All You Need', '📚 Studying', 'Paper'],
      ['Deep Work — excerpt', '📖 Reading Later', 'Book'],
    ],
  },
  researcher: {
    label: 'Researcher',
    colls: [
      ['📄', 'Papers', '14 PDFs'],
      ['🔖', 'To Read', '6 PDFs'],
      ['⭐', 'Key sources', '4 PDFs'],
      ['🧠', 'Review', '5 PDFs · 2 cards due'],
    ],
    filed: [
      ['Attention Is All You Need', '📄 Papers', 'Paper'],
      ['City Planning 101', '🔖 To Read', 'Textbook'],
      ['The Age of Light', '🔖 To Read', 'Book'],
    ],
  },
  professional: {
    label: 'Professional',
    colls: [
      ['💼', 'Work', '16 PDFs'],
      ['📑', 'Contracts', '4 PDFs'],
      ['📖', 'Reading Later', '5 PDFs'],
      ['⭐', 'Important', '3 PDFs'],
    ],
    filed: [
      ['Q3 Market Report.pdf', '💼 Work', 'Report'],
      ['Rental Agreement — Final', '📑 Contracts', 'Contract'],
      ['Tax Return 2025', '⭐ Important', 'Form'],
    ],
  },
  casual: {
    label: 'Casual reader',
    colls: [
      ['📖', 'Reading list', '9 PDFs'],
      ['💛', 'Favorites', '4 PDFs'],
      ['✅', 'Finished', '6 PDFs'],
      ['🔖', 'Later', '3 PDFs'],
    ],
    filed: [
      ['The Age of Light', '📖 Reading list', 'Book'],
      ['Recipe Collection', '💛 Favorites', 'Book'],
      ['Deep Work — excerpt', '🔖 Later', 'Article'],
    ],
  },
};

/** Tap-to-translate words embedded in the reader page. */
export interface DictEntry {
  pos: string;
  am: [string, string];
  ar: [string, string];
  en: [string, string];
  s1: string;
  s2: string;
}

export const DICT: Record<string, DictEntry> = {
  optional: {
    pos: 'adjective',
    am: ['አማራጭ', 'amarach'],
    ar: ['اختياري', 'ikhtiyārī'],
    en: ['a matter of choice', '—'],
    s1: 'It means night no longer forced people to stop — staying active became a choice.',
    s2: "The phrase marks the book's turning point: light gave people control over their time.",
  },
  rationed: {
    pos: 'verb (past)',
    am: ['የተመጠነ', 'yetemeṭene'],
    ar: ['مُقنَّن', 'muqannan'],
    en: ['limited to small amounts', '—'],
    s1: 'It means reading was limited to small amounts because candles and oil were costly.',
    s2: 'This sets up the contrast: electric light made reading an everyday pleasure.',
  },
  luminous: {
    pos: 'adjective',
    am: ['ብሩህ', 'biruh'],
    ar: ['مُضيء', 'muḍīʾ'],
    en: ['glowing with light', '—'],
    s1: 'Here it describes the newly electrified city — glowing brightly with artificial light.',
    s2: 'The author uses it with irony: the bright city hides a dark cost for gas workers.',
  },
  extinguished: {
    pos: 'verb (past)',
    am: ['የጠፋ', 'yeṭefa'],
    ar: ['أُطفئ', 'uṭfiʾa'],
    en: ['put out; ended', '—'],
    s1: 'Literally "put out," like a flame; here a whole trade is put out of existence.',
    s2: 'It mirrors the gas flames the lamplighters tended — the job dies with the fire.',
  },
};

export const LANG_NAMES: Record<string, string> = {
  am: 'Amharic',
  en: 'English',
  ar: 'Arabic',
};

/** Reader page paragraphs. Segments: plain text, tappable dictionary words, and one selectable passage. */
export type ParaSegment =
  | { kind: 'select'; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'word'; text: string; word: string };

export const PARAGRAPHS: ParaSegment[][] = [
  [
    {
      kind: 'text',
      text: "By the winter of 1882, lower Manhattan glowed with a light no fire had ever produced. Edison's Pearl Street station fed four hundred lamps across a single square mile, and the people who walked beneath them understood, perhaps for the first time, that night had become ",
    },
    { kind: 'word', text: 'optional', word: 'optional' },
    { kind: 'text', text: '.' },
  ],
  [
    {
      kind: 'text',
      text: 'The consequences arrived faster than anyone predicted. Factories abandoned the rhythm of the sun. Newspapers added evening editions. Reading — once ',
    },
    { kind: 'word', text: 'rationed', word: 'rationed' },
    {
      kind: 'text',
      text: ' by candlelight and the price of whale oil — became an ordinary pleasure of the working household.',
    },
  ],
  [
    { kind: 'text', text: 'Yet the ' },
    { kind: 'word', text: 'luminous', word: 'luminous' },
    { kind: 'text', text: ' city carried a cost that its architects rarely acknowledged. ' },
    {
      kind: 'select',
      text: 'Gas companies collapsed within a decade, taking whole neighborhoods of lamplighters with them.',
    },
    {
      kind: 'text',
      text: ' The men who had climbed ladders at dusk for forty years found their trade ',
    },
    { kind: 'word', text: 'extinguished', word: 'extinguished' },
    { kind: 'text', text: ' as completely as the flames they once tended.' },
  ],
  [
    {
      kind: 'text',
      text: 'The arithmetic was brutal and simple. A gas jet cost a penny an hour and dimmed as the mains strained under evening demand; an incandescent lamp burned steady for less. Insurance men, who had spent a century pricing the risk of open flame, discovered a technology that did not burn down what it illuminated.',
    },
  ],
  [
    {
      kind: 'text',
      text: 'City councils noticed. Between 1884 and 1890, more than two hundred American municipalities chartered electric franchises, often granting them the same streets the gas companies had trenched a generation earlier. The wires followed the pipes, and then replaced them.',
    },
  ],
  [
    {
      kind: 'text',
      text: 'What Edison sold, in the end, was not illumination but time — hours reclaimed from darkness and repurposed for industry, leisure, and thought.',
    },
  ],
];

/** In-document search corpus. */
export const CORPUS = [
  { p: 44, txt: 'Chapter 3 · The Electric Century began not in a laboratory but on Wall Street' },
  { p: 47, txt: 'the electric lamps of Pearl Street fed four hundred storefronts and offices' },
  { p: 51, txt: 'an electric future its investors could scarcely imagine was already arriving' },
  { p: 52, txt: 'gaslight lingered in the poorer wards for another thirty years' },
  { p: 63, txt: 'the electric grid grew city by city, wire by wire, franchise by franchise' },
  { p: 23, txt: 'Gaslight was the first subscription utility: light, delivered monthly, by pipe' },
  { p: 112, txt: 'the fluorescent office made light a management tool' },
  { p: 186, txt: 'astronomers now petition cities for darkness the way parks once petitioned for light' },
];

export interface ReviewCard {
  q: string;
  a: string;
  p: number;
}

export const REVIEW_CARDS: ReviewCard[] = [
  {
    q: 'What did the book call "the first subscription utility"?',
    a: 'Gaslight — light delivered monthly, by pipe, decades before the electric grid copied the model.',
    p: 23,
  },
  {
    q: 'Where did the Electric Century begin, according to Chapter 3?',
    a: 'Not in a laboratory but on Wall Street — Pearl Street fed four hundred storefronts and offices.',
    p: 44,
  },
  {
    q: 'What human cost did the luminous city carry?',
    a: 'Gas companies collapsed within a decade, taking whole neighborhoods of lamplighters with them.',
    p: 51,
  },
];

export const PRO_ROWS = [
  { name: 'Reading & annotation', free: '✓', pro: '✓', ai: false },
  { name: 'Documents', free: 'All', pro: 'All', ai: false },
  { name: 'AI explanations', free: '5/day', pro: 'Unlimited', ai: true },
  { name: 'Page summaries', free: '—', pro: '✓', ai: true },
  { name: 'Translate as you read', free: '—', pro: '✓', ai: true },
  { name: 'Review cards', free: '✓', pro: '✓', ai: false },
  { name: 'Knowledge graph', free: '—', pro: '✓', ai: true },
];

export const PW_FEATURES = [
  { name: 'Unlimited "Explain this"', sub: 'Any passage, at your level, with your context' },
  { name: 'Summaries & translation', sub: 'Whole pages, inline, in your language' },
  { name: 'Knowledge graph', sub: 'See how your highlights connect across books' },
  { name: 'Hey Lexi voice companion', sub: 'Ask questions without leaving the page' },
];

export const EXPLAIN_BODIES: Record<string, string> = {
  simply:
    'Gas lighting died fast once electricity arrived — and the people whose jobs depended on it (like lamplighters) lost their work along with it.',
  beginner:
    'When cities switched to electric light, the gas companies that had lit streets for decades went bankrupt quickly. Whole trades built around gaslight — lamplighters, pipe fitters — disappeared with them. Progress helped most people but hurt these workers directly.',
  advanced:
    'The passage frames electrification as creative destruction: incumbent gas utilities, structured as subscription monopolies, collapsed within roughly a decade of grid rollout. The displacement was concentrated — occupational communities (lamplighters) lost both income and identity, a cost "rarely acknowledged" by the era\'s boosters.',
  example:
    'A modern parallel: video-rental stores after streaming. Blockbuster peaked in 2004 and was bankrupt by 2010 — the clerks and franchise owners were the lamplighters of that transition.',
  connect:
    'This mirrors Chapter 2\'s "Gaslight Economy": the same pipes that made light a monthly service created the dependency that made the collapse so sharp when electricity offered a better subscription.',
};

export const LEXI_SEED = [
  {
    role: 'user' as const,
    kind: 'normal' as const,
    text: 'Hey Lexi, what does the author mean by "night had become optional"?',
  },
  {
    role: 'lexi' as const,
    kind: 'normal' as const,
    text: 'Before Pearl Street, darkness ended the day for most people. The author means electric light made staying active after sunset a genuine choice — work, reading and leisure no longer had to stop when the sun did.',
  },
  {
    role: 'user' as const,
    kind: 'normal' as const,
    text: 'Nice. Also — pasta or sushi for dinner tonight?',
  },
  {
    role: 'lexi' as const,
    kind: 'drift' as const,
    text: "Pasta's hard to beat 🍝 Happy to chat, but let's park that for later — you were doing great on Chapter 3. Want to continue?",
  },
  {
    role: 'user' as const,
    kind: 'normal' as const,
    text: 'What year exactly did Pearl Street open?',
  },
  {
    role: 'lexi' as const,
    kind: 'normal' as const,
    text: 'September 1882 — it lit roughly 400 lamps across lower Manhattan at launch.',
  },
];

export const SUMMARY_POINTS = [
  "Edison's 1882 Pearl Street station brought electric light to lower Manhattan, making night activity a real choice for the first time.",
  'Cheap light reshaped daily life — factory shifts, evening papers, and household reading all expanded quickly.',
  'The shift destroyed the gas industry and its workers; the author argues Edison ultimately sold reclaimed time, not light.',
];
