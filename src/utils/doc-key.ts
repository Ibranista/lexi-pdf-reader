import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import { useEffect, useState } from 'react';

import { bookReadUrl } from '@/hooks/use-book-suggestions';

const cache = new Map<string, string>();

const sha256 = (input: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);

const isWebBook = (uri: string) => /^https?:\/\//i.test(uri);

function fileNameOf(uri: string, name?: string): string {
  if (name?.trim()) return name.trim();
  const last = uri.split(/[?#]/)[0].split('/').pop() ?? uri;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

export async function docKeyFor(uri: string, name?: string): Promise<string> {
  const cached = cache.get(uri);
  if (cached) return cached;

  let key: string;
  if (isWebBook(uri)) {
    key = await sha256(bookReadUrl(uri));
  } else {
    let size = 0;
    try {
      size = new File(uri).size ?? 0;
    } catch {}
    key = await sha256(`${fileNameOf(uri, name).toLowerCase()}:${size}`);
  }

  cache.set(uri, key);
  return key;
}

export function useDocKey(uri?: string, name?: string): string | undefined {
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
      () => {},
    );
    return () => {
      live = false;
    };
  }, [name, uri]);

  return uri && resolved?.uri === uri ? resolved.key : undefined;
}
