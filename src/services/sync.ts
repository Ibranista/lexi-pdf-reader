/**
 * Highlights and notes, kept in step with the server.
 *
 * The reader's copy is the one that matters: everything is written to MMKV
 * first and rendered from there, so the app works identically with no network.
 * This layer only carries those writes to `POST /sync` when it can, and folds
 * back whatever the other devices did. Nothing here is on the path of a tap.
 *
 * Two rules make that safe, and both come from the backend contract (§2.3):
 *
 *  - **Deletes are tombstones.** A row removed locally is moved to the store's
 *    graveyard and pushed with `deletedAt` set. Dropping it outright would work
 *    until the next pull handed it straight back.
 *  - **The client's `updatedAt` decides.** Last write wins on that clock, and
 *    the `cursor` — the server's clock — only drives what a pull returns. A
 *    phone with a skewed clock can lose a merge but can never make rows
 *    invisible to the other devices.
 *
 * Only annotations are synced today. The endpoint takes documents and vocab in
 * the same round trip, and the cursor advances past *all three* — so whoever
 * adds those must add them here, not in a second sync loop, or this one will
 * step over their changes.
 */
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

/** Long enough to swallow a burst of edits, short enough to feel immediate. */
const DEBOUNCE_MS = 2500;

interface SyncResponse {
  cursor: string;
  changes: { annotations?: RemoteAnnotation[] };
  serverTime: number;
}

/** What goes up for one annotation. `uri` is deliberately not in it (§2.1). */
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

/**
 * Sync identity for every document this device knows about, both ways round.
 *
 * `docKeyFor` hashes name and size, so it needs the name the library holds —
 * the uri's last segment is not always the same string, and a different string
 * is a different key.
 */
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
      } catch {
        // Unreadable file or a lapsed permission: its annotations wait for a
        // launch where the key can be derived rather than syncing under a
        // wrong one.
      }
    }),
  );

  return { byUri, byDocKey };
}

/** The backend answers 409 ID_CONFLICT with the ids two devices both minted. */
function conflictedIds(error: unknown): string[] | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 409) return null;
  const body = error.response.data as { reason?: string; ids?: string[] };
  return body?.reason === "ID_CONFLICT" ? (body.ids ?? []) : null;
}

async function roundTrip(): Promise<void> {
  const { byUri, byDocKey } = await documentKeys();
  useAnnotationsStore.getState().setDocKeys(byUri);

  const state = useAnnotationsStore.getState();
  // A row whose document has no derivable key cannot be addressed on the
  // server; it waits rather than being dropped or sent under a guess.
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

  // Order matters: adopt the server's view first, then mark what went up as
  // sent. The other way round, a row the server overrode would be left looking
  // clean while holding the version it just lost with.
  useAnnotationsStore.getState().applyRemote(data.changes.annotations ?? []);
  useAnnotationsStore.getState().markPushed(
    Object.fromEntries(dirty.map((a) => [a.id, a.updatedAt])),
    buried.map((d) => d.id),
  );
  useAnnotationsStore.getState().attachUris(byDocKey);
  useSyncStore.getState().setCursor(data.cursor);
}

/** Shared, so a reconnect landing mid-sync rides the one already running. */
let inFlight: Promise<void> | null = null;
/** Set when something changed while a sync was in the air. */
let again = false;

/**
 * One round trip, both directions. Never rejects — every caller is
 * fire-and-forget, and a failed sync is a sync that happens later.
 */
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
        // Two devices minted the same client id for different rows. Ours are
        // re-issued and go up under new ids on the retry; the alternative is a
        // push that can never succeed.
        const ids = conflictedIds(error);
        if (!ids?.length) throw error;
        useAnnotationsStore.getState().reissueIds(ids);
        await roundTrip();
      }
    } catch {
      // Offline, or the server is unhappy. Nothing was marked as sent, so the
      // next trigger picks up exactly the same work.
    } finally {
      inFlight = null;
    }
  })();

  return inFlight.then(() => {
    if (!again) return undefined;
    again = false;
    return syncNow();
  });
}

// ---------------------------------------------------------------------------
// When it runs
// ---------------------------------------------------------------------------

let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * Something changed locally. Debounced, because writing a note is a burst of
 * keystrokes and picking a highlight colour is often three taps.
 */
export function syncSoon(): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void syncNow();
  }, DEBOUNCE_MS);
}

/** Is there anything the server hasn't been told? */
const hasPending = (): boolean => {
  const state = useAnnotationsStore.getState();
  return state.deleted.length > 0 || pendingAnnotations(state).length > 0;
};

/**
 * Start syncing. Called once from the root layout — subscribing at module load
 * would run before the persisted stores had been read back.
 */
export function startSync(): () => void {
  const unsubscribeStore = useAnnotationsStore.subscribe((state, previous) => {
    // `applyRemote` writes to the same store; only a local change is worth a
    // round trip, and a local change is one that leaves something unsent.
    if (state.items === previous.items && state.deleted === previous.deleted)
      return;
    if (hasPending()) syncSoon();
  });

  const unsubscribeNetwork = onReconnect(() => {
    void syncNow();
  });

  const appState = AppState.addEventListener("change", (next) => {
    // Coming back to the app is the moment another device's changes are most
    // likely to be waiting, and the moment a failed push is worth retrying.
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
