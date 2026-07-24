import PdfPageImage from 'react-native-pdf-page-image';
import { useEffect, useState } from 'react';

const cache = new Map<string, string>();
const failed = new Set<string>();

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
    schedule(() => PdfPageImage.generate(uri, 0, 1))
      .then((page) => {
        cache.set(uri, page.uri);
        if (!cancelled) setThumb(page.uri);
      })
      .catch(() => {
        failed.add(uri);
      });

    return () => {
      cancelled = true;
    };
  }, [uri, isPdf]);

  return thumb;
}
