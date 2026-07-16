import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/colors';
import { fonts } from './tokens';

// ============================================================================
// StatusBar — the mocked 9:41 / battery bar from the design frames
// ============================================================================
// Presentational only. In the real app the OS status bar handles this; this
// mirrors the design mockups for building screens in isolation.

interface StatusBarProps {
  time?: string;
  tint?: string;
}

export function StatusBar({ time = '9:41', tint = colors.light.text }: StatusBarProps) {
  return (
    <View style={styles.row}>
      <Text style={[styles.time, { color: tint }]}>{time}</Text>
      <View style={[styles.battery, { borderColor: tint }]}>
        <View style={[styles.batteryFill, { backgroundColor: tint }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  time: {
    fontFamily: fonts.sans,
    fontWeight: '600',
    fontSize: 14,
  },
  battery: {
    width: 16,
    height: 9,
    borderWidth: 1,
    borderRadius: 2.5,
    padding: 1.5,
    paddingRight: 4,
  },
  batteryFill: {
    flex: 1,
    borderRadius: 1,
  },
});
