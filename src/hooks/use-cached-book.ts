import { Directory, File, Paths } from "expo-file-system";
import { useCallback, useEffect, useState } from "react";

const BOOK_DIR = "books";

function keyFor(url: string): string {
  let hash = 5381;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) + hash + url.charCodeAt(i)) | 0;
  }
  return `book-${(hash >>> 0).toString(36)}`;
}

function fileFor(url: string): File {
  return new File(Paths.cache, BOOK_DIR, `${keyFor(url)}.html`);
}

function withBase(html: string, url: string): string {
  const base = `<base href="${url}">`;
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${base}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html([^>]*)>/i, `<html$1><head>${base}</head>`);
  }
  return `<head>${base}</head>${html}`;
}

export interface CachedBook {
  uri: string | undefined;
  fromCache: boolean;
  refresh: () => void;
}

export function useCachedBook(url?: string): CachedBook {
  const [cachedUri, setCachedUri] = useState<string | undefined>(() => {
    if (!url) return undefined;
    try {
      const file = fileFor(url);
      return file.exists ? file.uri : undefined;
    } catch {
      return undefined;
    }
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!url || cachedUri) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) return;
        const html = await res.text();
        if (cancelled) return;

        new Directory(Paths.cache, BOOK_DIR).create({
          idempotent: true,
          intermediates: true,
        });
        const file = fileFor(url);
        file.create({ intermediates: true, overwrite: true });
        file.write(withBase(html, url));
        if (!cancelled) setCachedUri(file.uri);
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [attempt, cachedUri, url]);

  const refresh = useCallback(() => {
    if (!url) return;
    try {
      const file = fileFor(url);
      if (file.exists) file.delete();
    } catch {}
    setCachedUri(undefined);
    setAttempt((n) => n + 1);
  }, [url]);

  return { fromCache: cachedUri != null, refresh, uri: cachedUri ?? url };
}
