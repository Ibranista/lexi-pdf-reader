import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ReaderType, ReadingInterest } from '@/constants/onboarding';
import { readerTypeFor } from '@/constants/onboarding';
import { zustandStorage } from '@/utils/storage';

interface OnboardingState {
  interests: ReadingInterest[];
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
      version: 1,
      migrate: (persisted) => {
        const prior = persisted as Partial<OnboardingState> | undefined;
        return {
          interests: [],
          hasCompletedOnboarding: prior?.hasCompletedOnboarding ?? false,
        } as unknown as OnboardingState;
      },
    },
  ),
);

export function useReaderType(): ReaderType {
  return useOnboardingStore((s) => readerTypeFor(s.interests));
}
