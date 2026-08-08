/**
 * Where the last sync got to.
 *
 * The cursor is opaque — a base64 blob the server hands back — and the only
 * thing the client is allowed to do with it is send it again. It is persisted
 * because losing it is not an error but is expensive: the next pull would
 * return this account's whole history instead of the changes since.
 *
 * A cursor that can't be read is treated by the server as a first sync, so
 * clearing this is always a safe repair.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { zustandStorage } from '@/utils/storage';

interface SyncState {
  cursor: string | null;
  /** Epoch ms of the last round trip that completed. */
  syncedAt: number | null;
  setCursor: (cursor: string) => void;
  /** Forget where we got to — the next sync pulls everything again. */
  reset: () => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      cursor: null,
      syncedAt: null,

      setCursor: (cursor) => set({ cursor, syncedAt: Date.now() }),

      reset: () => set({ cursor: null, syncedAt: null }),
    }),
    {
      name: 'lexipdf-sync',
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
);
