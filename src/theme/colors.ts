export type ColorScale = {
  100: string;
  200: string;
  300: string;
  400: string;
  50: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
};

export const colors = {
  accent: {
    100: "#DCEEE0",
    200: "#B7DCC0",
    300: "#8FC79C",
    400: "#5FA96D",
    50: "#F1F8F2",
    500: "#4A8F58",
    600: "#3C7546",
    700: "#2A5F37",
    800: "#1F4A2B",
    900: "#153320",
  },

  dark: {
    0: "#000",
    100: "#202020",
    60: "#525252",
    placeholder: "#898989",
  },

  error: {
    100: "#FEE2E2",
    200: "#FECACA",
    300: "#FCA5A5",
    400: "#F87171",
    50: "#FEF2F2",
    500: "#EF4444",
    600: "#DC2626",
    700: "#B91C1C",
    800: "#991B1B",
    900: "#7F1D1D",
  },

  gradients: {
    ashamPromo: {
      colors: ["#3F922B", "#6EBA40", "#B0F35C"] as string[],
      end: { x: 1, y: 0.7 },
      locations: [0.06, 0.65, 1] as number[],
      start: { x: 0, y: 0 },
    },
    promo: {
      colors: ["#3F922B", "#B0F35C"] as string[],
      end: { x: 1, y: 1 },
      start: { x: 0.1, y: 0 },
    },
  },

  neutral: {
    100: "#EFEFEF",
    200: "#DFDFDF",
    250: "#F4F4F4",
    300: "#CECECE",
    400: "#BEBEBE",
    50: "#F5F5F5",
    500: "#939393",
    600: "#797982",
    700: "#56565D",
    800: "#343438",
    850: "#1D1D1D",
    900: "#111113",
  },

  primary: {
    100: "#4A8F58",
    200: "#3C7546",
    "100/50": "#9BC1A3",
    "primary-transparent": "rgba(74,143,88,0.5)",
  },

  secondary: {
    100: "#DEEFFA",
    200: "#B7DEF4",
    300: "#79BCCC",
    400: "#6FBDEA",
    50: "#F3FAFD",
    500: "#1F8DCC",
    600: "#1A7BB3",
    700: "#135B8D",
    800: "#0D354D",
    900: "#04121A",
  },

  shades: {
    black: "#000000",
    white: "#FFFFFF",
  },

  success: {
    100: "#D1FAE5",
    200: "#A7F3D0",
    300: "#6EE7B7",
    400: "#34D399",
    50: "#ECFDF5",
    500: "#10B981",
    600: "#059669",
    700: "#047857",
    800: "#065F46",
    900: "#064E3B",
  },
  warning: {
    100: "#FEF3C7",
    200: "#FDE68A",
    300: "#FCD34D",
    400: "#FBBF24",
    50: "#FFF8EB",
    500: "#F59E0B",
    600: "#D97706",
    700: "#B45309",
    800: "#92400E",
    900: "#78350F",
  },
} as const;

export type ColorPalette = typeof colors;
