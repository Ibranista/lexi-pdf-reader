import type { ReactNode } from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/constants/colors';
import { radius } from './tokens';

// ============================================================================
// IconButton — the 38px rounded-square icon button from headers
// ============================================================================

type Variant = 'fill' | 'plain';

interface IconButtonProps {
  children: ReactNode;
  onPress?: () => void;
  variant?: Variant;
  size?: number;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  children,
  onPress,
  variant = 'plain',
  size = 38,
  accessibilityLabel,
  style,
}: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.base,
        { width: size, height: size },
        variant === 'fill' && styles.fill,
        pressed && styles.pressed,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: { backgroundColor: colors.light.fill },
  pressed: { opacity: 0.6 },
});
