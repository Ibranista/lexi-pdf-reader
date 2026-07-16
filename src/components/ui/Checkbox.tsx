import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors } from '@/constants/colors';

interface CheckboxProps {
  checked?: boolean;
  shape?: 'check' | 'radio';
  size?: number;
}

export function Checkbox({ checked = false, shape = 'check', size = 22 }: CheckboxProps) {
  const c = colors.light;
  return (
    <View
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2 },
        checked
          ? { backgroundColor: c.accent }
          : { borderWidth: 1.5, borderColor: c.borderStrong },
      ]}
    >
      {checked && shape === 'check' && (
        <Svg width={size * 0.55} height={size * 0.55} viewBox="0 0 20 20" fill="none">
          <Path
            d="M4 10.5l4 4L16 6"
            stroke={c.onAccent}
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      )}
      {checked && shape === 'radio' && (
        <View style={[styles.dot, { backgroundColor: c.onAccent }]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
