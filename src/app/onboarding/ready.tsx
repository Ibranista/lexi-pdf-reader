import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { OnboardingScreen } from '@/components/onboarding';
import { Button, Card, FeatureRow, space } from '@/components/ui';
import { colors } from '@/constants/colors';
import {
  ONBOARDING_STEPS,
  READER_TYPE_SUMMARY,
  READING_HELP_SUMMARY,
} from '@/constants/onboarding';
import { useOnboardingStore } from '@/stores/onboarding-store';

const STEP = ONBOARDING_STEPS[2];
const c = colors.light;

function CheckIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 20 20" fill="none">
      <Path
        d="M4 10.5l4 4L16 6"
        stroke={c.accentText}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function ReadyScreen() {
  const readerType = useOnboardingStore((s) => s.readerType);
  const helps = useOnboardingStore((s) => s.helps);
  const completeOnboarding = useOnboardingStore((s) => s.completeOnboarding);

  const rows = [READER_TYPE_SUMMARY[readerType], ...helps.map((help) => READING_HELP_SUMMARY[help])];

  const start = () => {
    completeOnboarding();
    router.replace('/');
  };

  return (
    <OnboardingScreen
      stepIndex={2}
      title={STEP.title}
      subtitle={STEP.subtitle}
      footer={<Button label={STEP.ctaLabel} onPress={start} />}
    >
      <View style={styles.rows}>
        {rows.map((row) => (
          <Card key={row.title} style={styles.row}>
            <FeatureRow title={row.title} description={row.description} icon={<CheckIcon />} />
          </Card>
        ))}
      </View>
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  rows: { gap: space.sm + 2 },
  row: { padding: 14 },
});
