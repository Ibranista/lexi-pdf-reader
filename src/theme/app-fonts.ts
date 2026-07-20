import { Platform } from 'react-native';

/**
 * Single source of truth for the app's fonts.
 *
 * - Manrope ships as static files, so each weight is registered as its own
 *   family — pick via `sansFamily[weight]` instead of `fontWeight`.
 * - Literata ships as variable fonts (upright + italic). React Native renders
 *   a variable font at its default weight, so serif text also sets
 *   `fontWeight` to let platforms that can synthesize weights do so.
 */

/** Font files registered at startup (loaded in `src/app/_layout.tsx`). */
export const fontAssets = {
  'Manrope-ExtraLight': require('./assets/fonts/manrope/Manrope-ExtraLight.ttf'),
  'Manrope-Light': require('./assets/fonts/manrope/Manrope-Light.ttf'),
  'Manrope-Regular': require('./assets/fonts/manrope/Manrope-Regular.ttf'),
  'Manrope-Medium': require('./assets/fonts/manrope/Manrope-Medium.ttf'),
  'Manrope-SemiBold': require('./assets/fonts/manrope/Manrope-SemiBold.ttf'),
  'Manrope-Bold': require('./assets/fonts/manrope/Manrope-Bold.ttf'),
  'Manrope-ExtraBold': require('./assets/fonts/manrope/Manrope-ExtraBold.ttf'),
  Literata: require('./assets/fonts/Literata/Literata-VariableFont_opsz,wght.ttf'),
  'Literata-Italic': require('./assets/fonts/Literata/Literata-Italic-VariableFont_opsz,wght.ttf'),
  // Reader typeface options (mirrors the prototype's famMap): Hanken Grotesk
  // for "Sans", Atkinson Hyperlegible for "Dyslexic" — Literata is "Serif".
  'HankenGrotesk-Medium': require('./assets/fonts/hanken-grotesk/HankenGrotesk-Medium.ttf'),
  'HankenGrotesk-SemiBold': require('./assets/fonts/hanken-grotesk/HankenGrotesk-SemiBold.ttf'),
  'AtkinsonHyperlegible-Regular': require('./assets/fonts/atkinson-hyperlegible/AtkinsonHyperlegible-Regular.ttf'),
  'AtkinsonHyperlegible-Bold': require('./assets/fonts/atkinson-hyperlegible/AtkinsonHyperlegible-Bold.ttf'),
};

export type FontWeight = '200' | '300' | '400' | '500' | '600' | '700' | '800';

export const sansFamily: Record<FontWeight, string> = {
  '200': 'Manrope-ExtraLight',
  '300': 'Manrope-Light',
  '400': 'Manrope-Regular',
  '500': 'Manrope-Medium',
  '600': 'Manrope-SemiBold',
  '700': 'Manrope-Bold',
  '800': 'Manrope-ExtraBold',
};

export const serifFamily = 'Literata';
export const serifItalicFamily = 'Literata-Italic';

/** Reader "Sans" (Hanken Grotesk) — active/inactive chip weights. */
export const hankenFamily = {
  active: 'HankenGrotesk-SemiBold',
  inactive: 'HankenGrotesk-Medium',
};

/** Reader "Dyslexic" (Atkinson Hyperlegible) — ships only 400/700. */
export const dysFamily = {
  active: 'AtkinsonHyperlegible-Bold',
  inactive: 'AtkinsonHyperlegible-Regular',
};

export const monoFamily = Platform.select({
  ios: 'Menlo',
  default: 'monospace',
});
