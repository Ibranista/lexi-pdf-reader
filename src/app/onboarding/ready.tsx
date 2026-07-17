import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { OnboardingScreen } from '@/components/onboarding';
import { Button, Card, FeatureRow, space } from '@/components/ui';
import { colors } from '@/constants/colors';
import { useOnboardingStore } from '@/stores/onboarding-store';

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
  const { t } = useTranslation('onboarding');
  const readerType = useOnboardingStore((s) => s.readerType);
  const helps = useOnboardingStore((s) => s.helps);
  const completeOnboarding = useOnboardingStore((s) => s.completeOnboarding);

  const rows = [
    {
      title: t(`readerTypes.${readerType}.summary.title`),
      description: t(`readerTypes.${readerType}.summary.description`),
    },
    ...helps.map((id) => ({
      title: t(`readingHelps.${id}.summary.title`),
      description: t(`readingHelps.${id}.summary.description`),
    })),
  ];

  const start = () => {
    completeOnboarding();
    router.replace('/');
  };

  return (
    <OnboardingScreen
      stepIndex={2}
      title={t('steps.2.title')}
      subtitle={t('steps.2.subtitle')}
      footer={<Button label={t('steps.2.ctaLabel')} onPress={start} />}
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
