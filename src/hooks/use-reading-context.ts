import { useEffect, useState } from "react";
import type { LexiBook } from "@/components/reader/lexi";

export function useReadingContext(book: LexiBook): LexiBook {
  const { docKey, page, title, uri, chapter, excerpt, source } = book;
  const [settled, setSettled] = useState<LexiBook>(book);
  useEffect(() => {
    const timer = setTimeout(
      () => {
        setSettled((previous) => ({
          docKey,
          page,
          title,
          uri,
          chapter,
          excerpt: excerpt?.slice(0, 4000),
          source,
          recent:
            previous.docKey === docKey &&
            previous.excerpt &&
            (previous.page !== page || previous.excerpt !== excerpt)
              ? {
                  page: previous.page,
                  excerpt: previous.excerpt.slice(0, 1000),
                }
              : previous.docKey === docKey
              ? previous.recent
              : undefined,
        }));
      },
      source === "selection" ? 150 : 500,
    );
    return () => clearTimeout(timer);
  }, [chapter, docKey, excerpt, page, source, title, uri]);
  return settled.docKey === docKey
    ? settled
    : { ...book, excerpt: "", recent: undefined };
}
