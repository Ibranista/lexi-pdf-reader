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
  /** Document this belongs to. */
  uri: string;
  /** 1-based page the passage was selected on. */
  page: number;
  /** The selected passage itself. */
  text: string;
  color: HighlightColor;
  /** Empty for a plain highlight. */
  note: string;
  createdAt: number;
}

interface AnnotationsState {
  items: Annotation[];
  /** Returns the new annotation's id, so the caller can open a note on it. */
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
  /** Drops everything for a document — used when it's removed from the library. */
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

/** This document's annotations, newest first. */
export function annotationsFor(items: Annotation[], uri: string): Annotation[] {
  return items.filter((a) => a.uri === uri);
}
