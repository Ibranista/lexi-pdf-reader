import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { zustandStorage } from "@/utils/storage";

/** Most-recent-first; older entries fall off the end. */
const MAX_RECENTS = 30;

export interface RecentDoc {
  uri: string;
  name: string;
  /** Uppercase format badge, e.g. "PDF". */
  ext: string;
  openedAt: number;
  /** Last page the reader was on, 1-based. */
  page: number;
  /** 0 until the document reports its length. */
  pageCount: number;
  /**
   * Bookmarked pages, ascending. Per document rather than app-wide — the
   * app-store's `bookmarks` belongs to the single demo book in `/reader`,
   * and sharing it here meant every real document showed the same ones.
   */
  bookmarks?: number[];
  /** Expected reading time for every page, based on its word count. */
  readingPlanMs?: number[];
  /** Accumulated active reading time, keyed by 1-based page number. */
  readingTimeMsByPage?: Record<string, number>;
}

interface RecentsState {
  recents: RecentDoc[];
  /**
   * Last reading page per document, kept UNCAPPED and separate from the (capped)
   * recents list — so where you left off survives even after a document falls
   * off the recents shelf. Keyed by uri; tiny, so it's cheap to keep forever.
   */
  positions: Record<string, number>;
  /** Moves the document to the front, keeping any progress already stored. */
  recordOpen: (doc: { uri: string; name: string; ext: string }) => void;
  /** Reading position, written as the reader moves through the document. */
  recordProgress: (uri: string, page: number, pageCount?: number) => void;
  setReadingPlan: (uri: string, pageTimesMs: number[]) => void;
  recordReadingTime: (uri: string, page: number, elapsedMs: number) => void;
  /** Adds the page to this document's bookmarks, or removes it if already on. */
  toggleBookmark: (uri: string, page: number) => void;
  remove: (uri: string) => void;
  /** Follows a renamed file: entry and saved position move to the new uri. */
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
          // Spread the previous entry first: listing the fields by hand meant
          // everything not named here (bookmarks, the reading plan, accrued
          // reading time) was dropped every time the document was reopened.
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

      // Position only — deliberately does not reorder the list, so scrolling
      // a document doesn't reshuffle the shelf under the reader.
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
            // Always record the raw position in the uncapped map, so it outlives
            // the document dropping off the recents shelf.
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
              // kept sorted, so the drawer can list them in reading order
              // without re-sorting on every render
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

/** Percent read, 0 when the document length isn't known yet. */
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
