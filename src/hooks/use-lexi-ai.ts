/**
 * Bindings for the AI endpoints.
 *
 * Both the word card and chat stream their answer, so the reader watches it
 * arrive instead of waiting on a spinner. The card is still cache-backed —
 * the same word on the same page is the same answer, so looking it up twice
 * should cost one request and be instant the second time.
 *
 * Both funnel a spent allowance into the auth store, which is what raises the
 * sign-in wall, so no screen has to remember to do it.
 */
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
 * The word card's lookup, streamed — fields appear as the model writes them
 * instead of the card waiting on the whole answer. Named for the word rather
 * than "translation": `useTranslation` is react-i18next's, and this file would
 * be the one place in the app where that import means something else.
 *
 * Cache-backed: a finished card is written into a react-query entry, so
 * re-opening a word you've already looked up renders instantly and costs
 * nothing — a cached card never opens a stream.
 */
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
  // The key is what identifies a lookup; serialising it gives the effect below
  // a stable dependency instead of a fresh array identity every render.
  const keyId = key ? JSON.stringify(key) : null;

  // Everything the stream has produced, tagged with the lookup it belongs to.
  // Carrying the id in the state itself is what lets a word change be handled
  // during render — state for the previous word is simply ignored — instead of
  // being reset from the effect, which would cascade an extra render.
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
  // A word looked up before is already in the cache: render it and never open
  // a stream for it.
  const cached = key ? queryClient.getQueryData<TranslateResult>(key) : undefined;
  const data = cached ?? current.data;

  useEffect(() => {
    if (!input || !key || queryClient.getQueryData(key)) return;

    let live = true;
    // Every update carries `keyId`, so a frame that lands after the reader has
    // moved to another word can't be mistaken for that word's card.
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
      // Resolved after an unmount or a word change — cancel it rather than
      // leaving the connection open.
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
    /** True while fields are still arriving. */
    streaming: data === null && current.error === null && input !== null,
  };
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
