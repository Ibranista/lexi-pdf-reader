import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/constants/colors';
import { Checkbox } from './Checkbox';
import { sansFamily } from '@/theme/app-fonts';
import { radius } from './tokens';

interface SelectRowProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  selected?: boolean;
  onPress?: () => void;
  shape?: 'check' | 'radio';
  trailing?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function SelectRow({
  title,
  subtitle,
  icon,
  selected = false,
  onPress,
  shape = 'check',
  trailing,
  style,
}: SelectRowProps) {
  const c = colors.light;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={shape === 'radio' ? 'radio' : 'checkbox'}
      accessibilityState={{ selected, checked: selected }}
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.row,
        selected ? styles.selected : styles.default,
        pressed && styles.pressed,
        style,
      ]}
    >
      {icon != null && (
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: selected ? c.accentSurface : c.fill },
          ]}
        >
          {icon}
        </View>
      )}
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {subtitle != null && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {trailing ?? <Checkbox checked={selected} shape={shape} />}
    </Pressable>
  );
}

const c = colors.light;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: 16,
    borderWidth: 1,
  },
  default: { borderColor: c.border },
  selected: { borderColor: c.accent, borderWidth: 1.5 },
  pressed: { opacity: 0.9 },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  title: {
    fontFamily: sansFamily['600'],
    fontSize: 15,
    color: c.text,
  },
  subtitle: {
    fontFamily: sansFamily['400'],
    fontSize: 12,
    color: c.textSecondary,
    marginTop: 2,
  },
});
