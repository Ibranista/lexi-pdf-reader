import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { CollectionId } from "@/constants/collections";
import { COLLECTION_META } from "@/constants/collections";
import { zustandStorage } from "@/utils/storage";

export interface CollectedDoc {
  uri: string;
  name: string;
  ext: string;
  addedAt: number;
}

export type FilableDoc = Pick<CollectedDoc, "ext" | "name" | "uri">;

type Shelves = Record<CollectionId, CollectedDoc[]>;

const emptyShelves = (): Shelves => ({
  studying: [],
  later: [],
  important: [],
});

interface CollectionsState {
  items: Shelves;
  toggle: (id: CollectionId, doc: FilableDoc) => boolean;
  add: (id: CollectionId, doc: FilableDoc) => void;
  remove: (id: CollectionId, uri: string) => void;
  forget: (uri: string) => void;
}

export const useCollectionsStore = create<CollectionsState>()(
  persist(
    (set, get) => ({
      items: emptyShelves(),

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
    }),
    {
      name: "lexipdf-collections",
      storage: createJSONStorage(() => zustandStorage),
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

export function collectionsOf(items: Shelves, uri: string): CollectionId[] {
  return COLLECTION_META.filter((c) =>
    (items[c.id] ?? []).some((d) => d.uri === uri),
  ).map((c) => c.id);
}
