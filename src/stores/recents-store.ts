import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { zustandStorage } from "@/utils/storage";

const MAX_RECENTS = 30;

export interface RecentDoc {
  uri: string;
  name: string;
  ext: string;
  openedAt: number;
  page: number;
  pageCount: number;
  bookmarks?: number[];
  readingPlanMs?: number[];
  readingTimeMsByPage?: Record<string, number>;
}

interface RecentsState {
  recents: RecentDoc[];
  positions: Record<string, number>;
  recordOpen: (doc: { uri: string; name: string; ext: string }) => void;
  recordProgress: (uri: string, page: number, pageCount?: number) => void;
  setReadingPlan: (uri: string, pageTimesMs: number[]) => void;
  recordReadingTime: (uri: string, page: number, elapsedMs: number) => void;
  toggleBookmark: (uri: string, page: number) => void;
  remove: (uri: string) => void;
  rename: (uri: string, next: { uri: string; name: string }) => void;
  clear: () => void;
}

export const useRecentsStore = create<RecentsState>()(
  persist(
    (set) => ({
      recents: [],
      positions: {},

      recordOpen: ({ uri, name, ext }) =>
        set((s) => {
          const previous = s.recents.find((r) => r.uri === uri);
          const entry: RecentDoc = {
            ...previous,
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
          const positionUnchanged = s.positions[uri] === page;
          const recentUnchanged =
            !current ||
            (current.page === page &&
              (!pageCount || current.pageCount === pageCount));
          if (recentUnchanged && positionUnchanged) {
            return s;
          }
          return {
            positions: positionUnchanged
              ? s.positions
              : { ...s.positions, [uri]: page },
            recents: recentUnchanged
              ? s.recents
              : s.recents.map((r) =>
                  r.uri === uri
                    ? { ...r, page, pageCount: pageCount ?? r.pageCount }
                    : r,
                ),
          };
        }),

      setReadingPlan: (uri, pageTimesMs) =>
        set((s) => ({
          recents: s.recents.map((r) =>
            r.uri === uri ? { ...r, readingPlanMs: pageTimesMs } : r,
          ),
        })),

      recordReadingTime: (uri, page, elapsedMs) => {
        if (elapsedMs <= 0) return;
        set((s) => ({
          recents: s.recents.map((r) => {
            if (r.uri !== uri) return r;
            const key = String(page);
            return {
              ...r,
              readingTimeMsByPage: {
                ...r.readingTimeMsByPage,
                [key]: (r.readingTimeMsByPage?.[key] ?? 0) + elapsedMs,
              },
            };
          }),
        }));
      },

      toggleBookmark: (uri, page) =>
        set((s) => ({
          recents: s.recents.map((r) => {
            if (r.uri !== uri) return r;
            const current = r.bookmarks ?? [];
            return {
              ...r,
              bookmarks: current.includes(page)
                ? current.filter((p) => p !== page)
                : [...current, page].sort((a, b) => a - b),
            };
          }),
        })),

      remove: (uri) =>
        set((s) => ({ recents: s.recents.filter((r) => r.uri !== uri) })),

      rename: (uri, next) =>
        set((s) => {
          const { [uri]: movedPosition, ...positions } = s.positions;
          return {
            positions:
              movedPosition === undefined
                ? s.positions
                : { ...positions, [next.uri]: movedPosition },
            recents: s.recents.map((r) =>
              r.uri === uri ? { ...r, uri: next.uri, name: next.name } : r,
            ),
          };
        }),

      clear: () => set({ recents: [] }),
    }),
    {
      name: "lexipdf-recents",
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
);

export function progressPct(doc: RecentDoc): number {
  if (doc.readingPlanMs?.length) {
    const expected = doc.readingPlanMs.reduce((sum, ms) => sum + ms, 0);
    if (!expected) return 0;
    const elapsed = doc.readingPlanMs.reduce(
      (sum, pageMs, index) =>
        sum +
        Math.min(pageMs, doc.readingTimeMsByPage?.[String(index + 1)] ?? 0),
      0,
    );
    return Math.min(100, Math.round((elapsed / expected) * 100));
  }
  if (!doc.pageCount) return 0;
  return Math.min(100, Math.round((doc.page / doc.pageCount) * 100));
}
