import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { ReaderType, ReadingHelp } from '@/constants/onboarding';
import { zustandStorage } from '@/utils/storage';

interface OnboardingState {
  /** The selected answer to "what type of reader are you?". */
  readerType: ReaderType;
  /** The selected answers to "what helps you read better?" (multi-select). */
  helps: ReadingHelp[];
  /** Whether the reader has finished (or skipped) the onboarding flow. */
  hasCompletedOnboarding: boolean;

  selectReaderType: (readerType: ReaderType) => void;
  toggleHelp: (help: ReadingHelp) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      readerType: 'student',
      helps: ['focus', 'remember'],
      hasCompletedOnboarding: false,

      selectReaderType: (readerType) => set({ readerType }),

      toggleHelp: (help) =>
        set((state) => ({
          helps: state.helps.includes(help)
            ? state.helps.filter((h) => h !== help)
            : [...state.helps, help],
        })),

      completeOnboarding: () => set({ hasCompletedOnboarding: true }),

      resetOnboarding: () =>
        set({ readerType: 'student', helps: ['focus', 'remember'], hasCompletedOnboarding: false }),
    }),
    {
      name: 'onboarding-storage',
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
);
