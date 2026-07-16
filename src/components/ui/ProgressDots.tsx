import { StyleSheet, View } from 'react-native';

import { colors } from '@/constants/colors';

interface ProgressDotsProps {
  count: number;
  index: number;
}

export function ProgressDots({ count, index }: ProgressDotsProps) {
  const c = colors.light;
  return (
    <View style={styles.row} accessibilityRole="progressbar">
      {Array.from({ length: count }).map((_, i) => {
        const active = i === index;
        const done = i < index;
        return (
          <View
            key={i}
            style={[
              styles.dot,
              active && styles.active,
              {
                backgroundColor: active
                  ? c.accent
                  : done
                    ? c.borderStrong
                    : c.fillStrong,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 5,
    borderRadius: 3,
  },
  active: { width: 24 },
});
