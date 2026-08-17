import { AppState } from "react-native";

import { deviceId, ensureSession } from "@/services/device-session";
import {
  pendingAnnotations,
  useAnnotationsStore,
  type Annotation,
  type RemoteAnnotation,
  type Tombstone,
} from "@/stores/annotations-store";
import { useRecentsStore } from "@/stores/recents-store";
import { useSyncStore } from "@/stores/sync-store";
import { api } from "@/utils/axios";
import { onReconnect } from "@/utils/connectivity";
import { docKeyFor } from "@/utils/doc-key";
import axios from "axios";

const DEBOUNCE_MS = 2500;

interface SyncResponse {
  cursor: string;
  changes: { annotations?: RemoteAnnotation[] };
  serverTime: number;
}

const toWire = (a: Annotation | Tombstone, docKey: string) => ({
  id: a.id,
  docKey,
  page: a.page,
  text: a.text,
  source: a.source,
  color: a.color,
  note: a.note,
  createdAt: a.createdAt,
  updatedAt: a.updatedAt,
  deletedAt: "deletedAt" in a ? a.deletedAt : null,
});

async function documentKeys(): Promise<{
  byUri: Record<string, string>;
  byDocKey: Record<string, string>;
}> {
  const byUri: Record<string, string> = {};
  const byDocKey: Record<string, string> = {};

  const recents = useRecentsStore.getState().recents;
  await Promise.all(
    recents.map(async (doc) => {
      try {
        const key = await docKeyFor(doc.uri, doc.name);
        byUri[doc.uri] = key;
        byDocKey[key] = doc.uri;
      } catch {}
    }),
  );

  return { byUri, byDocKey };
}

function conflictedIds(error: unknown): string[] | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) return null;
  const body = error.response.data as { reason?: string; ids?: string[] };
  return body?.reason === "ID_CONFLICT" ? (body.ids ?? []) : null;
}

async function roundTrip(): Promise<void> {
  const { byUri, byDocKey } = await documentKeys();
  useAnnotationsStore.getState().setDocKeys(byUri);

  const state = useAnnotationsStore.getState();
  const dirty = pendingAnnotations(state).filter((a) => a.docKey);
  const buried = state.deleted.filter((d) => d.docKey);

  const { data } = await api.post<SyncResponse>("/sync", {
    cursor: useSyncStore.getState().cursor,
    deviceId: await deviceId(),
    changes: {
      annotations: [
        ...dirty.map((a) => toWire(a, a.docKey!)),
        ...buried.map((d) => toWire(d, d.docKey!)),
      ],
    },
  });

  console.log("error->", data);

  useAnnotationsStore.getState().applyRemote(data.changes.annotations ?? []);
  useAnnotationsStore.getState().markPushed(
    Object.fromEntries(dirty.map((a) => [a.id, a.updatedAt])),
    buried.map((d) => d.id),
  );
  useAnnotationsStore.getState().attachUris(byDocKey);
  useSyncStore.getState().setCursor(data.cursor);
}

export interface MergeResult {
  documents: number;
  annotations: number;
  vocab: number;
  sessions: number;
  messages: number;
}

export async function mergeDeviceData(): Promise<MergeResult | null> {
  try {
    const { data } = await api.post<{ merged: MergeResult }>("/sync/merge", {
      fromDeviceId: await deviceId(),
    });
    return data.merged;
  } catch {
    return null;
  }
}

let inFlight: Promise<void> | null = null;
let again = false;

export function syncNow(): Promise<void> {
  if (inFlight) {
    again = true;
    return inFlight;
  }

  inFlight = (async () => {
    try {
      await ensureSession();
      try {
        await roundTrip();
      } catch (error) {
        const ids = conflictedIds(error);
        if (!ids?.length) throw error;
        useAnnotationsStore.getState().reissueIds(ids);
        await roundTrip();
      }
    } catch {} finally {
      inFlight = null;
    }
  })();

  return inFlight.then(() => {
    if (!again) return undefined;
    again = false;
    return syncNow();
  });
}

let timer: ReturnType<typeof setTimeout> | null = null;

export function syncSoon(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void syncNow();
  }, DEBOUNCE_MS);
}

const hasPending = (): boolean => {
  const state = useAnnotationsStore.getState();
  return state.deleted.length > 0 || pendingAnnotations(state).length > 0;
};

export function startSync(): () => void {
  const unsubscribeStore = useAnnotationsStore.subscribe((state, previous) => {
    if (state.items === previous.items && state.deleted === previous.deleted)
      return;
    if (hasPending()) syncSoon();
  });

  const unsubscribeNetwork = onReconnect(() => {
    void syncNow();
  });

  const appState = AppState.addEventListener("change", (next) => {
    if (next === "active") void syncNow();
  });

  void syncNow();

  return () => {
    unsubscribeStore();
    unsubscribeNetwork();
    appState.remove();
    if (timer) clearTimeout(timer);
  };
}
