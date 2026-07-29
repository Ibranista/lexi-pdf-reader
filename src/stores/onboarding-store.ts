/**
 * Whether this reader has been through onboarding, and what they said they
 * read.
 *
 * The server owns the answer — it lives on the user row `/auth/device` minted
 * for this device, so linking carries it in place and a second device inherits
 * it on sign-in. What is kept here is a local mirror, and it is a real mirror,
 * not a cache to be invalidated: it is what the root navigator renders from, so
 * a returning reader never watches onboarding flash past while `/auth/me` is in
 * flight, and a reader with no network can answer the question and get on with
 * reading.
 *
 * That makes writes offline-first. `completeOnboarding` sets the local answer
 * and marks it `pendingSync`; the push to the server is retried on reconnect,
 * on foreground, and on the next launch until it lands. Until it does, the
 * local answer wins over anything the server says — it is the newer of the two.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { AppState } from 'react-native';

import type { ReaderType, ReadingInterest } from '@/constants/onboarding';
import { readerTypeFor } from '@/constants/onboarding';
import { ensureSession } from '@/services/device-session';
import { onReconnect } from '@/utils/connectivity';
import { authApi, type User } from '@/utils/axios';
import { zustandStorage } from '@/utils/storage';

interface OnboardingState {
  /** What the reader said they mostly read (multi-select, may be empty). */
  interests: ReadingInterest[];
  /** Whether the reader has finished the onboarding screen. */
  hasCompletedOnboarding: boolean;
  /** The local answer hasn't been accepted by the server yet. */
  pendingSync: boolean;

  toggleInterest: (interest: ReadingInterest) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      interests: [],
      hasCompletedOnboarding: false,
      pendingSync: false,

      toggleInterest: (interest) =>
        set((state) => ({
          interests: state.interests.includes(interest)
            ? state.interests.filter((i) => i !== interest)
            : [...state.interests, interest],
        })),

      // Optimistic by design: the reader is taken into the library on the next
      // frame whether or not there is a network. `syncOnboarding` carries the
      // answer to the server when there is one.
      completeOnboarding: () => {
        set({ hasCompletedOnboarding: true, pendingSync: true });
        void syncOnboarding();
      },

      resetOnboarding: () =>
        set({ interests: [], hasCompletedOnboarding: false, pendingSync: true }),
    }),
    {
      name: 'onboarding-storage',
      storage: createJSONStorage(() => zustandStorage),
      // v0 stored the answers to the old three-step flow (`readerType`, `helps`).
      // Those questions are gone; only "have they been through onboarding?"
      // survives, so an existing reader isn't asked again.
      //
      // v1 → v2 is the move to server-owned onboarding: a reader who answered
      // before this version has an answer the server has never heard, so they
      // come out of the migration `pendingSync` and it is pushed on next launch.
      version: 2,
      migrate: (persisted, from) => {
        const prior = persisted as Partial<OnboardingState> | undefined;
        const completed = prior?.hasCompletedOnboarding ?? false;
        // The actions come back from persist's default shallow merge over the
        // initial state, hence the cast — this only has to carry the data.
        return {
          interests: from >= 1 ? (prior?.interests ?? []) : [],
          hasCompletedOnboarding: completed,
          pendingSync: completed,
        } as unknown as OnboardingState;
      },
    },
  ),
);

// ---------------------------------------------------------------------------
// Reconciling with the server
// ---------------------------------------------------------------------------

/** What of a server user this store is the mirror of. */
const fromUser = (user: User) => ({
  hasCompletedOnboarding: Boolean(user.hasCompletedOnboarding),
  interests: (user.interests ?? []) as ReadingInterest[],
});

/** Has a reconcile succeeded since launch? Deliberately not persisted. */
let reconciled = false;

/** One at a time: a reconnect during a launch sync must not race it. */
let inFlight: Promise<void> | null = null;

/**
 * Bring the local answer and the server's into agreement, in whichever
 * direction is right:
 *
 *  - `pendingSync` — the reader answered on this device and the server has not
 *    heard it yet, so push. This is the offline case, and the local answer is
 *    by definition the newer one.
 *  - otherwise — read the server's answer and adopt it, which is how a reader
 *    who onboarded on their other phone skips the question after signing in.
 *
 * Never rejects: onboarding is not worth failing a launch over, and every
 * caller here is fire-and-forget.
 */
export function syncOnboarding(): Promise<void> {
  if (!inFlight) {
    inFlight = reconcile()
      .then(() => {
        reconciled = true;
      })
      .catch(() => {
        // Offline, or the server is down. `pendingSync` is still set, and the
        // triggers below will come back to it.
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

async function reconcile(): Promise<void> {
  // Every path below needs a session; without one the request would 401 and
  // the interceptor would provision it anyway, one round trip later.
  await ensureSession();

  if (!useOnboardingStore.getState().pendingSync) {
    const server = await authApi.me();
    // The reader may have answered the question while that was in flight —
    // theirs is the newer of the two, so fall through and push it instead of
    // adopting a reply that predates it.
    if (!useOnboardingStore.getState().pendingSync) {
      useOnboardingStore.setState(fromUser(server));
      return;
    }
  }

  const { hasCompletedOnboarding, interests } = useOnboardingStore.getState();
  const user = await authApi.setOnboarding({ hasCompletedOnboarding, interests });
  useOnboardingStore.setState({ ...fromUser(user), pendingSync: false });
}

/**
 * Adopt the onboarding state on a user the server just handed back — a sign-in,
 * a sign-up, or an in-place link. Skipped while a local answer is still waiting
 * to be pushed, so signing in can't roll it back.
 */
export function adoptOnboarding(user: User | null): void {
  if (!user || useOnboardingStore.getState().pendingSync) return;
  useOnboardingStore.setState(fromUser(user));
}

/**
 * Try again after a failure. Cheap when there is nothing to do: a launch that
 * already reconciled and has no pending write does nothing at all.
 */
function retrySync(): void {
  if (reconciled && !useOnboardingStore.getState().pendingSync) return;
  void syncOnboarding();
}

// The network came back — the usual reason a push is still pending.
onReconnect(retrySync);

// And the case NetInfo can't see: the push failed because the server was down,
// not because the phone was offline. Coming back to the app is a fair moment to
// find out whether that's still true.
AppState.addEventListener('change', (state) => {
  if (state === 'active') retrySync();
});

/**
 * The reader type implied by the onboarding picks. Kept as a derived value
 * rather than stored state so it can never drift from the answers.
 */
export function useReaderType(): ReaderType {
  return useOnboardingStore((s) => readerTypeFor(s.interests));
}
