import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { zustandStorage } from '@/utils/storage';

export type Lang = 'am' | 'ar' | 'en';

export const LINE_SPACING = {
  compact: 1.55,
  comfy: 1.75,
  airy: 2.05,
} as const;
export type FontFam = 'dys' | 'sans' | 'serif';
export type LineSpacing = 'airy' | 'comfy' | 'compact';
export type ReadWidth = 'comfort' | 'full' | 'narrow';
export type Contrast = 'soft' | 'std';
export type ExplainStyle = 'advanced' | 'balanced' | 'simple';
export type FocusSensitivity = 'balanced' | 'frequent' | 'relaxed';
export type PaywallPlan = 'annual' | 'monthly';
export type SortKey = 'date' | 'name' | 'size';
export type SortDir = 'asc' | 'desc';
export interface LibrarySort {
  key: SortKey;
  dir: SortDir;
}
export type LibraryView = 'grid' | 'list';

export interface VocabEntry {
  word: string;
  pos: string;
  tr: string;
  translit: string;
  lang: Lang;
  p: number;
  s1: string;
  s2: string;
}

export interface NoteItem {
  p: number;
  ch: number;
  text: string;
  color: 'amber' | 'green';
  note: string;
  when: string;
}

const SEED_VOCAB: VocabEntry[] = [
  {
    word: 'rationed',
    pos: 'verb (past)',
    tr: 'የተመጠነ',
    translit: 'yetemeṭene',
    lang: 'am',
    p: 47,
    s1: 'It means reading was limited to small amounts because candles and oil were costly.',
    s2: 'This sets up the contrast: electric light made reading an everyday pleasure.',
  },
];

const SEED_NOTES: NoteItem[] = [
  {
    p: 47,
    ch: 3,
    text: '"What Edison sold, in the end, was not illumination but time."',
    color: 'amber',
    note: 'Great thesis line — reuse in my essay on technological externalities.',
    when: 'Today',
  },
  {
    p: 45,
    ch: 3,
    text: '"…night had become optional."',
    color: 'green',
    note: '',
    when: 'Today',
  },
  {
    p: 23,
    ch: 2,
    text: '"Gaslight was the first subscription utility: light, delivered monthly, by pipe."',
    color: 'amber',
    note: 'Compare with modern SaaS framing.',
    when: 'Yesterday',
  },
];

interface AppState {
  page: number;
  bookmarks: number[];
  zoom: number;
  fontFam: FontFam;
  textSize: number;
  lineSp: LineSpacing;
  readWidth: ReadWidth;
  bright: number;
  contrast: Contrast;
  focusRem: boolean;
  focusSens: FocusSensitivity;
  flowRead: boolean;
  fmTimer: boolean;
  aiOn: boolean;
  lang: Lang;
  explStyle: ExplainStyle;
  thoughtOn: boolean;
  cardsPerDay: number;
  syncPos: boolean;
  syncNt: boolean;
  syncRv: boolean;
  pro: boolean;
  pwPlan: PaywallPlan;
  vocab: VocabEntry[];
  items: NoteItem[];
  books: number;
  brainPct: number;
  libRootUri: string | null;
  libRootName: string | null;
  storageAsked: boolean;
  librarySort: LibrarySort;
  libraryView: LibraryView;

  setPage: (page: number) => void;
  toggleBookmark: (page: number) => void;
  addBookmark: (page: number) => void;
  set: (patch: Partial<AppState>) => void;
  addVocab: (entry: VocabEntry) => void;
  addNote: (note: NoteItem) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      page: 147,
      bookmarks: [23],
      zoom: 125,
      fontFam: 'serif',
      textSize: 17,
      lineSp: 'comfy',
      readWidth: 'comfort',
      bright: 90,
      contrast: 'std',
      focusRem: true,
      focusSens: 'balanced',
      flowRead: true,
      fmTimer: true,

      aiOn: true,
      lang: 'am',
      explStyle: 'balanced',
      thoughtOn: true,
      cardsPerDay: 3,
      syncPos: true,
      syncNt: true,
      syncRv: false,

      pro: false,
      pwPlan: 'annual',

      vocab: SEED_VOCAB,
      items: SEED_NOTES,
      books: 21,
      brainPct: 42,
      libRootUri: null,
      libRootName: null,
      storageAsked: false,
      librarySort: { key: 'date', dir: 'desc' },
      libraryView: 'grid',

      setPage: (page) => set({ page }),

      toggleBookmark: (page) =>
        set((s) => ({
          bookmarks: s.bookmarks.includes(page)
            ? s.bookmarks.filter((p) => p !== page)
            : [...s.bookmarks, page],
        })),

      addBookmark: (page) =>
        set((s) => (s.bookmarks.includes(page) ? s : { bookmarks: [...s.bookmarks, page] })),

      set: (patch) => set(patch),

      addVocab: (entry) => {
        if (get().vocab.some((v) => v.word === entry.word)) return;
        set((s) => ({ vocab: [entry, ...s.vocab] }));
      },

      addNote: (note) => set((s) => ({ items: [note, ...s.items] })),
    }),
    {
      name: 'lexipdf-app',
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
);

interface ToastState {
  toast: string;
  showToast: (message: string) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useToastStore = create<ToastState>()((set) => ({
  toast: '',
  showToast: (message) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: message });
    toastTimer = setTimeout(() => set({ toast: '' }), 1700);
  },
}));
