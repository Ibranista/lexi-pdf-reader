import { router } from 'expo-router';

import { OnboardingScreen } from '@/components/onboarding';
import { Button, SelectRow } from '@/components/ui';
import { ONBOARDING_STEPS, READING_HELP_OPTIONS } from '@/constants/onboarding';
import { useOnboardingStore } from '@/stores/onboarding-store';

const STEP = ONBOARDING_STEPS[1];

export default function ReadingHelpsScreen() {
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
      title={STEP.title}
      subtitle={STEP.subtitle}
      onSkip={skip}
      footer={<Button label={STEP.ctaLabel} onPress={() => router.push('/onboarding/ready')} />}
    >
      {READING_HELP_OPTIONS.map((option) => (
        <SelectRow
          key={option.id}
          title={option.title}
          subtitle={option.description}
          shape="check"
          selected={helps.includes(option.id)}
          onPress={() => toggleHelp(option.id)}
        />
      ))}
    </OnboardingScreen>
  );
}
