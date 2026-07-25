import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ReaderType, ReadingInterest } from '@/constants/onboarding';
import { readerTypeFor } from '@/constants/onboarding';
import { zustandStorage } from '@/utils/storage';

interface OnboardingState {
  /** What the reader said they mostly read (multi-select, may be empty). */
  interests: ReadingInterest[];
  /** Whether the reader has finished the onboarding screen. */
  hasCompletedOnboarding: boolean;

  toggleInterest: (interest: ReadingInterest) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      interests: [],
      hasCompletedOnboarding: false,

      toggleInterest: (interest) =>
        set((state) => ({
          interests: state.interests.includes(interest)
            ? state.interests.filter((i) => i !== interest)
            : [...state.interests, interest],
        })),

      completeOnboarding: () => set({ hasCompletedOnboarding: true }),

      resetOnboarding: () => set({ interests: [], hasCompletedOnboarding: false }),
    }),
    {
      name: 'onboarding-storage',
      storage: createJSONStorage(() => zustandStorage),
      // v0 stored the answers to the old three-step flow (`readerType`, `helps`).
      // Those questions are gone; only "have they been through onboarding?"
      // survives, so an existing reader isn't asked again.
      version: 1,
      migrate: (persisted) => {
        const prior = persisted as Partial<OnboardingState> | undefined;
        // The actions come back from persist's default shallow merge over the
        // initial state, hence the cast — this only has to carry the data.
        return {
          interests: [],
          hasCompletedOnboarding: prior?.hasCompletedOnboarding ?? false,
        } as unknown as OnboardingState;
      },
    },
  ),
);

/**
 * The reader type implied by the onboarding picks. Kept as a derived value
 * rather than stored state so it can never drift from the answers.
 */
export function useReaderType(): ReaderType {
  return useOnboardingStore((s) => readerTypeFor(s.interests));
}
