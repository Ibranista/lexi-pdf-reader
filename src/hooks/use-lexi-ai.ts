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

  const { error } = query;
  useEffect(() => {
    if (error) sinkQuota(error);
  }, [error, sinkQuota]);

  return { ...query, quotaBlocked: error instanceof AiQuotaError };
}

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
