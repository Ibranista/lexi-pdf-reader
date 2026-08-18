import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { checkPage, type FlaggedClaim } from "@/services/fact-check";
import { useAppStore } from "@/stores/app-store";

const SETTLE_MS = 1500;

export interface PageCheckResult {
  claims: FlaggedClaim[];
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
  text: string;
  title?: string;
  author?: string;
}): PageCheckResult {
  const on = useAppStore((s) => s.factCheck);
  const aiOn = useAppStore((s) => s.aiOn);

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
    queryKey: ["page-check", docKey, page, text.length],
    staleTime: Infinity,
  });

  return {
    checking: ready && isFetching,
    claims: data?.claims ?? [],
  };
}
