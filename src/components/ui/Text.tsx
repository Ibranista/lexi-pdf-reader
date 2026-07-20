import { Text as RNText, StyleSheet, type TextProps as RNTextProps } from 'react-native';

import { colors } from '@/constants/colors';
import { sansFamily, serifFamily } from '@/theme/app-fonts';

// ============================================================================
// Text — typographic primitive for the LexiPDF paper theme
// ============================================================================

type Variant =
  | 'display' // large serif headline (Literata)
  | 'title' // section / screen title (Literata)
  | 'heading' // card / group heading (Hanken)
  | 'body' // default body
  | 'reading' // long-form serif reading text (Literata)
  | 'secondary' // muted supporting text
  | 'label' // small strong label
  | 'caption' // smallest muted text
  | 'mono'; // monospace / code

interface TextProps extends RNTextProps {
  variant?: Variant;
  /** Override the token color, e.g. colors.light.accentText. */
  color?: string;
}

export function Text({ variant = 'body', color, style, ...props }: TextProps) {
  return (
    <RNText
      style={[styles[variant], color ? { color } : null, style]}
      {...props}
    />
  );
}

const c = colors.light;

const styles = StyleSheet.create({
  display: {
    fontFamily: serifFamily,
    fontSize: 28,
    lineHeight: 35,
    letterSpacing: -0.3,
    color: c.text,
  },
  title: {
    fontFamily: serifFamily,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.2,
    color: c.text,
  },
  heading: {
    fontFamily: sansFamily['600'],
    fontSize: 15,
    color: c.text,
  },
  body: {
    fontFamily: sansFamily['400'],
    fontSize: 14,
    lineHeight: 21,
    color: c.text,
  },
  reading: {
    fontFamily: serifFamily,
    fontSize: 17,
    lineHeight: 30,
    color: colors.light.text,
  },
  secondary: {
    fontFamily: sansFamily['400'],
    fontSize: 13,
    lineHeight: 19,
    color: c.textSecondary,
  },
  label: {
    fontFamily: sansFamily['600'],
    fontSize: 12,
    color: c.text,
  },
  caption: {
    fontFamily: sansFamily['400'],
    fontSize: 11.5,
    lineHeight: 16,
    color: c.textSecondary,
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: c.textSecondary,
  },
});
