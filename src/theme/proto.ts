/**
 * Prototype design tokens — extracted from `extracted-design/LexiPDF Prototype.dc.html`.
 *
 * The prototype computes accent blends with `color-mix(in oklab, …)`; the hex
 * values below are those blends resolved against the default accent, which is
 * the sage green `palette.accent[500]` (#4A8F58) from `@/constants/colors`.
 *
 * Backgrounds (`bg`, `page`, `card`, `coverA/B`) stay on the warm paper scale —
 * only the accent family is green.
 */
import { useColorScheme } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { zustandStorage } from "@/utils/storage";

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
}

export const protoDark: ProtoTheme = {
  dark: true,
  bg: "#16130F",
  page: "#16130F",
  card: "#211D17",
  ink: "#F1EBE2",
  readerInk: "#DDD5C8",
  sub: "#A2988A",
  faint: "#6E6558",
  line: "rgba(241,235,226,.08)",
  chip: "rgba(241,235,226,.07)",
  accent: "#6FA376", // mix(78%, ink)
  accentMid: "#335034", // mix(45%, card)
  accentSoft: "#283223", // mix(18%, card)
  accentText: "#95B896", // mix(55%, ink)
  onAccent: "#16130F",
  coverA: "#2B2620",
  coverB: "#332D25",
  glass: "rgba(22,19,15,.88)",
  pill: "#F1EBE2",
  pillText: "#201B15",
  hl: "#2F4C36",
  glow: "rgba(74,143,88,.4)",
  // Teal, not green — `calm` has to stay readable *next to* the green accent.
  calm: "#7FC7CB",
  calmSoft: "rgba(30,62,64,.5)",
  calmLine: "rgba(70,112,115,.45)",
  accentHi: "#7CB183",
  accentLo: "#4B8659",
};

export const protoLight: ProtoTheme = {
  dark: false,
  bg: "#F6F3EE",
  page: "#FBF8F3",
  card: "#FFFFFF",
  ink: "#201B15",
  readerInk: "#2A241C",
  sub: "#7A7062",
  faint: "#B4AA9B",
  line: "rgba(32,27,21,.08)",
  chip: "rgba(32,27,21,.06)",
  accent: "#4A8F58",
  accentMid: "#9BC1A3", // mix(55%, white)
  accentSoft: "#E7F0E9", // mix(13%, white)
  accentText: "#3C7546", // mix(88%, ink), darkened to clear 4.5:1 on paper
  onAccent: "#FFFFFF",
  coverA: "#ECE6DD",
  coverB: "#E2DACE",
  glass: "rgba(251,248,243,.9)",
  pill: "#201B15",
  pillText: "#F6F3EE",
  hl: "#CBE3D0",
  glow: "rgba(74,143,88,.38)",
  // Teal, not green — `calm` has to stay readable *next to* the green accent.
  calm: "#1F6F73",
  calmSoft: "#DCEFF0",
  calmLine: "#A3D2D4",
  accentHi: "#5AA268",
  accentLo: "#3A7446",
};

export type ThemeMode = "auto" | "dark" | "light";

interface ThemeModeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeModeStore = create<ThemeModeState>()(
  persist(
    (set) => ({
      mode: "auto",
      setMode: (mode) => set({ mode }),
    }),
    {
      name: "proto-theme-mode",
      storage: createJSONStorage(() => zustandStorage),
    },
  ),
);

export function useProtoTheme(): ProtoTheme {
  const mode = useThemeModeStore((s) => s.mode);
  const system = useColorScheme();
  const dark = mode === "dark" || (mode === "auto" && system === "dark");
  return dark ? protoDark : protoLight;
}
