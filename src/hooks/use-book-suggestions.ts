import { useQuery } from "@tanstack/react-query";

import type { ReadingInterest } from "@/constants/onboarding";
import { queryKeys } from "@/services/query-client";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { api } from "@/utils/axios";

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

const SEED: Seed[] = [];

export const SUGGESTION_COUNT = 5;

const COVER_PARAM = "lexiCover";

const COVER_RE = new RegExp(`[?&]${COVER_PARAM}=([^&]+)`);

export function bookDocUri(
  book: Pick<BookSuggestion, "coverUrl" | "readUrl">,
): string {
  if (!book.coverUrl) return book.readUrl;
  const sep = book.readUrl.includes("?") ? "&" : "?";
  return `${book.readUrl}${sep}${COVER_PARAM}=${encodeURIComponent(book.coverUrl)}`;
}

export function bookReadUrl(uri: string): string {
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
    return undefined;
  }
}

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

async function fetchSuggestions(
  interests: readonly ReadingInterest[],
): Promise<BookSuggestion[]> {
  try {
    const { data } = await api.get<{ suggestions: BookSuggestion[] }>(
      "/book-suggestions",
      {
        params: {
          interests: interests.length ? interests.join(",") : undefined,
          limit: SUGGESTION_COUNT,
        },
      },
    );
    if (data.suggestions?.length) return data.suggestions;
  } catch {}
  return Promise.all(SEED.map(resolveSeed));
}

export function useBookSuggestions(): {
  suggestions: BookSuggestion[];
  loading: boolean;
} {
  const interests = useOnboardingStore((s) => s.interests);

  const { data, isPending } = useQuery({
    queryFn: () => fetchSuggestions(interests),
    queryKey: queryKeys.bookSuggestions(interests),
    staleTime: Infinity,
  });

  return { suggestions: data ?? [], loading: isPending };
}
