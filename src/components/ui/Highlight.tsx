import { StyleSheet, Text, type TextProps } from 'react-native';

import { palette } from '@/constants/colors';
import { fonts } from './tokens';

// ============================================================================
// Highlight — inline reading highlight (amber = key idea, green = vocabulary)
// ============================================================================

type Tone = 'amber' | 'green';

interface HighlightProps extends TextProps {
  tone?: Tone;
  /** Stronger (active) highlight shade. */
  strong?: boolean;
}

export function Highlight({ tone = 'amber', strong = false, style, ...props }: HighlightProps) {
  const bg =
    tone === 'amber'
      ? strong
        ? palette.highlight.amberStrong
        : palette.highlight.amber
      : strong
        ? palette.highlight.greenStrong
        : palette.highlight.green;

  return <Text style={[styles.mark, { backgroundColor: bg }, style]} {...props} />;
}

const styles = StyleSheet.create({
  mark: {
    fontFamily: fonts.serif,
    color: palette.ink[800],
    borderRadius: 3,
  },
});
