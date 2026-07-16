import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/constants/colors';
import { fonts, radius } from './tokens';

type Tone = 'accent' | 'neutral' | 'ink';

interface BadgeProps {
  label: string;
  tone?: Tone;
  uppercase?: boolean;
  style?: StyleProp<ViewStyle>;
}

const c = colors.light;

const toneStyle: Record<Tone, { bg: string; fg: string }> = {
  accent: { bg: c.accent, fg: c.onAccent },
  neutral: { bg: c.fill, fg: c.text },
  ink: { bg: c.inkButton, fg: c.onInk },
};

export function Badge({ label, tone = 'accent', uppercase = false, style }: BadgeProps) {
  const { bg, fg } = toneStyle[tone];
  return (
    <View style={[styles.base, { backgroundColor: bg }, style]}>
      <Text
        style={[
          styles.label,
          { color: fg },
          uppercase && styles.uppercase,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  label: {
    fontFamily: fonts.sans,
    fontWeight: '700',
    fontSize: 10,
  },
  uppercase: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
