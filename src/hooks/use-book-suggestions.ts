/**
 * Fetches the handful of real, *readable* books shown in the library's
 * "Auto-filled for you" section. Each suggestion carries a `readUrl` that opens
 * the full book in the in-app web reader (see app/(tabs)/book.tsx), so tapping
 * one reads the whole text in the app.
 *
 * Picks come from our own API, tailored to what the reader chose in onboarding.
 * Until that endpoint exists — and whenever it can't be reached — this falls
 * back to curated public-domain classics from the keyless Gutendex API
 * (https://gutendex.com): a clean, full-text HTML page plus a cover, both
 * loaded straight into a WebView. (We tried streaming library PDFs from the
 * Internet Archive so the books could open in the native PDF reader, but
 * react-native-pdf can't fetch those redirected multi-MB scans on-device — the
 * web page loads reliably, so that's what we use.)
 */
import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";

import type { ReadingInterest } from "@/constants/onboarding";
import { queryKeys } from "@/services/query-client";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { api } from "@/utils/axios";

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
const SEED: Seed[] = [];

/** Number of skeleton rows to show while the first fetch is in flight. */
export const SUGGESTION_COUNT = 5;

/**
 * Query parameter a suggested book's cover rides in on. A filed book is stored
 * as a plain `{ uri, name, ext }` like any device document, so there's nowhere
 * to keep a separate cover — packing it into the uri means the thumbnail can be
 * rendered from the filed row alone, with no second lookup.
 */
const COVER_PARAM = "lexiCover";

const COVER_RE = new RegExp(`[?&]${COVER_PARAM}=([^&]+)`);

/** The uri to file a suggested book under — its readable page plus its cover. */
export function bookDocUri(
  book: Pick<BookSuggestion, "coverUrl" | "readUrl">,
): string {
  if (!book.coverUrl) return book.readUrl;
  const sep = book.readUrl.includes("?") ? "&" : "?";
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
    match[0] === "?" ? "?" : "",
  );
  return stripped.replace("?&", "?").replace(/\?$/, "");
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

/**
 * Personalised picks from our own API (`GET /book-suggestions`, see prompt.md),
 * falling back to the curated Gutenberg seeds when it isn't reachable — which
 * is every build until the backend ships, and any build a reader opens offline.
 */
async function fetchSuggestions(
  interests: readonly ReadingInterest[],
  refreshes: number,
): Promise<BookSuggestion[]> {
  try {
    const { data } = await api.get<{ suggestions: BookSuggestion[] }>(
      "/book-suggestions",
      {
        params: {
          interests: interests.length ? interests.join(",") : undefined,
          limit: SUGGESTION_COUNT,
          // How many times this reader has asked for a different shelf. Same
          // interests would otherwise be the same question, so the backend can
          // rotate its picks off this rather than replaying the first five.
          // Deliberately not part of the query key: bumping it must not throw
          // away the cached shelf we're still showing.
          refresh: refreshes || undefined,
        },
      },
    );
    if (data.suggestions?.length) return data.suggestions;
  } catch {
    // no backend yet, or offline — the seeds below still read as a shelf
  }
  const seeded = await Promise.all(SEED.map(resolveSeed));
  if (seeded.length) return seeded;
  // Nothing reachable and nothing curated to fall back on. Failing the query
  // beats resolving to an empty array: the shelf can then say *why* it's empty
  // and offer a retry, instead of leaving a blank gap under the heading.
  throw new Error("no-suggestions");
}

export function useBookSuggestions(): {
  suggestions: BookSuggestion[];
  /** First load, nothing to show yet — render skeleton rows. */
  loading: boolean;
  /** The picks couldn't be fetched (usually: no connection). */
  failed: boolean;
  /** A retry is in flight over an already-settled shelf. */
  refreshing: boolean;
  /** Re-ask for picks — the refresh icon and the "suggest me now" button. */
  refresh: () => void;
} {
  // What the reader said they read, in onboarding. Re-picking them is a new
  // query key, so the shelf refreshes rather than showing the old cache.
  const interests = useOnboardingStore((s) => s.interests);
  // Bumped by `refresh`, read inside the query function. A ref, not state, so
  // asking for new picks doesn't re-render before the fetch even starts.
  const refreshes = useRef(0);

  const { data, isError, isFetching, isPending, refetch } = useQuery({
    queryFn: () => fetchSuggestions(interests, refreshes.current),
    queryKey: queryKeys.bookSuggestions(interests),
    // The picks don't change on their own while the app is open — only when the
    // reader asks. `refetch` ignores staleTime, so the refresh control always
    // reaches the network; a plain remount keeps showing the cached shelf.
    staleTime: Infinity,
  });

  return {
    failed: isError,
    loading: isPending,
    refresh: () => {
      refreshes.current += 1;
      void refetch();
    },
    // A fetch over a shelf that has already settled once — either a shelf we're
    // still showing, or one that errored. `isPending` is only ever the very
    // first load, so the two never overlap.
    refreshing: isFetching && !isPending,
    // React Query keeps the last successful data through an error, so a refresh
    // that fails leaves the reader's existing picks on screen.
    suggestions: data ?? [],
  };
}
