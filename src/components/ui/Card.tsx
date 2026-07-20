import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/constants/colors';
import { radius } from './tokens';

// ============================================================================
// Card — white surface with a hairline warm-ink border
// ============================================================================

interface CardProps {
  children: ReactNode;
  /** Draw the accent border/state (e.g. a selected or highlighted card). */
  selected?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, selected = false, padded = true, style }: CardProps) {
  return (
    <View
      style={[
        styles.base,
        padded && styles.padded,
        selected ? styles.selected : styles.default,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const c = colors.light;

const styles = StyleSheet.create({
  base: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  padded: { padding: 16 },
  default: { borderColor: c.border },
  selected: { borderColor: c.accent, borderWidth: 1.5 },
});
