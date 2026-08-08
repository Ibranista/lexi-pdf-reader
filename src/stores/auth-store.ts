/**
 * Who is using the app, and how much AI they have left.
 *
 * Reading, highlighting and notes never need an account — the reader works
 * fully signed out. An account only becomes necessary when the AI allowance
 * runs out, which is why the quota lives here next to the user rather than in
 * the app store: the two are read together every time the wall is decided.
 *
 * Tokens are not kept here. They live in `expo-secure-store` behind
 * `tokenStorage` (src/utils/axios.ts), which the axios interceptors already
 * read and refresh on their own.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { AiQuota } from "@/services/lexi-ai";
import { adoptOnboarding, syncOnboarding } from "@/stores/onboarding-store";
import { useSyncStore } from "@/stores/sync-store";
import { onSessionLost } from "@/utils/api-config";
import { authApi, type User } from "@/utils/axios";
import { zustandStorage } from "@/utils/storage";

/** Why the sign-in wall is up, so the copy can match. */
export type WallReason = "quota" | "sync";

interface AuthState {
  /** Null until the reader signs in; the app is fully usable in that state. */
  user: User | null;
  /** Remaining AI allowance, as last reported by an AI call. */
  quota: AiQuota | null;
  /** Set while the sign-in wall is showing. */
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
        // The account the reader just signed into may already have onboarded —
        // on their other phone, or before a reinstall. Its answer comes back on
        // this very response, so take it rather than asking again.
        adoptOnboarding(user);
        // Different identity, different timeline. The cursor names a point in
        // the *previous* user's history, and keeping it would step the next
        // pull straight over everything this account already had.
        useSyncStore.getState().reset();
      },

      // Endpoints echo the quota on every response; undefined means this one
      // didn't, which is not the same as "no allowance left".
      setQuota: (quota) => {
        if (quota === undefined) return;
        set({ quota });
      },

      openWall: (reason) => {
        // Already signed in — the wall would ask for something they've done.
        if (get().user) return;
        set({ wall: reason });
      },

      closeWall: () => set({ wall: null }),

      signOut: async () => {
        try {
          await authApi.logout();
        } catch {
          // Already invalid server-side, or offline — the local session goes
          // either way, or the reader is stuck signed in to nothing.
        }
        set({ user: null, quota: null, wall: null });
        // The next request re-registers this device and gets a fresh anonymous
        // row. The server carries the onboarding answer onto it — signing out
        // shouldn't walk the reader back through onboarding — so re-read it
        // rather than assuming either way.
        void syncOnboarding();
        useSyncStore.getState().reset();
      },
    }),
    {
      name: "lexipdf-auth",
      storage: createJSONStorage(() => zustandStorage),
      // The wall is a moment, not a state to restore into.
      partialize: (s) => ({ quota: s.quota, user: s.user }),
    },
  ),
);

/**
 * The client discovered the stored account session is dead — a refresh the
 * server refused. The reader carries on anonymously (the axios interceptor has
 * already provisioned that), but the account is gone, so nothing should still
 * be showing them as signed in.
 */
onSessionLost(() => {
  useAuthStore.setState({ user: null, quota: null });
  // The reader comes back as a fresh anonymous identity, so the cursor is
  // pointing into a history that is no longer theirs.
  useSyncStore.getState().reset();
});

/** Display name for the account row — falls back to the email's local part. */
export function accountLabel(user: User): string {
  if (user.name?.trim()) return user.name.trim();
  const at = user.email.indexOf("@");
  return at > 0 ? user.email.slice(0, at) : user.email;
}
