/**
 * Fetches the handful of real, *readable* books shown in the library's
 * "Auto-filled for you" section. Each suggestion carries a `readUrl` that opens
 * the full book in the in-app web reader (see app/(tabs)/book.tsx), so tapping
 * one reads the whole text in the app.
 *
 * The picks are public-domain classics served by Project Gutenberg via the
 * keyless Gutendex API (https://gutendex.com): a clean, full-text HTML page
 * plus a cover, both loaded straight into a WebView. (We tried streaming
 * library PDFs from the Internet Archive so the books could open in the native
 * PDF reader, but react-native-pdf can't fetch those redirected multi-MB scans
 * on-device — the web page loads reliably, so that's what we use.)
 *
 * Same fetch-on-mount + module-cache shape as use-pdf-thumbnail, since the app
 * has no react-query provider wired up.
 */
import { useEffect, useState } from "react";

export interface BookSuggestion {
  /** Stable id from the source (used as a React key). */
  id: string;
  title: string;
  author: string;
  /** Remote cover art. */
  coverUrl?: string;
  /** Full-book HTML page opened in the in-app web reader; "" if none found. */
  readUrl: string;
  /** The collection the app would file it under, e.g. "📖 Reading Later". */
  collection: string;
  /** Badge label — "Classic", "Novel", … */
  kind: string;
}

interface Seed {
  q: string;
  collection: string;
  kind: string;
}

/** Curated public-domain picks — the API supplies covers, read links & titles. */
const SEED: Seed[] = [
  { q: "Pride and Prejudice Jane Austen", collection: "📖 Reading Later", kind: "Classic" },
  { q: "Frankenstein Mary Shelley", collection: "🔖 To Read", kind: "Classic" },
  { q: "The Adventures of Sherlock Holmes Doyle", collection: "💛 Favorites", kind: "Classic" },
];

/** Number of skeleton rows to show while the first fetch is in flight. */
export const SUGGESTION_COUNT = SEED.length;

/** Resolved once per app session — the picks don't change between mounts. */
let cache: BookSuggestion[] | null = null;

/**
 * Query parameter a suggested book's cover rides in on. A filed book is stored
 * as a plain `{ uri, name, ext }` like any device document, so there's nowhere
 * to keep a separate cover — packing it into the uri means the thumbnail can be
 * rendered from the filed row alone, with no second lookup.
 */
const COVER_PARAM = 'lexiCover';

const COVER_RE = new RegExp(`[?&]${COVER_PARAM}=([^&]+)`);

/** The uri to file a suggested book under — its readable page plus its cover. */
export function bookDocUri(
  book: Pick<BookSuggestion, 'coverUrl' | 'readUrl'>,
): string {
  if (!book.coverUrl) return book.readUrl;
  const sep = book.readUrl.includes('?') ? '&' : '?';
  return `${book.readUrl}${sep}${COVER_PARAM}=${encodeURIComponent(book.coverUrl)}`;
}

/**
 * The cover packed into a uri by `bookDocUri`, if there is one. Device
 * documents (`file://…`) carry none, so callers fall back to a format badge.
 */
/** The readable page inside a uri built by `bookDocUri` — the cover stripped
 *  back off, so what we hand the WebView is the book's own url. */
export function bookReadUrl(uri: string): string {
  // Keep the '?' when the cover was the first parameter, or a later one would
  // be left dangling after the host; drop it if nothing follows.
  const stripped = uri.replace(COVER_RE, (match) =>
    match[0] === '?' ? '?' : '',
  );
  return stripped.replace('?&', '?').replace(/\?$/, '');
}

export function bookCoverFromUri(uri: string): string | undefined {
  const match = COVER_RE.exec(uri);
  if (!match) return undefined;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    // malformed percent-encoding — treat it as no cover rather than throwing
    // inside a render, which is what took the whole library down before.
    return undefined;
  }
}

/** Gutenberg lists authors "Last, First"; show them the way people say them. */
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
  } catch {
    // source unreachable — keep the curated framing, drop cover + read
  }
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
