/**
 * Real on-device document library (PDF, EPUB, Word, text, …).
 *
 * On Android with "All files access" granted it scans the whole shared
 * storage (like Foxit) — no folder picking needed. Until granted, and on
 * iOS (where session-scoped folder picking is the only option), it falls
 * back to the app's own document storage plus an optional picked folder.
 */
import { Directory, File, Paths } from "expo-file-system";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAppStore } from "@/stores/app-store";
import {
  DEVICE_STORAGE_ROOT,
  hasStorageAccess,
  requestStorageAccess,
  storageAccessSupported,
} from "@/utils/storage-access";

/** Recursion guard — device storage can be arbitrarily deep. */
const MAX_DEPTH = 6;
/** Directories that never hold user documents (app sandboxes, hidden dirs). */
const EXCLUDED_DIRS = new Set(["android", "obb", "data", "lost.dir"]);
/** Yield to the JS thread every N directories so the UI stays responsive. */
const YIELD_EVERY = 30;

/** Readable document formats the library picks up. */
const DOC_EXT_RE = /\.(pdf|epub|mobi|doc|docx|rtf|odt|txt|md)$/i;

/** Mime types matching DOC_EXT_RE, for the system file picker. */
const DOC_MIME_TYPES = [
  "application/pdf",
  "application/epub+zip",
  "application/x-mobipocket-ebook",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/rtf",
  "application/vnd.oasis.opendocument.text",
  "text/plain",
  "text/markdown",
];

export type StorageAccess = "granted" | "denied" | "unavailable";

export interface DeviceDoc {
  uri: string;
  /** Display name with the file extension stripped. */
  name: string;
  /** Uppercase format badge, e.g. "PDF", "DOCX". */
  ext: string;
  size: number;
  modifiedAt: number | null;
  folderUri: string;
}

export interface DeviceFolder {
  uri: string;
  name: string;
  /** Root of the app's own document storage. */
  isAppStorage: boolean;
  /** Root of the device's shared storage. */
  isDeviceRoot: boolean;
  docCount: number;
}

const yieldFrame = () => new Promise<void>((r) => setTimeout(r, 0));

function skippable(name: string): boolean {
  return name.startsWith(".") || EXCLUDED_DIRS.has(name.toLowerCase());
}

async function scanTree(
  root: Directory,
  kind: "app" | "device",
  docs: DeviceDoc[],
  folders: DeviceFolder[],
  onTick: (found: number) => void,
) {
  const stack: { dir: Directory; depth: number }[] = [{ dir: root, depth: 0 }];
  let visited = 0;
  while (stack.length > 0) {
    const { dir, depth } = stack.pop()!;
    if (++visited % YIELD_EVERY === 0) {
      await yieldFrame();
      onTick(docs.length);
    }

    let entries: (Directory | File)[];
    try {
      entries = dir.list();
    } catch {
      continue; // unreadable directory — skip it
    }

    let count = 0;
    for (const entry of entries) {
      // `instanceof Directory` is unreliable across the expo-file-system
      // bundle; a directory's uri always ends in a trailing slash.
      const isDir = entry.uri.endsWith("/");

      if (isDir) {
        if (depth < MAX_DEPTH && !skippable(entry.name)) {
          stack.push({ dir: entry as Directory, depth: depth + 1 });
        }
        continue;
      }
      // uri check above already established this is a file, not a Directory
      const file = entry as File;
      const ext = file.name.match(DOC_EXT_RE)?.[1];
      if (__DEV__) {
        console.log("file:", file.name, "| ext:", ext ?? "none");
      }
      if (!ext) continue;

      count += 1;
      let size = 0;
      let modifiedAt: number | null = null;
      try {
        size = file.size ?? 0;
        modifiedAt = file.lastModified;
      } catch {
        // metadata unavailable — keep the file anyway
      }
      docs.push({
        uri: file.uri,
        name: file.name.replace(DOC_EXT_RE, ""),
        ext: ext.toUpperCase(),
        size,
        modifiedAt,
        folderUri: dir.uri,
      });
    }

    if (count > 0) {
      folders.push({
        uri: dir.uri,
        name: dir.name,
        isAppStorage: kind === "app" && depth === 0,
        isDeviceRoot: kind === "device" && depth === 0,
        docCount: count,
      });
    }
  }
}

export function useDeviceLibrary() {
  const libRootUri = useAppStore((s) => s.libRootUri);
  const [docs, setDocs] = useState<DeviceDoc[]>([]);
  const [folders, setFolders] = useState<DeviceFolder[]>([]);
  const [scanning, setScanning] = useState(true);
  /** Live count of documents found so far during the current scan. */
  const [scanProgress, setScanProgress] = useState(0);
  const [access, setAccess] = useState<StorageAccess>(
    storageAccessSupported() ? "denied" : "unavailable",
  );
  const scanGen = useRef(0);

  const refresh = useCallback(() => {
    const gen = ++scanGen.current;
    setScanning(true);
    setScanProgress(0);
    // report the running document count, ignoring superseded scans
    const onTick = (found: number) => {
      if (gen === scanGen.current) setScanProgress(found);
    };
    // let the tab paint before hitting the filesystem
    setTimeout(async () => {
      const granted = hasStorageAccess();
      if (storageAccessSupported()) {
        setAccess(granted ? "granted" : "denied");
      }

      const nextDocs: DeviceDoc[] = [];
      const nextFolders: DeviceFolder[] = [];
      try {
        await scanTree(
          new Directory(Paths.document),
          "app",
          nextDocs,
          nextFolders,
          onTick,
        );
      } catch {
        // no document directory on this platform (web)
      }
      if (granted) {
        try {
          await scanTree(
            new Directory(DEVICE_STORAGE_ROOT),
            "device",
            nextDocs,
            nextFolders,
            onTick,
          );
        } catch {
          // storage root unreadable — treat as no access
        }
      } else if (libRootUri) {
        // iOS / no full access: fall back to the user-picked folder
        try {
          await scanTree(
            new Directory(libRootUri),
            "device",
            nextDocs,
            nextFolders,
            onTick,
          );
        } catch {
          // picked folder no longer accessible — user can pick again
        }
      }

      if (gen !== scanGen.current) return; // a newer scan superseded this one
      nextDocs.sort((a, b) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0));
      nextFolders.sort((a, b) => b.docCount - a.docCount);
      setDocs(nextDocs);
      setFolders(nextFolders);
      setScanning(false);
    }, 50);
  }, [libRootUri]);

  useEffect(refresh, [refresh]);

  /**
   * Makes sure we can read the device's storage, asking the system if not
   * (settings round-trip on Android 11+, dialog below that). Rescans when
   * access was just granted. Resolves with whether access is held.
   */
  const ensureAccess = useCallback(async (): Promise<boolean> => {
    if (!storageAccessSupported()) return false;
    if (hasStorageAccess()) {
      setAccess("granted");
      return true;
    }
    const granted = await requestStorageAccess();
    setAccess(granted ? "granted" : "denied");
    if (granted) {
      setScanning(true);
      refresh();
    }
    return granted;
  }, [refresh]);

  /** iOS fallback — opens the system folder picker. */
  const pickFolder = useCallback(async () => {
    try {
      const dir = await Directory.pickDirectoryAsync();
      useAppStore
        .getState()
        .set({ libRootUri: dir.uri, libRootName: dir.name });
    } catch {
      // cancelled, or picker unavailable on this platform
    }
  }, []);

  /**
   * Picks documents with the system file picker and copies them into app
   * storage. Resolves with the number of files imported, or null when
   * cancelled.
   */
  const importDocuments = useCallback(async (): Promise<number | null> => {
    try {
      const res = await File.pickFileAsync({
        multipleFiles: true,
        mimeTypes: DOC_MIME_TYPES,
      });
      if (res.canceled) return null;

      const dest = new Directory(Paths.document, "Imports");
      dest.create({ idempotent: true, intermediates: true });
      let copied = 0;
      for (const file of res.result) {
        try {
          await file.copy(dest);
          copied += 1;
        } catch {
          // already imported — skip
        }
      }
      refresh();
      return copied;
    } catch {
      return null;
    }
  }, [refresh]);

  return {
    docs,
    folders,
    scanning,
    scanProgress,
    access,
    refresh,
    ensureAccess,
    pickFolder,
    importDocuments,
  };
}

export function formatSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatWhen(ms: number | null): string {
  if (!ms) return "";
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
