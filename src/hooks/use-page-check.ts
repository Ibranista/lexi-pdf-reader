/**
 * Checks the page the reader is actually on, once they have settled on it.
 *
 * Paging through a book fires a page change per page. Checking each one would
 * spend a credit on pages nobody read, so this waits for the reader to stop —
 * the same idea as not saving a draft on every keystroke. Results are cached by
 * react-query, so turning back a page is free.
 */
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { checkPage, type FlaggedClaim } from "@/services/fact-check";
import { useAppStore } from "@/stores/app-store";

/**
 * How long a page has to stay in view before it is worth reading.
 *
 * Long enough that flicking through a chapter to find something costs nothing,
 * short enough that a reader who has settled isn't left waiting for marks that
 * arrive after they have moved on.
 */
const SETTLE_MS = 1500;

export interface PageCheckResult {
  claims: FlaggedClaim[];
  /** A check is in flight for the page in view. */
  checking: boolean;
}

export function usePageCheck({
  author,
  docKey,
  page,
  text,
  title,
}: {
  docKey: string;
  page: number;
  /** The page's extracted text; empty until the reflow view has it. */
  text: string;
  title?: string;
  author?: string;
}): PageCheckResult {
  const on = useAppStore((s) => s.factCheck);
  const aiOn = useAppStore((s) => s.aiOn);

  // The page the reader has stayed on, which lags the page they are passing.
  const [settled, setSettled] = useState<number | null>(null);

  useEffect(() => {
    if (!on || !aiOn) return;
    const timer = setTimeout(() => setSettled(page), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [aiOn, on, page]);

  const ready = on && aiOn && settled === page && Boolean(docKey) && text.length > 0;

  const { data, isFetching } = useQuery({
    enabled: ready,
    queryFn: () => checkPage({ author, docKey, page, text, title }),
    // Keyed on the text, not just the page number: a page re-extracted
    // differently is a different page, and the server keys its cache the same
    // way. Length stands in for the text so the key stays small.
    queryKey: ["page-check", docKey, page, text.length],
    // A page's claims do not change while the app is open, and the server
    // remembers them anyway.
    staleTime: Infinity,
  });

  return {
    checking: ready && isFetching,
    claims: data?.claims ?? [],
  };
}
