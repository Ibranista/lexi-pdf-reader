/**
 * `docKey` — the identity a document syncs under.
 *
 * A device `uri` cannot be it: `content://…` and `file://…` paths change between
 * devices, between reinstalls, and sometimes when a permission is re-granted.
 * So the client derives a stable key and the backend treats *that* as the
 * document, keeping `uri` as an opaque per-device pointer (prompt.md §2.1):
 *
 *   docKey = sha256( lowercase(fileName) + ":" + fileSizeBytes )
 *   docKey = sha256( readUrl )                       // suggested web books
 *
 * Two different files with the same name and size collide. That is accepted and
 * deliberate: the consequence is highlights shared across two documents, not
 * data loss. The backend enforces the shape — 64 lowercase hex characters — and
 * rejects anything else with a 400, so this is the only place allowed to build
 * one.
 */
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import { useEffect, useState } from 'react';

import { bookReadUrl } from '@/hooks/use-book-suggestions';

/**
 * Keys are derived from immutable inputs, so a uri's key never changes within a
 * session — and the word card asks for it on every selection.
 */
const cache = new Map<string, string>();

const sha256 = (input: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);

/** A suggested book opened in the web reader, rather than a file on the device. */
const isWebBook = (uri: string) => /^https?:\/\//i.test(uri);

/** The name to key on: what the caller knows it as, else the uri's last segment. */
function fileNameOf(uri: string, name?: string): string {
  if (name?.trim()) return name.trim();
  const last = uri.split(/[?#]/)[0].split('/').pop() ?? uri;
  try {
    return decodeURIComponent(last);
  } catch {
    // Malformed percent-encoding: the raw segment still keys consistently.
    return last;
  }
}

/**
 * The sync key for a document. Cheap and cached after the first call.
 *
 * `size` reads as 0 when the file can't be stat'd, which keeps the key stable
 * per device rather than throwing — a document that syncs under a slightly
 * wrong key still works; one that can't produce a key at all loses its AI.
 */
export async function docKeyFor(uri: string, name?: string): Promise<string> {
  const cached = cache.get(uri);
  if (cached) return cached;

  let key: string;
  if (isWebBook(uri)) {
    // The cover is packed into the uri by `bookDocUri`; it isn't part of the
    // book's identity, so it comes off before hashing.
    key = await sha256(bookReadUrl(uri));
  } else {
    let size = 0;
    try {
      size = new File(uri).size ?? 0;
    } catch {
      // Unreadable or a permission that has lapsed — keep going with 0.
    }
    key = await sha256(`${fileNameOf(uri, name).toLowerCase()}:${size}`);
  }

  cache.set(uri, key);
  return key;
}

/**
 * The open document's sync key, or undefined until it has been derived — one
 * async hash on open. Callers pass it straight to the AI endpoints, which
 * require it; a screen holding `undefined` simply hasn't got one yet.
 */
export function useDocKey(uri?: string, name?: string): string | undefined {
  // Held with the uri it belongs to, so switching documents reads as "no key
  // yet" during render rather than briefly handing out the previous one. That
  // pairing is also what keeps this a single async setState — clearing on
  // change would mean setting state synchronously inside the effect.
  const [resolved, setResolved] = useState<{ uri: string; key: string } | null>(
    null,
  );

  useEffect(() => {
    if (!uri) return;
    let live = true;
    docKeyFor(uri, name).then(
      (key) => {
        if (live) setResolved({ key, uri });
      },
      () => {
        // Unreadable, or expo-crypto is missing: the AI affordances stay shut
        // rather than sending a key the backend would reject with a 400.
      },
    );
    return () => {
      live = false;
    };
  }, [name, uri]);

  return uri && resolved?.uri === uri ? resolved.key : undefined;
}
