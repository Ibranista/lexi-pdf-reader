import { Directory, File, Paths } from "expo-file-system";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAppStore } from "@/stores/app-store";
import {
  DEVICE_STORAGE_ROOT,
  hasStorageAccess,
  requestStorageAccess,
  storageAccessSupported,
} from "@/utils/storage-access";

const MAX_DEPTH = 6;
const EXCLUDED_DIRS = new Set(["android", "obb", "data", "lost.dir"]);
const YIELD_EVERY = 30;

const DOC_EXT_RE = /\.(pdf|epub|mobi|doc|docx|rtf|odt|txt|md)$/i;

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
  name: string;
  ext: string;
  size: number;
  modifiedAt: number | null;
  folderUri: string;
}

export interface DeviceFolder {
  uri: string;
  name: string;
  isAppStorage: boolean;
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
    console.log("the stack-->", dir);
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
      const isDir =
        entry instanceof Directory ||
        typeof (entry as { list?: unknown }).list === "function";
      if (isDir) {
        if (depth < MAX_DEPTH && !skippable(entry.name)) {
          stack.push({ dir: entry as Directory, depth: depth + 1 });
        }
        continue;
      }
      const ext = entry.name.match(DOC_EXT_RE)?.[1];
      if (!ext) continue;

      count += 1;
      let size = 0;
      let modifiedAt: number | null = null;
      try {
        size = entry.size;
        modifiedAt = entry.modificationTime;
      } catch {}
      docs.push({
        uri: entry.uri,
        name: entry.name.replace(DOC_EXT_RE, ""),
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
  const [scanProgress, setScanProgress] = useState(0);
  const [access, setAccess] = useState<StorageAccess>(
    storageAccessSupported() ? "denied" : "unavailable",
  );
  const scanGen = useRef(0);

  const refresh = useCallback(() => {
    const gen = ++scanGen.current;
    setScanning(true);
    setScanProgress(0);
    const onTick = (found: number) => {
      if (gen === scanGen.current) setScanProgress(found);
    };
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
      } catch {}
      if (granted) {
        try {
          await scanTree(
            new Directory(DEVICE_STORAGE_ROOT),
            "device",
            nextDocs,
            nextFolders,
            onTick,
          );
        } catch {}
      } else if (libRootUri) {
        try {
          await scanTree(
            new Directory(libRootUri),
            "device",
            nextDocs,
            nextFolders,
            onTick,
          );
        } catch {}
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

  const pickFolder = useCallback(async () => {
    try {
      const dir = await Directory.pickDirectoryAsync();
      useAppStore
        .getState()
        .set({ libRootUri: dir.uri, libRootName: dir.name });
    } catch {}
  }, []);

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
        } catch {}
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
