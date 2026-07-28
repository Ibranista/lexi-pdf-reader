import { QueryClient } from "@tanstack/react-query";

import { asQuotaError } from "./lexi-ai";

export const queryClient = new QueryClient({
  defaultOptions: {
    mutations: {
      retry: (count, error) => count < 1 && !asQuotaError(error),
    },
    queries: {
      gcTime: 30 * 60 * 1000,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
      retry: (count, error) => count < 1 && !asQuotaError(error),
      staleTime: 5 * 60 * 1000,
    },
  },
});

export const queryKeys = {
  bookSuggestions: (interests: readonly string[]) =>
    ["book-suggestions", [...interests].sort().join(",")] as const,
  translate: (text: string, page: number, lang: string, style: string) =>
    ["translate", text.trim().toLowerCase(), page, lang, style] as const,
};
