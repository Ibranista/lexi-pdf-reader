import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { colors } from '@/constants/colors';
import { ProgressDots, Screen, space, Text } from '@/components/ui';

const TOTAL_STEPS = 3;

interface OnboardingScreenProps {
  /** Zero-based index of the active step, for the progress dots. */
  stepIndex: number;
  title: string;
  subtitle: string;
  /** Options/rows for this step. */
  children: ReactNode;
  /** Pinned bottom CTA. */
  footer: ReactNode;
  /** Omit to hide the skip action (e.g. on the final "ready" step). */
  onSkip?: () => void;
}

/** Shared chrome for onboarding steps: progress dots, skip, scrollable body, pinned CTA. */
export function OnboardingScreen({
  stepIndex,
  title,
  subtitle,
  children,
  footer,
  onSkip,
}: OnboardingScreenProps) {
  return (
    <Screen>
      <View style={styles.topBar}>
        <ProgressDots count={TOTAL_STEPS} index={stepIndex} />
        {onSkip != null ? (
          <Text variant="label" color={colors.light.textSecondary} onPress={onSkip}>
            Skip
          </Text>
        ) : (
          <View style={styles.skipPlaceholder} />
        )}
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="display">{title}</Text>
        <Text variant="secondary" style={styles.subtitle}>
          {subtitle}
        </Text>
        <View style={styles.options}>{children}</View>
      </ScrollView>
      <View style={styles.footer}>{footer}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl + space.xs,
    paddingTop: space.sm,
  },
  skipPlaceholder: { width: space.xl, height: space.xl },
  scrollContent: {
    paddingHorizontal: space.xl + space.xs,
    paddingTop: space.xl,
    paddingBottom: space.xxl,
    flexGrow: 1,
  },
  subtitle: { marginTop: space.sm + 2 },
  options: {
    marginTop: space.xl,
    gap: space.md,
  },
  footer: {
    paddingHorizontal: space.xl,
    paddingBottom: space.xxl + space.sm,
  },
});
