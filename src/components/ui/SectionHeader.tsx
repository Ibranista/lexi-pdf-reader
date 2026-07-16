import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { colors } from '@/constants/colors';
import { fonts } from './tokens';

interface SectionHeaderProps {
  title: string;
  onBack?: () => void;
  showBack?: boolean;
  trailing?: ReactNode;
}

export function SectionHeader({
  title,
  onBack,
  showBack = true,
  trailing,
}: SectionHeaderProps) {
  const c = colors.light;
  return (
    <View style={styles.row}>
      {showBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <Svg width={19} height={19} viewBox="0 0 20 20" fill="none">
            <Path
              d="M12 4l-6 6 6 6"
              stroke={c.text}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
      ) : (
        <View style={styles.back} />
      )}
      <Text style={styles.title}>{title}</Text>
      <View style={styles.trailing}>{trailing}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  back: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  title: {
    flex: 1,
    fontFamily: fonts.sans,
    fontWeight: '600',
    fontSize: 16,
    color: colors.light.text,
  },
  trailing: {
    minWidth: 38,
    alignItems: 'flex-end',
  },
});
