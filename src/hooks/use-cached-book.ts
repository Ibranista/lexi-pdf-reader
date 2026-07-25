/**
 * Keeps a suggested book's HTML on disk so reopening it doesn't re-download
 * the whole thing. A Gutenberg book is several hundred KB of markup, and the
 * reader was fetching it again on every open — slow on a good connection and
 * useless on none.
 *
 * Only the markup is cached. The book's images stay remote, resolved through a
 * `<base>` tag pointing at the original url — without it every relative
 * `images/…` src would break the moment the page is served from `file://`.
 */
import { Directory, File, Paths } from "expo-file-system";
import { useCallback, useEffect, useState } from "react";

/** Where cached books live, under the OS cache dir so the system can reclaim it. */
const BOOK_DIR = "books";

/** Stable, filesystem-safe name for a url — djb2, which is plenty here. */
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

/** Points relative urls (images, stylesheets) back at the book's own host. */
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
  /** What to hand the WebView — the cached file once there is one, else the url. */
  uri: string | undefined;
  /** True once the book is being served from disk. */
  fromCache: boolean;
  /** Drops the cached copy and downloads it again (pull-to-refresh). */
  refresh: () => void;
}

export function useCachedBook(url?: string): CachedBook {
  // Checked synchronously so a book that's already on disk renders from it on
  // the very first frame, with no flash of the network version.
  const [cachedUri, setCachedUri] = useState<string | undefined>(() => {
    if (!url) return undefined;
    try {
      const file = fileFor(url);
      return file.exists ? file.uri : undefined;
    } catch {
      return undefined;
    }
  });
  // Bumped by refresh() to re-run the download effect.
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
      } catch {
        // Offline, out of space, whatever — the WebView still has the url, so
        // reading is never blocked on the cache succeeding.
      }
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
    } catch {
      // nothing cached to drop
    }
    setCachedUri(undefined);
    setAttempt((n) => n + 1);
  }, [url]);

  return { fromCache: cachedUri != null, refresh, uri: cachedUri ?? url };
}
