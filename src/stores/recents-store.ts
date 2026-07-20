import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { zustandStorage } from '@/utils/storage';

const MAX_RECENTS = 30;

export interface RecentDoc {
  uri: string;
  name: string;
  ext: string;
  openedAt: number;
  page: number;
  pageCount: number;
}

interface RecentsState {
  recents: RecentDoc[];
  recordOpen: (doc: { uri: string; name: string; ext: string }) => void;
  recordProgress: (uri: string, page: number, pageCount?: number) => void;
  remove: (uri: string) => void;
  clear: () => void;
}

export const useRecentsStore = create<RecentsState>()(
  persist(
    (set) => ({
      recents: [],

      recordOpen: ({ uri, name, ext }) =>
        set((s) => {
          const previous = s.recents.find((r) => r.uri === uri);
          const entry: RecentDoc = {
            uri,
            name,
            ext,
            openedAt: Date.now(),
            page: previous?.page ?? 1,
            pageCount: previous?.pageCount ?? 0,
          };
          return {
            recents: [entry, ...s.recents.filter((r) => r.uri !== uri)].slice(
              0,
              MAX_RECENTS,
            ),
          };
        }),

      recordProgress: (uri, page, pageCount) =>
        set((s) => {
          const current = s.recents.find((r) => r.uri === uri);
          if (
            !current ||
            (current.page === page &&
              (!pageCount || current.pageCount === pageCount))
          ) {
            return s;
          }
          return {
            recents: s.recents.map((r) =>
              r.uri === uri
                ? { ...r, page, pageCount: pageCount ?? r.pageCount }
                : r,
            ),
          };
        }),

      remove: (uri) =>
        set((s) => ({ recents: s.recents.filter((r) => r.uri !== uri) })),

      clear: () => set({ recents: [] }),
    }),
    {
      name: 'lexipdf-recents',
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
);

export function progressPct(doc: RecentDoc): number {
  if (!doc.pageCount) return 0;
  return Math.min(100, Math.round((doc.page / doc.pageCount) * 100));
}
