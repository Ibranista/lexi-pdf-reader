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
  // The reader's four typefaces, offered by name. Two are ordinary reading
  // faces — Literata and Hanken Grotesk — and two are the ones readers with
  // dyslexia are pointed to: Atkinson Hyperlegible, drawn by the Braille
  // Institute to make confusable letters unmistakable, and Comic Relief.
  'HankenGrotesk-Medium': require('./assets/fonts/hanken-grotesk/HankenGrotesk-Medium.ttf'),
  'HankenGrotesk-SemiBold': require('./assets/fonts/hanken-grotesk/HankenGrotesk-SemiBold.ttf'),
  'AtkinsonHyperlegible-Regular': require('./assets/fonts/atkinson-hyperlegible/AtkinsonHyperlegible-Regular.ttf'),
  'AtkinsonHyperlegible-Bold': require('./assets/fonts/atkinson-hyperlegible/AtkinsonHyperlegible-Bold.ttf'),
  // Comic Sans MS itself is Microsoft's and cannot be shipped. Comic Relief is
  // metrically equivalent to it and openly licensed (OFL, see the folder), so
  // this is the face the dyslexia research means, legally. Comic Neue was the
  // other candidate and is the wrong one: it exists to beat the "squashed,
  // wonky" glyphs into shape, and that wonkiness is the part that helps.
  'ComicRelief-Regular': require('./assets/fonts/comic-relief/ComicRelief-Regular.ttf'),
  'ComicRelief-Bold': require('./assets/fonts/comic-relief/ComicRelief-Bold.ttf'),
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

/** Hanken Grotesk, the reader's sans — active/inactive chip weights. */
export const hankenFamily = {
  active: 'HankenGrotesk-SemiBold',
  inactive: 'HankenGrotesk-Medium',
};

/** Atkinson Hyperlegible — ships only 400/700. */
export const atkinsonFamily = {
  active: 'AtkinsonHyperlegible-Bold',
  inactive: 'AtkinsonHyperlegible-Regular',
};

/** Comic Relief, the openly-licensed Comic Sans — also only 400/700. */
export const comicFamily = {
  active: 'ComicRelief-Bold',
  inactive: 'ComicRelief-Regular',
};

export const monoFamily = Platform.select({
  ios: 'Menlo',
  default: 'monospace',
});
