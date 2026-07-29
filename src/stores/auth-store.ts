import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { AiQuota } from "@/services/lexi-ai";
import { adoptOnboarding, syncOnboarding } from "@/stores/onboarding-store";
import { useSyncStore } from "@/stores/sync-store";
import { onSessionLost } from "@/utils/api-config";
import { authApi, type User } from "@/utils/axios";
import { zustandStorage } from "@/utils/storage";

export type WallReason = "quota" | "sync";

interface AuthState {
  user: User | null;
  quota: AiQuota | null;
  wall: WallReason | null;

  signedIn: () => boolean;
  setUser: (user: User | null) => void;
  setQuota: (quota: AiQuota | null | undefined) => void;
  openWall: (reason: WallReason) => void;
  closeWall: () => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      quota: null,
      wall: null,

      signedIn: () => get().user !== null,

      setUser: (user) => {
        set({ user, wall: user ? null : get().wall });
        adoptOnboarding(user);
        useSyncStore.getState().reset();
      },

      setQuota: (quota) => {
        if (quota === undefined) return;
        set({ quota });
      },

      openWall: (reason) => {
        if (get().user) return;
        set({ wall: reason });
      },

      closeWall: () => set({ wall: null }),

      signOut: async () => {
        try {
          await authApi.logout();
        } catch {}
        set({ user: null, quota: null, wall: null });
        void syncOnboarding();
        useSyncStore.getState().reset();
      },
    }),
    {
      name: "lexipdf-auth",
      storage: createJSONStorage(() => zustandStorage),
      partialize: (s) => ({ quota: s.quota, user: s.user }),
    },
  ),
);

onSessionLost(() => {
  useAuthStore.setState({ user: null, quota: null });
  useSyncStore.getState().reset();
});

export function accountLabel(user: User): string {
  if (user.name?.trim()) return user.name.trim();
  const at = user.email.indexOf("@");
  return at > 0 ? user.email.slice(0, at) : user.email;
}
