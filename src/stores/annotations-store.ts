import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { zustandStorage } from "@/utils/storage";

/**
 * Highlights and notes for real documents, keyed by document uri.
 *
 * Deliberately separate from the app-store's `items`, which is the fixture
 * data behind the prototype reader's single demo book. One row covers both
 * kinds: a highlight is a row with an empty `note`, and adding a note to it
 * later fills that in rather than creating a second entry — which is what
 * lets the Notes screen show "Highlights" and "Notes" as views of one list.
 */
export type HighlightColor = "amber" | "rose" | "sage" | "sky";

/** Swatches, matching the prototype's selection palette. */
export const HIGHLIGHT_COLORS: { key: HighlightColor; label: string }[] = [
  { key: "amber", label: "Amber" },
  { key: "sage", label: "Sage" },
  { key: "sky", label: "Sky" },
  { key: "rose", label: "Rose" },
];

/** Fill used for the swatch and the quoted passage's edge. */
export const HIGHLIGHT_FILL: Record<HighlightColor, string> = {
  amber: "#EFC57E",
  sage: "#B4D4B4",
  sky: "#AECBE8",
  rose: "#E8B8B4",
};

export interface Annotation {
  id: string;
  /**
   * Document this belongs to, as this device knows it. Empty for a row that
   * arrived from another device — the server never sees a uri (it is a local
   * pointer, spec §2.1), so the sync layer re-attaches one by `docKey` when the
   * same document is on this device too.
   */
  uri: string;
  /**
   * The document's *sync* identity. Filled in by the sync layer on the way out
   * and present on anything pulled in; undefined only on a row made offline
   * that has not been pushed yet.
   */
  docKey?: string;
  /** 1-based page the passage was selected on. */
  page: number;
  /** The selected passage itself. */
  text: string;
  /**
   * Human-readable origin, e.g. a book's title. Set for passages that aren't
   * tied to a document you can reopen — a web book's url can change, so the
   * uri is no use as a label there.
   */
  source?: string;
  color: HighlightColor;
  /** Empty for a plain highlight. */
  note: string;
  createdAt: number;
  /**
   * Last local edit, epoch ms. The only input to the server's last-write-wins,
   * so every mutation below has to move it.
   */
  updatedAt: number;
  /**
   * The `updatedAt` the server has acknowledged. Different (or missing) means
   * this row still has to be pushed — comparing values rather than holding a
   * boolean is what makes an edit *during* a push stay dirty.
   */
  syncedAt?: number;
}

/**
 * A deleted annotation, kept only long enough to tell the server about it.
 *
 * Deletes cannot be a plain `filter` out of `items`: the next pull would hand
 * the row straight back, because as far as the server is concerned it still
 * exists. So the row moves here, goes up as a tombstone (`deletedAt` set), and
 * is dropped for good once the server has it.
 *
 * Keeping them out of `items` rather than filtering `items` everywhere is
 * deliberate — every screen that reads `items` shows live annotations and
 * cannot accidentally render a deleted one.
 */
export type Tombstone = Omit<Annotation, "syncedAt" | "uri"> & {
  deletedAt: number;
};

/** An annotation as it comes off the wire — no `uri`, `deletedAt` always present. */
export interface RemoteAnnotation {
  id: string;
  docKey: string;
  page: number;
  text: string;
  source?: string;
  color: HighlightColor;
  note: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

interface AnnotationsState {
  items: Annotation[];
  /** Deleted rows the server has not been told about yet. */
  deleted: Tombstone[];
  /** Returns the new annotation's id, so the caller can open a note on it. */
  add: (input: {
    uri: string;
    page: number;
    text: string;
    source?: string;
    color: HighlightColor;
    note?: string;
  }) => string;
  setNote: (id: string, note: string) => void;
  setColor: (id: string, color: HighlightColor) => void;
  remove: (id: string) => void;
  /** Drops everything for a document — used when it's removed from the library. */
  clearDocument: (uri: string) => void;

  // ---- used by the sync layer (src/services/sync.ts) ----
  /** Attach sync identities the layer resolved from each row's `uri`. */
  setDocKeys: (byUri: Record<string, string>) => void;
  /** Re-attach this device's `uri` to rows that arrived without one. */
  attachUris: (byDocKey: Record<string, string>) => void;
  /** Fold in what a sync returned. Local edits made mid-round-trip win. */
  applyRemote: (rows: RemoteAnnotation[]) => void;
  /** The server has these versions now: stop pushing them, bury the tombstones. */
  markPushed: (versions: Record<string, number>, buried: string[]) => void;
  /** Give these rows new ids after the server reported an id collision. */
  reissueIds: (ids: string[]) => void;
}

let seq = 0;
const newId = () => `${Date.now().toString(36)}-${(seq++).toString(36)}`;

/** Everything a live row carries into the graveyard, minus what dies with it. */
const entomb = (a: Annotation, deletedAt: number): Tombstone => ({
  id: a.id,
  docKey: a.docKey,
  page: a.page,
  text: a.text,
  source: a.source,
  color: a.color,
  note: a.note,
  createdAt: a.createdAt,
  updatedAt: deletedAt,
  deletedAt,
});

export const useAnnotationsStore = create<AnnotationsState>()(
  persist(
    (set) => ({
      items: [],
      deleted: [],

      add: ({ uri, page, text, source, color, note }) => {
        const id = newId();
        const now = Date.now();
        set((s) => ({
          items: [
            {
              id,
              uri,
              page,
              text: text.trim(),
              source,
              color,
              note: note ?? "",
              createdAt: now,
              updatedAt: now,
            },
            ...s.items,
          ],
        }));
        return id;
      },

      setNote: (id, note) =>
        set((s) => ({
          items: s.items.map((a) =>
            a.id === id ? { ...a, note, updatedAt: Date.now() } : a,
          ),
        })),

      setColor: (id, color) =>
        set((s) => ({
          items: s.items.map((a) =>
            a.id === id ? { ...a, color, updatedAt: Date.now() } : a,
          ),
        })),

      // A tombstone, not a `filter`: the row has to outlive the delete long
      // enough for the server to hear about it, or the next pull hands it back.
      remove: (id) =>
        set((s) => {
          const doomed = s.items.find((a) => a.id === id);
          if (!doomed) return s;
          return {
            items: s.items.filter((a) => a.id !== id),
            deleted: [...s.deleted, entomb(doomed, Date.now())],
          };
        }),

      clearDocument: (uri) =>
        set((s) => {
          const doomed = s.items.filter((a) => a.uri === uri);
          if (!doomed.length) return s;
          const at = Date.now();
          return {
            items: s.items.filter((a) => a.uri !== uri),
            deleted: [...s.deleted, ...doomed.map((a) => entomb(a, at))],
          };
        }),

      // Both of these run on every sync and usually change nothing. Returning
      // the same array when that is so keeps the sync layer's own writes from
      // looking like a local edit and scheduling another round trip.
      setDocKeys: (byUri) =>
        set((s) => {
          const next = s.items.map((a) =>
            !a.docKey && byUri[a.uri] ? { ...a, docKey: byUri[a.uri] } : a,
          );
          return next.some((a, i) => a !== s.items[i]) ? { items: next } : s;
        }),

      attachUris: (byDocKey) =>
        set((s) => {
          const next = s.items.map((a) =>
            !a.uri && a.docKey && byDocKey[a.docKey]
              ? { ...a, uri: byDocKey[a.docKey] }
              : a,
          );
          return next.some((a, i) => a !== s.items[i]) ? { items: next } : s;
        }),

      applyRemote: (rows) =>
        set((s) => {
          const byId = new Map(s.items.map((a) => [a.id, a]));
          const buried = new Set<string>();

          for (const row of rows) {
            const local = byId.get(row.id);
            // An edit made while the round trip was in the air is newer than
            // anything in this response; it goes up on the next push instead.
            if (local && local.updatedAt > row.updatedAt) continue;

            if (row.deletedAt !== null) {
              byId.delete(row.id);
              buried.add(row.id);
              continue;
            }

            byId.set(row.id, {
              id: row.id,
              // The server has no uri to give back. Keep the one this device
              // already had; `attachUris` fills the rest in by docKey.
              uri: local?.uri ?? "",
              docKey: row.docKey,
              page: row.page,
              text: row.text,
              source: row.source,
              color: row.color,
              note: row.note,
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,
              syncedAt: row.updatedAt,
            });
          }

          return {
            items: [...byId.values()].sort((a, b) => b.createdAt - a.createdAt),
            // A delete that came back to us is a delete we no longer have to
            // announce — whichever device made it, the server already knows.
            deleted: s.deleted.filter((d) => !buried.has(d.id)),
          };
        }),

      markPushed: (versions, buried) =>
        set((s) => {
          const gone = new Set(buried);
          return {
            items: s.items.map((a) =>
              // Compared by value: an edit landing mid-push leaves `updatedAt`
              // ahead of what went out, and the row stays dirty.
              versions[a.id] === a.updatedAt
                ? { ...a, syncedAt: versions[a.id] }
                : a,
            ),
            deleted: s.deleted.filter((d) => !gone.has(d.id)),
          };
        }),

      reissueIds: (ids) =>
        set((s) => {
          const doomed = new Set(ids);
          const now = Date.now();
          return {
            items: s.items.map((a) =>
              doomed.has(a.id)
                ? { ...a, id: newId(), syncedAt: undefined, updatedAt: now }
                : a,
            ),
            // A colliding tombstone names a row that was never ours to delete.
            deleted: s.deleted.filter((d) => !doomed.has(d.id)),
          };
        }),
    }),
    {
      name: "lexipdf-annotations",
      storage: createJSONStorage(() => zustandStorage),
      // v0 predates syncing: rows have no `updatedAt`, and deletes were a
      // `filter` with nothing left behind. Seeding `updatedAt` from `createdAt`
      // makes every existing highlight and note push exactly once.
      version: 1,
      migrate: (persisted) => {
        const prior = persisted as { items?: Annotation[] } | undefined;
        return {
          items: (prior?.items ?? []).map((a) => ({
            ...a,
            updatedAt: a.updatedAt ?? a.createdAt,
            syncedAt: undefined,
          })),
          deleted: [],
        } as unknown as AnnotationsState;
      },
    },
  ),
);

/** Rows whose current version the server has not acknowledged. */
export function pendingAnnotations(state: AnnotationsState): Annotation[] {
  return state.items.filter((a) => a.syncedAt !== a.updatedAt);
}

/** This document's annotations, newest first. */
export function annotationsFor(items: Annotation[], uri: string): Annotation[] {
  return items.filter((a) => a.uri === uri);
}
