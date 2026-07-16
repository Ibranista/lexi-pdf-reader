import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors } from '@/constants/colors';

type Surface = 'base' | 'raised' | 'canvas';

interface ScreenProps {
  children: ReactNode;
  surface?: Surface;
  edges?: readonly Edge[];
  style?: ViewStyle;
}

const surfaceColor: Record<Surface, string> = {
  base: colors.light.background,
  raised: colors.light.surfaceRaised,
  canvas: colors.light.canvas,
};

export function Screen({
  children,
  surface = 'base',
  edges = ['top', 'bottom'],
  style,
}: ScreenProps) {
  return (
    <View style={[styles.root, { backgroundColor: surfaceColor[surface] }]}>
      <SafeAreaView style={[styles.safe, style]} edges={edges}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
});
