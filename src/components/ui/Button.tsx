import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors } from '@/constants/colors';
import { sansFamily } from '@/theme/app-fonts';
import { radius } from './tokens';

// ============================================================================
// Button
// ============================================================================
// Presentational — pass an `onPress`; real behavior gets wired later.

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  /** Stretch to fill the container width (default true — the design uses full-width CTAs). */
  fullWidth?: boolean;
  /** Optional leading icon slot. */
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

const c = colors.light;

const containerVariant: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: c.inkButton },
  accent: { backgroundColor: c.accent },
  secondary: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  ghost: { backgroundColor: 'transparent' },
};

const labelColorVariant: Record<Variant, string> = {
  primary: c.onInk,
  accent: c.onAccent,
  secondary: c.text,
  ghost: c.accentText,
};

const sizeStyle: Record<Size, ViewStyle> = {
  sm: { height: 40, paddingHorizontal: 16, borderRadius: radius.md },
  md: { height: 48, paddingHorizontal: 20, borderRadius: radius.lg },
  lg: { height: 54, paddingHorizontal: 24, borderRadius: radius.lg },
};

const labelSize: Record<Size, number> = { sm: 14, md: 15, lg: 15 };

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  fullWidth = true,
  icon,
  disabled = false,
  loading = false,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const tint = labelColorVariant[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        sizeStyle[size],
        containerVariant[variant],
        fullWidth && styles.fullWidth,
        pressed && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={tint} />
      ) : (
        <View style={styles.content}>
          {icon != null && <View>{icon}</View>}
          <Text style={[styles.label, { color: tint, fontSize: labelSize[size] }]}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: { alignSelf: 'stretch' },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontFamily: sansFamily['600'],
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
});
