import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/constants/colors';
import { fonts } from './tokens';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export function LoadingSpinner({
  size = 'large',
  color = colors.light.accent,
  label,
  style,
}: LoadingSpinnerProps) {
  return (
    <View
      style={[styles.container, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={label ?? 'Loading'}
    >
      <ActivityIndicator size={size} color={color} />
      {label != null && <Text style={styles.label}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.light.textSecondary,
    marginTop: 8,
  },
});
