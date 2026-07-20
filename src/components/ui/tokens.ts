import { Platform } from 'react-native';

/**
 * Non-color design tokens shared across the LexiPDF base components.
 * Colors live in `@/constants/colors`.
 */

/** Font families used in the design. Registered fonts must match these names. */
export const fonts = Platform.select({
  web: {
    sans: "'Hanken Grotesk', system-ui, sans-serif",
    serif: "'Literata', Georgia, serif",
    legible: "'Atkinson Hyperlegible', system-ui, sans-serif",
  },
  default: {
    sans: 'Hanken Grotesk',
    serif: 'Literata',
    legible: 'Atkinson Hyperlegible',
  },
})!;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 18,
  pill: 999,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;
