/**
 * LexiPDF color tokens — extracted from the product design.
 *
 * The design is a warm "paper & ink" theme: off-white paper backgrounds, a warm
 * near-black ink for text, and a terracotta accent that marks anything AI / Pro.
 * Reading highlights come in amber (key idea) and green (vocabulary).
 *
 * These are framework-agnostic plain values — consume them directly in a
 * StyleSheet today, or feed them into a Tailwind / NativeWind config later.
 */

// ---------------------------------------------------------------------------
// Raw palette
// ---------------------------------------------------------------------------

export const palette = {
  /** Warm off-white backgrounds, lightest → most tinted. */
  paper: {
    bright: '#FDFBF8',
    raised: '#FBF8F3', // reader surface
    base: '#F6F3EE', // default screen background
    muted: '#F1EBE2',
    sand: '#ECE6DD',
    canvas: '#EFEBE4', // canvas behind cards
    card: '#FFFFFF',
  },

  /** Warm near-black ink, darkest → lightest. Text, borders, subtle fills. */
  ink: {
    900: '#16130F',
    800: '#201B15', // primary text
    700: '#2A241C', // serif reading text
    600: '#332D25',
    500: '#4A4238',
    400: '#5E574C',
    300: '#7A7062', // secondary text
    200: '#A2988A', // tertiary text
    150: '#B4AA9B', // placeholder
    100: '#C9BFB1',
  },

  /** Terracotta accent — AI features, Pro, selected state. */
  accent: {
    900: '#7A3410',
    800: '#8E3813',
    700: '#A54117', // accent text on paper
    500: '#B84B21', // primary accent
    400: '#CD632D', // amber-orange (logo dot, warm accents)
    100: '#FBE2D9', // light accent surface
    50: '#FCF3F0', // subtle accent row tint
  },

  /** Reading highlight colors. */
  highlight: {
    amber: '#F6E0BE',
    amberStrong: '#F2CE93',
    green: '#8FD9BE',
    greenStrong: '#9BDCC0',
  },

  /** Dark surfaces — dark mode & focus mode. */
  night: {
    deep: '#0F0D0A',
    base: '#16130F',
    raised: '#211D17',
    gradientTop: '#241E16',
    text: '#F1EBE2',
    textDim: '#DDD5C8',
  },

  /** Category / tag dots. */
  tag: {
    amber: '#CD632D',
    green: '#7BC9A6',
    blue: '#8DB4E2',
    purple: '#B79AD6',
  },

  white: '#FFFFFF',
  black: '#000000',
} as const;

// ---------------------------------------------------------------------------
// Ink overlay helper
// ---------------------------------------------------------------------------

/** Warm-ink overlay at a given alpha — used for borders and subtle fills. */
export function withInk(alpha: number): string {
  return `rgba(32,27,21,${alpha})`;
}

/** Paper overlay at a given alpha — used on dark surfaces. */
export function withPaper(alpha: number): string {
  return `rgba(241,235,226,${alpha})`;
}

// ---------------------------------------------------------------------------
// Semantic tokens (light / dark)
// ---------------------------------------------------------------------------

export const colors = {
  light: {
    background: palette.paper.base,
    canvas: palette.paper.canvas,
    surface: palette.paper.card,
    surfaceRaised: palette.paper.raised,

    text: palette.ink[800],
    textSecondary: palette.ink[300],
    textTertiary: palette.ink[200],
    placeholder: palette.ink[150],

    accent: palette.accent[500],
    accentText: palette.accent[700],
    accentSurface: palette.accent[100],
    accentSurfaceSubtle: palette.accent[50],

    border: withInk(0.08),
    borderStrong: withInk(0.15),
    fill: withInk(0.05),
    fillStrong: withInk(0.12),

    onAccent: palette.white,
    onInk: palette.paper.base,
    inkButton: palette.ink[800],
  },

  dark: {
    background: palette.night.base,
    canvas: palette.night.deep,
    surface: palette.night.raised,
    surfaceRaised: palette.night.raised,

    text: palette.night.text,
    textSecondary: palette.ink[200],
    textTertiary: palette.ink[300],
    placeholder: palette.ink[400],

    accent: palette.accent[400],
    accentText: palette.accent[400],
    accentSurface: withPaper(0.1),
    accentSurfaceSubtle: withPaper(0.06),

    border: withPaper(0.1),
    borderStrong: withPaper(0.2),
    fill: withPaper(0.06),
    fillStrong: withPaper(0.12),

    onAccent: palette.white,
    onInk: palette.night.text,
    inkButton: palette.paper.base,
  },
} as const;

// ---------------------------------------------------------------------------
// Gradients
// ---------------------------------------------------------------------------

export const gradients = {
  /** Splash / logo backdrop — radial warm dark. */
  splash: {
    colors: [palette.night.gradientTop, palette.night.base] as string[],
    // radial(120% 90% at 50% 30%)
    start: { x: 0.5, y: 0.3 },
    end: { x: 0.5, y: 1 },
  },
} as const;

export type Palette = typeof palette;
export type ThemeColors = typeof colors.light;
export type ColorScheme = keyof typeof colors;
