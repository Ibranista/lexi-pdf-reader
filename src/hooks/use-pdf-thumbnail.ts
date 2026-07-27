/**
 * Lazily renders the first page of a PDF to a cached PNG for use as a cover
 * thumbnail. Backed by the native PdfRenderer (Android) / PDFKit (iOS) via
 * react-native-pdf-page-image.
 *
 * Only PDFs are supported — other document types keep their format badge.
 * Results are cached per-uri, and generation is concurrency-limited so a
 * large library doesn't spawn hundreds of native renders at once.
 */
import PdfPageImage from 'react-native-pdf-page-image';
import { useEffect, useState } from 'react';

/** Rendered thumbnail uri per source pdf uri (survives remounts/scroll). */
const cache = new Map<string, string>();
/** Uris we've already tried and that failed — don't retry every mount. */
const failed = new Set<string>();

/** How many pages to render at once. */
const MAX_CONCURRENT = 3;
let active = 0;
const queue: (() => void)[] = [];

function pump() {
  while (active < MAX_CONCURRENT && queue.length > 0) {
    const job = queue.shift()!;
    active += 1;
    job();
  }
}

function schedule<T>(work: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push(() => {
      work()
        .then(resolve, reject)
        .finally(() => {
          active -= 1;
          pump();
        });
    });
    pump();
  });
}

export function usePdfThumbnail(uri: string, isPdf: boolean): string | null {
  const [thumb, setThumb] = useState<string | null>(() => cache.get(uri) ?? null);

  useEffect(() => {
    if (!isPdf) return;
    const cached = cache.get(uri);
    if (cached) {
      setThumb(cached);
      return;
    }
    if (failed.has(uri)) return;

    let cancelled = false;
    // Page index is 0-based on both platforms (Android PdfRenderer.openPage /
    // iOS PDFDocument.page(at:)), so 0 is the first page — 1 rendered the 2nd.
    schedule(() => PdfPageImage.generate(uri, 0, 1))
      .then((page) => {
        cache.set(uri, page.uri);
        if (!cancelled) setThumb(page.uri);
      })
      .catch(() => {
        // corrupt, encrypted, or unreadable — fall back to the badge
        failed.add(uri);
      });

    return () => {
      cancelled = true;
    };
  }, [uri, isPdf]);

  return thumb;
}
