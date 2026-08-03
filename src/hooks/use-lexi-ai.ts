import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  AiQuotaError,
  chat,
  streamTranslate,
  type ChatInput,
  type ChatReply,
  type PartialCard,
  type TranslateField,
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

export function useWordLookupStream(
  input: Omit<TranslateInput, "style" | "targetLang"> | null,
) {
  const lang = useAppStore((s) => s.lang);
  const style = useAppStore((s) => s.explStyle);
  const setQuota = useAuthStore((s) => s.setQuota);
  const sinkQuota = useQuotaSink();
  const queryClient = useQueryClient();

  const key = input
    ? queryKeys.translate(input.text, input.page, lang, style)
    : null;
  const keyId = key ? JSON.stringify(key) : null;

  const [state, setState] = useState<{
    keyId: string | null;
    partial: PartialCard;
    data: TranslateResult | null;
    error: unknown;
  }>({ data: null, error: null, keyId: null, partial: {} });
  const abortRef = useRef<(() => void) | null>(null);

  const current =
    state.keyId === keyId
      ? state
      : { data: null, error: null, keyId, partial: {} as PartialCard };
  const cached = key ? queryClient.getQueryData<TranslateResult>(key) : undefined;
  const data = cached ?? current.data;

  useEffect(() => {
    if (!input || !key || queryClient.getQueryData(key)) return;

    let live = true;
    const update = (
      patch: Partial<{
        partial: PartialCard;
        data: TranslateResult | null;
        error: unknown;
      }>,
      mergeField?: { field: TranslateField; value: string },
    ) =>
      setState((prev) => {
        const base =
          prev.keyId === keyId
            ? prev
            : { data: null, error: null, keyId, partial: {} as PartialCard };
        return {
          ...base,
          ...patch,
          keyId,
          partial: mergeField
            ? { ...base.partial, [mergeField.field]: mergeField.value }
            : (patch.partial ?? base.partial),
        };
      });

    void streamTranslate(
      { ...input, style, targetLang: lang },
      {
        onField: (field, value) => {
          if (live) update({}, { field, value });
        },
        onDone: (result) => {
          if (!live) return;
          abortRef.current = null;
          update({ data: result, error: null });
          if (result.quota) setQuota(result.quota);
          queryClient.setQueryData(key, result);
        },
        onError: (streamError) => {
          if (!live) return;
          abortRef.current = null;
          update({ error: streamError });
          sinkQuota(streamError);
        },
      },
    ).then((abort) => {
      if (live) abortRef.current = abort;
      else abort();
    });

    return () => {
      live = false;
      abortRef.current?.();
      abortRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyId]);

  return {
    data,
    error: current.error,
    isError: current.error !== null,
    partial: current.partial,
    quotaBlocked: current.error instanceof AiQuotaError,
    streaming: data === null && current.error === null && input !== null,
  };
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
