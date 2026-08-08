import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { CollectionId } from "@/constants/collections";
import { COLLECTION_META } from "@/constants/collections";
import { zustandStorage } from "@/utils/storage";

/**
 * A document as filed, not as scanned. The name and format are copied in so a
 * collection still renders when the file sits behind storage permission the
 * user hasn't granted this session — the row stays, and opening it is what
 * fails, loudly.
 */
export interface CollectedDoc {
  uri: string;
  name: string;
  /** Uppercase format badge, e.g. "PDF". */
  ext: string;
  addedAt: number;
}

/** What a caller has to hand us to file something. */
export type FilableDoc = Pick<CollectedDoc, "ext" | "name" | "uri">;

type Shelves = Record<CollectionId, CollectedDoc[]>;

/** Spelled out rather than derived from COLLECTION_META so adding a shelf
 *  there is a compile error here until it's handled. */
const emptyShelves = (): Shelves => ({
  studying: [],
  later: [],
  important: [],
});

interface CollectionsState {
  items: Shelves;
  /** Files the document, or unfiles it if already there. Returns the new state. */
  toggle: (id: CollectionId, doc: FilableDoc) => boolean;
  add: (id: CollectionId, doc: FilableDoc) => void;
  remove: (id: CollectionId, uri: string) => void;
  /** Drops a document from every shelf — used when a file is gone for good. */
  forget: (uri: string) => void;
  /** Re-points every shelf entry at a file's new uri and name after a rename. */
  rename: (uri: string, next: { uri: string; name: string }) => void;
}

export const useCollectionsStore = create<CollectionsState>()(
  persist(
    (set, get) => ({
      items: emptyShelves(),

      // newest first, so a shelf reads as "what I most recently filed"
      add: (id, doc) =>
        set((s) => {
          const shelf = s.items[id] ?? [];
          if (shelf.some((d) => d.uri === doc.uri)) return s;
          return {
            items: {
              ...s.items,
              [id]: [{ ...doc, addedAt: Date.now() }, ...shelf],
            },
          };
        }),

      remove: (id, uri) =>
        set((s) => ({
          items: {
            ...s.items,
            [id]: (s.items[id] ?? []).filter((d) => d.uri !== uri),
          },
        })),

      toggle: (id, doc) => {
        const filed = (get().items[id] ?? []).some((d) => d.uri === doc.uri);
        if (filed) get().remove(id, doc.uri);
        else get().add(id, doc);
        return !filed;
      },

      forget: (uri) =>
        set((s) => ({
          items: Object.fromEntries(
            Object.entries(s.items).map(([id, shelf]) => [
              id,
              shelf.filter((d) => d.uri !== uri),
            ]),
          ) as Shelves,
        })),

      rename: (uri, next) =>
        set((s) => ({
          items: Object.fromEntries(
            Object.entries(s.items).map(([id, shelf]) => [
              id,
              shelf.map((d) =>
                d.uri === uri ? { ...d, uri: next.uri, name: next.name } : d,
              ),
            ]),
          ) as Shelves,
        })),
    }),
    {
      name: "lexipdf-collections",
      storage: createJSONStorage(() => zustandStorage),
      // A shelf added in a later version is missing from stored state; fill it
      // in rather than letting `items[id]` come back undefined.
      merge: (persisted, current) => {
        const stored = (persisted as { items?: Partial<Shelves> })?.items ?? {};
        return {
          ...current,
          items: { ...emptyShelves(), ...stored },
        };
      },
    },
  ),
);

/** Which shelves a document currently sits on. */
export function collectionsOf(items: Shelves, uri: string): CollectionId[] {
  return COLLECTION_META.filter((c) =>
    (items[c.id] ?? []).some((d) => d.uri === uri),
  ).map((c) => c.id);
}
