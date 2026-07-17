/**
 * Prototype design tokens — extracted from `extracted-design/LexiPDF Prototype.dc.html`.
 *
 * The prototype computes accent blends with `color-mix(in oklab, …)`; the hex
 * values below are those blends resolved against the default accent #B4562F.
 */
import { Platform, useColorScheme } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { zustandStorage } from '@/utils/storage';

export interface ProtoTheme {
  dark: boolean;
  bg: string;
  page: string;
  card: string;
  ink: string;
  readerInk: string;
  sub: string;
  faint: string;
  line: string;
  chip: string;
  accent: string;
  accentMid: string;
  accentSoft: string;
  accentText: string;
  onAccent: string;
  coverA: string;
  coverB: string;
  glass: string;
  pill: string;
  pillText: string;
  hl: string;
  glow: string;
  calm: string;
  calmSoft: string;
  calmLine: string;
  accentHi: string;
  accentLo: string;
  serif: string;
  mono: string;
}

const serif = Platform.select({
  android: 'serif',
  default: 'Georgia',
});

const mono = Platform.select({
  android: 'monospace',
  default: 'Menlo',
});

export const protoDark: ProtoTheme = {
  dark: true,
  bg: '#16130F',
  page: '#16130F',
  card: '#211D17',
  ink: '#F1EBE2',
  readerInk: '#DDD5C8',
  sub: '#A2988A',
  faint: '#6E6558',
  line: 'rgba(241,235,226,.08)',
  chip: 'rgba(241,235,226,.07)',
  accent: '#C17756', // mix(78%, ink)
  accentMid: '#633722', // mix(45%, card)
  accentSoft: '#3B271B', // mix(18%, card)
  accentText: '#D09980', // mix(55%, ink)
  onAccent: '#16130F',
  coverA: '#2B2620',
  coverB: '#332D25',
  glass: 'rgba(22,19,15,.88)',
  pill: '#F1EBE2',
  pillText: '#201B15',
  hl: '#653F2C',
  glow: 'rgba(180,86,47,.4)',
  calm: '#8FC9A5',
  calmSoft: 'rgba(38,66,52,.5)',
  calmLine: 'rgba(78,116,95,.45)',
  accentHi: '#BA6541',
  accentLo: '#944929',
  serif: serif ?? 'serif',
  mono: mono ?? 'monospace',
};

export const protoLight: ProtoTheme = {
  dark: false,
  bg: '#F6F3EE',
  page: '#FBF8F3',
  card: '#FFFFFF',
  ink: '#201B15',
  readerInk: '#2A241C',
  sub: '#7A7062',
  faint: '#B4AA9B',
  line: 'rgba(32,27,21,.08)',
  chip: 'rgba(32,27,21,.06)',
  accent: '#B4562F',
  accentMid: '#D6A28D', // mix(55%, white)
  accentSoft: '#F5E9E4', // mix(13%, white)
  accentText: '#A24F2C', // mix(88%, ink)
  onAccent: '#FFFFFF',
  coverA: '#ECE6DD',
  coverB: '#E2DACE',
  glass: 'rgba(251,248,243,.9)',
  pill: '#201B15',
  pillText: '#F6F3EE',
  hl: '#EAC9B6',
  glow: 'rgba(180,86,47,.38)',
  calm: '#2E6B4C',
  calmSoft: '#DFF0E4',
  calmLine: '#A8D4B8',
  accentHi: '#BA6440',
  accentLo: '#934727',
  serif: serif ?? 'serif',
  mono: mono ?? 'monospace',
};

export type ThemeMode = 'auto' | 'dark' | 'light';

interface ThemeModeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeModeStore = create<ThemeModeState>()(
  persist(
    (set) => ({
      mode: 'auto',
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'proto-theme-mode',
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
);

export function useProtoTheme(): ProtoTheme {
  const mode = useThemeModeStore((s) => s.mode);
  const system = useColorScheme();
  const dark = mode === 'dark' || (mode === 'auto' && system === 'dark');
  return dark ? protoDark : protoLight;
}
