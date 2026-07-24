import { useEffect, useState } from "react";

export interface BookSuggestion {
  id: string;
  title: string;
  author: string;
  coverUrl?: string;
  readUrl: string;
  collection: string;
  kind: string;
}

interface Seed {
  q: string;
  collection: string;
  kind: string;
}

const SEED: Seed[] = [
  { q: "Pride and Prejudice Jane Austen", collection: "📖 Reading Later", kind: "Classic" },
  { q: "Frankenstein Mary Shelley", collection: "🔖 To Read", kind: "Classic" },
  { q: "The Adventures of Sherlock Holmes Doyle", collection: "💛 Favorites", kind: "Classic" },
];

export const SUGGESTION_COUNT = SEED.length;

let cache: BookSuggestion[] | null = null;

function formatAuthor(name?: string): string {
  if (!name) return "";
  const m = name.match(/^([^,]+),\s*(.+)$/);
  return m ? `${m[2]} ${m[1]}` : name;
}

async function fromGutenberg(seed: Seed): Promise<BookSuggestion | null> {
  const res = await fetch(
    `https://gutendex.com/books?search=${encodeURIComponent(seed.q)}`,
  );
  if (!res.ok) throw new Error(`gutendex ${res.status}`);
  const book = (await res.json()).results?.[0];
  if (!book) return null;
  const formats: Record<string, string> = book.formats ?? {};
  const readUrl = formats["text/html"] ?? formats["text/html; charset=utf-8"];
  if (!readUrl) return null;
  return {
    id: `gutenberg-${book.id}`,
    title: book.title ?? seed.q,
    author: formatAuthor(book.authors?.[0]?.name),
    coverUrl: formats["image/jpeg"],
    readUrl,
    collection: seed.collection,
    kind: seed.kind,
  };
}

async function resolveSeed(seed: Seed): Promise<BookSuggestion> {
  try {
    const hit = await fromGutenberg(seed);
    if (hit) return hit;
  } catch {}
  return {
    id: seed.q,
    title: seed.q,
    author: "",
    readUrl: "",
    collection: seed.collection,
    kind: seed.kind,
  };
}

export function useBookSuggestions(): {
  suggestions: BookSuggestion[];
  loading: boolean;
} {
  const [suggestions, setSuggestions] = useState<BookSuggestion[]>(() => cache ?? []);
  const [loading, setLoading] = useState(cache === null);

  useEffect(() => {
    if (cache) return;
    let cancelled = false;
    Promise.all(SEED.map(resolveSeed)).then((list) => {
      cache = list;
      if (!cancelled) {
        setSuggestions(list);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { suggestions, loading };
}
