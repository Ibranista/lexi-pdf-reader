import { StyleSheet, Text, type TextProps } from 'react-native';

import { palette } from '@/constants/colors';
import { serifFamily } from '@/theme/app-fonts';

type Tone = 'amber' | 'green';

interface HighlightProps extends TextProps {
  tone?: Tone;
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
    fontFamily: serifFamily,
    color: palette.ink[800],
    borderRadius: 3,
  },
});
