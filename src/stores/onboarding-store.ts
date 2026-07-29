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
  interests: ReadingInterest[];
  hasCompletedOnboarding: boolean;
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
      version: 2,
      migrate: (persisted, from) => {
        const prior = persisted as Partial<OnboardingState> | undefined;
        const completed = prior?.hasCompletedOnboarding ?? false;
        return {
          interests: from >= 1 ? (prior?.interests ?? []) : [],
          hasCompletedOnboarding: completed,
          pendingSync: completed,
        } as unknown as OnboardingState;
      },
    },
  ),
);

const fromUser = (user: User) => ({
  hasCompletedOnboarding: Boolean(user.hasCompletedOnboarding),
  interests: (user.interests ?? []) as ReadingInterest[],
});

let reconciled = false;

let inFlight: Promise<void> | null = null;

export function syncOnboarding(): Promise<void> {
  if (!inFlight) {
    inFlight = reconcile()
      .then(() => {
        reconciled = true;
      })
      .catch(() => {})
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

async function reconcile(): Promise<void> {
  await ensureSession();

  if (!useOnboardingStore.getState().pendingSync) {
    const server = await authApi.me();
    if (!useOnboardingStore.getState().pendingSync) {
      useOnboardingStore.setState(fromUser(server));
      return;
    }
  }

  const { hasCompletedOnboarding, interests } = useOnboardingStore.getState();
  const user = await authApi.setOnboarding({ hasCompletedOnboarding, interests });
  useOnboardingStore.setState({ ...fromUser(user), pendingSync: false });
}

export function adoptOnboarding(user: User | null): void {
  if (!user || useOnboardingStore.getState().pendingSync) return;
  useOnboardingStore.setState(fromUser(user));
}

function retrySync(): void {
  if (reconciled && !useOnboardingStore.getState().pendingSync) return;
  void syncOnboarding();
}

onReconnect(retrySync);

AppState.addEventListener('change', (state) => {
  if (state === 'active') retrySync();
});

export function useReaderType(): ReaderType {
  return useOnboardingStore((s) => readerTypeFor(s.interests));
}
