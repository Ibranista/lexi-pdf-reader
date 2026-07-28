/**
 * The app's single QueryClient.
 *
 * Defaults are tuned for a reader that is often offline and always on a phone:
 * nothing refetches because a window regained focus (there are no windows), and
 * a failed request is retried once rather than four times, so a card shows its
 * error state while the reader is still looking at it.
 *
 * Auth, refresh and error shaping all live in the axios interceptors
 * (src/utils/axios.ts) — query functions call `api` and stay ignorant of tokens.
 */
import { QueryClient } from "@tanstack/react-query";

import { asQuotaError } from "./lexi-ai";

export const queryClient = new QueryClient({
  defaultOptions: {
    mutations: {
      // A refused AI call is refused; retrying spends nothing but time.
      retry: (count, error) => count < 1 && !asQuotaError(error),
    },
    queries: {
      gcTime: 30 * 60 * 1000,
      refetchOnReconnect: true,
      // React Native has no window focus to react to.
      refetchOnWindowFocus: false,
      // Out of credits is a final answer, not a blip.
      retry: (count, error) => count < 1 && !asQuotaError(error),
      staleTime: 5 * 60 * 1000,
    },
  },
});

/** Namespaced so a document's cached AI answers can be dropped in one call. */
export const queryKeys = {
  bookSuggestions: (interests: readonly string[]) =>
    ["book-suggestions", [...interests].sort().join(",")] as const,
  translate: (text: string, page: number, lang: string, style: string) =>
    ["translate", text.trim().toLowerCase(), page, lang, style] as const,
};
