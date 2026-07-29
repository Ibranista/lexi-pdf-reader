import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { zustandStorage } from '@/utils/storage';

interface SyncState {
  cursor: string | null;
  syncedAt: number | null;
  setCursor: (cursor: string) => void;
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
