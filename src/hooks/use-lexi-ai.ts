/**
 * react-query bindings for the AI endpoints.
 *
 * Translation is a query — the same word on the same page is the same answer,
 * so looking it up twice should cost one request and be instant the second
 * time. Chat is a mutation: every message is a new, billable turn.
 *
 * Both funnel a spent allowance into the auth store, which is what raises the
 * sign-in wall, so no screen has to remember to do it.
 */
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect } from "react";

import {
  AiQuotaError,
  chat,
  translate,
  type ChatInput,
  type ChatReply,
  type TranslateInput,
  type TranslateResult,
} from "@/services/lexi-ai";
import { queryKeys } from "@/services/query-client";
import { useAppStore } from "@/stores/app-store";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Records what a call reported, and raises the wall when the allowance is out.
 * Returns true when the error was the wall, so callers can stop there.
 */
function useQuotaSink() {
  const setQuota = useAuthStore((s) => s.setQuota);
  const openWall = useAuthStore((s) => s.openWall);

  return useCallback(
    (error: unknown): error is AiQuotaError => {
      if (!(error instanceof AiQuotaError)) return false;
      setQuota(error.quota);
      if (error.requiresAuth) openWall("quota");
      return true;
    },
    [openWall, setQuota],
  );
}

/**
 * The word card's lookup. Idle until there's something selected. Named for the
 * word rather than "translation" — `useTranslation` is react-i18next's, and
 * this file would be the one place in the app where that import means
 * something else.
 */
export function useWordLookup(
  input: Omit<TranslateInput, "style" | "targetLang"> | null,
) {
  const lang = useAppStore((s) => s.lang);
  const style = useAppStore((s) => s.explStyle);
  const setQuota = useAuthStore((s) => s.setQuota);
  const sinkQuota = useQuotaSink();

  const query = useQuery<TranslateResult>({
    enabled: input !== null,
    queryFn: async () => {
      const result = await translate({ ...input!, style, targetLang: lang });
      setQuota(result.quota);
      return result;
    },
    queryKey: queryKeys.translate(input?.text ?? "", input?.page ?? 0, lang, style),
  });

  // react-query hands the same error back on every render, so the wall goes up
  // from an effect rather than during one — it sets state in another store.
  const { error } = query;
  useEffect(() => {
    if (error) sinkQuota(error);
  }, [error, sinkQuota]);

  return { ...query, quotaBlocked: error instanceof AiQuotaError };
}

/** One chat turn. */
export function useLexiChat() {
  const setQuota = useAuthStore((s) => s.setQuota);
  const sinkQuota = useQuotaSink();

  return useMutation<ChatReply, unknown, ChatInput>({
    mutationFn: async (input) => {
      const reply = await chat(input);
      setQuota(reply.quota);
      return reply;
    },
    onError: (error) => {
      sinkQuota(error);
    },
  });
}
