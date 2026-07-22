import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { zustandStorage } from "@/utils/storage";

export type HighlightColor = "amber" | "rose" | "sage" | "sky";

export const HIGHLIGHT_COLORS: { key: HighlightColor; label: string }[] = [
  { key: "amber", label: "Amber" },
  { key: "sage", label: "Sage" },
  { key: "sky", label: "Sky" },
  { key: "rose", label: "Rose" },
];

export const HIGHLIGHT_FILL: Record<HighlightColor, string> = {
  amber: "#EFC57E",
  sage: "#B4D4B4",
  sky: "#AECBE8",
  rose: "#E8B8B4",
};

export interface Annotation {
  id: string;
  uri: string;
  page: number;
  text: string;
  color: HighlightColor;
  note: string;
  createdAt: number;
}

interface AnnotationsState {
  items: Annotation[];
  add: (input: {
    uri: string;
    page: number;
    text: string;
    color: HighlightColor;
    note?: string;
  }) => string;
  setNote: (id: string, note: string) => void;
  setColor: (id: string, color: HighlightColor) => void;
  remove: (id: string) => void;
  clearDocument: (uri: string) => void;
}

let seq = 0;
const newId = () => `${Date.now().toString(36)}-${(seq++).toString(36)}`;

export const useAnnotationsStore = create<AnnotationsState>()(
  persist(
    (set) => ({
      items: [],

      add: ({ uri, page, text, color, note }) => {
        const id = newId();
        set((s) => ({
          items: [
            {
              id,
              uri,
              page,
              text: text.trim(),
              color,
              note: note ?? "",
              createdAt: Date.now(),
            },
            ...s.items,
          ],
        }));
        return id;
      },

      setNote: (id, note) =>
        set((s) => ({
          items: s.items.map((a) => (a.id === id ? { ...a, note } : a)),
        })),

      setColor: (id, color) =>
        set((s) => ({
          items: s.items.map((a) => (a.id === id ? { ...a, color } : a)),
        })),

      remove: (id) =>
        set((s) => ({ items: s.items.filter((a) => a.id !== id) })),

      clearDocument: (uri) =>
        set((s) => ({ items: s.items.filter((a) => a.uri !== uri) })),
    }),
    {
      name: "lexipdf-annotations",
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
);

export function annotationsFor(items: Annotation[], uri: string): Annotation[] {
  return items.filter((a) => a.uri === uri);
}
