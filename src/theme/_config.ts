import { DarkTheme, DefaultTheme } from "@react-navigation/native";

import { colors as palette } from "@/theme/colors";
import type { ThemeConfiguration } from "@/theme/types/config";

export const enum Variant {
  DARK = "dark",
}

const colorsLight = {
  gray100: palette.neutral[200],
  gray200: palette.neutral[500],
  gray400: palette.neutral[700],
  gray50: palette.neutral[50],
  gray800: palette.neutral[900],
  purple100: palette.primary[100],
  purple50: palette.dark[900],
  purple500: palette.primary[500],
  red500: palette.error[500],
  skeleton: palette.neutral[200],
} as const;

const colorsDark = {
  gray100: palette.dark[900],
  gray200: palette.dark[400],
  gray400: palette.dark[200],
  gray50: palette.dark[800],
  gray800: palette.neutral[50],
  purple100: palette.dark[700],
  purple50: palette.dark[900],
  purple500: palette.primary[500],
  red500: palette.error[500],
  skeleton: palette.dark[400],
} as const;

const sizes = [12, 14, 16, 24, 32, 37, 40, 44, 80] as const;

export const config = {
  backgrounds: colorsLight,
  borders: {
    colors: colorsLight,
    radius: [4, 16],
    widths: [1, 2],
  },
  colors: palette,
  fonts: {
    colors: colorsLight,
    sizes,
  },
  gutters: sizes,
  navigationColors: {
    ...DefaultTheme.colors,
    background: colorsLight.gray50,
    card: colorsLight.gray50,
  },
  variants: {
    dark: {
      backgrounds: colorsDark,
      borders: {
        colors: colorsDark,
      },
      fonts: {
        colors: colorsDark,
      },
      navigationColors: {
        ...DarkTheme.colors,
        background: colorsDark.purple50,
        card: colorsDark.purple50,
      },
    },
  },
} as const satisfies ThemeConfiguration;
