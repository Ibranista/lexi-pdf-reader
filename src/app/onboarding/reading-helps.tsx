import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { OnboardingScreen } from '@/components/onboarding';
import { Button, SelectRow } from '@/components/ui';
import { READING_HELP_IDS } from '@/constants/onboarding';
import { useOnboardingStore } from '@/stores/onboarding-store';

export default function ReadingHelpsScreen() {
  const { t } = useTranslation('onboarding');
  const helps = useOnboardingStore((s) => s.helps);
  const toggleHelp = useOnboardingStore((s) => s.toggleHelp);
  const completeOnboarding = useOnboardingStore((s) => s.completeOnboarding);

  const skip = () => {
    completeOnboarding();
    router.replace('/');
  };

  return (
    <OnboardingScreen
      stepIndex={1}
      title={t('steps.1.title')}
      subtitle={t('steps.1.subtitle')}
      onSkip={skip}
      footer={<Button label={t('steps.1.ctaLabel')} onPress={() => router.push('/onboarding/ready')} />}
    >
      {READING_HELP_IDS.map((id) => (
        <SelectRow
          key={id}
          title={t(`readingHelps.${id}.title`)}
          subtitle={t(`readingHelps.${id}.description`)}
          shape="check"
          selected={helps.includes(id)}
          onPress={() => toggleHelp(id)}
        />
      ))}
    </OnboardingScreen>
  );
}
