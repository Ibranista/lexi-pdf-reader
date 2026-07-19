import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/constants/colors';
import { sansFamily } from '@/theme/app-fonts';
import { radius } from './tokens';

interface ChipProps {
  label: string;
  selected?: boolean;
  icon?: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function Chip({ label, selected = false, icon, onPress, style }: ChipProps) {
  const c = colors.light;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.base,
        selected
          ? { backgroundColor: c.accentSurface, borderColor: c.accent }
          : { backgroundColor: c.surface, borderColor: c.border },
        pressed && styles.pressed,
        style,
      ]}
    >
      {icon}
      <Text style={[styles.label, { color: selected ? c.accentText : c.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pressed: { opacity: 0.75 },
  label: {
    fontFamily: sansFamily['500'],
    fontSize: 13,
  },
});
