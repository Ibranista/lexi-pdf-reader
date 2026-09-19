import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { palette } from "@/constants/colors";
import { zustandStorage } from "@/utils/storage";

export type HighlightColor = "amber" | "rose" | "sage" | "sky";

export const HIGHLIGHT_COLORS: { key: HighlightColor; label: string }[] = [
  { key: "amber", label: "Amber" },
  { key: "sage", label: "Sage" },
  { key: "sky", label: "Sky" },
  { key: "rose", label: "Rose" },
];

export const HIGHLIGHT_FILL: Record<HighlightColor, string> = {
  amber: palette.pen.amber,
  sage: palette.pen.sage,
  sky: palette.pen.sky,
  rose: palette.pen.rose,
};

export interface PassageContext {
  prefix: string;
  suffix: string;
}

export interface Annotation extends Partial<PassageContext> {
  id: string;
  uri: string;
  docKey?: string;
  page: number;
  text: string;
  source?: string;
  color: HighlightColor;
  note: string;
  createdAt: number;
  updatedAt: number;
  syncedAt?: number;
}

export type Tombstone = Omit<Annotation, "syncedAt" | "uri"> & {
  deletedAt: number;
};

export interface RemoteAnnotation extends Partial<PassageContext> {
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
  deleted: Tombstone[];
  add: (
    input: {
      uri: string;
      page: number;
      text: string;
      source?: string;
      color: HighlightColor;
      note?: string;
    } & Partial<PassageContext>,
  ) => string;
  setNote: (id: string, note: string) => void;
  setColor: (id: string, color: HighlightColor) => void;
  remove: (id: string) => void;
  clearDocument: (uri: string) => void;

  setDocKeys: (byUri: Record<string, string>) => void;
  attachUris: (byDocKey: Record<string, string>) => void;
  applyRemote: (rows: RemoteAnnotation[]) => void;
  markPushed: (versions: Record<string, number>, buried: string[]) => void;
  reissueIds: (ids: string[]) => void;
}

let seq = 0;
const newId = () => `${Date.now().toString(36)}-${(seq++).toString(36)}`;

const entomb = (a: Annotation, deletedAt: number): Tombstone => ({
  id: a.id,
  docKey: a.docKey,
  page: a.page,
  text: a.text,
  prefix: a.prefix,
  suffix: a.suffix,
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

      add: ({ uri, page, text, prefix, suffix, source, color, note }) => {
        const id = newId();
        const now = Date.now();
        set((s) => ({
          items: [
            {
              id,
              uri,
              page,
              text: text.trim(),
              prefix: prefix || undefined,
              suffix: suffix || undefined,
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
            if (local && local.updatedAt > row.updatedAt) continue;

            if (row.deletedAt !== null) {
              byId.delete(row.id);
              buried.add(row.id);
              continue;
            }

            byId.set(row.id, {
              id: row.id,
              uri: local?.uri ?? "",
              docKey: row.docKey,
              page: row.page,
              text: row.text,
              prefix: row.prefix ?? local?.prefix,
              suffix: row.suffix ?? local?.suffix,
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
            deleted: s.deleted.filter((d) => !buried.has(d.id)),
          };
        }),

      markPushed: (versions, buried) =>
        set((s) => {
          const gone = new Set(buried);
          return {
            items: s.items.map((a) =>
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
            deleted: s.deleted.filter((d) => !doomed.has(d.id)),
          };
        }),
    }),
    {
      name: "lexipdf-annotations",
      storage: createJSONStorage(() => zustandStorage),
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

export function pendingAnnotations(state: AnnotationsState): Annotation[] {
  return state.items.filter((a) => a.syncedAt !== a.updatedAt);
}

export function annotationsFor(items: Annotation[], uri: string): Annotation[] {
  return items.filter((a) => a.uri === uri);
}
