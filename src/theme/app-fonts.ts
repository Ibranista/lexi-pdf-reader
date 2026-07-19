import { Platform } from 'react-native';

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

export const monoFamily = Platform.select({
  ios: 'Menlo',
  default: 'monospace',
});
