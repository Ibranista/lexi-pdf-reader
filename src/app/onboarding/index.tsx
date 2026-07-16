import { router } from 'expo-router';

import { OnboardingScreen, READER_TYPE_ICONS } from '@/components/onboarding';
import { Button, SelectRow } from '@/components/ui';
import { colors } from '@/constants/colors';
import { ONBOARDING_STEPS, READER_TYPE_OPTIONS } from '@/constants/onboarding';
import { useOnboardingStore } from '@/stores/onboarding-store';

const STEP = ONBOARDING_STEPS[0];

export default function ReaderTypeScreen() {
  const readerType = useOnboardingStore((s) => s.readerType);
  const selectReaderType = useOnboardingStore((s) => s.selectReaderType);
  const completeOnboarding = useOnboardingStore((s) => s.completeOnboarding);

  const skip = () => {
    completeOnboarding();
    router.replace('/');
  };

  return (
    <OnboardingScreen
      stepIndex={0}
      title={STEP.title}
      subtitle={STEP.subtitle}
      onSkip={skip}
      footer={
        <Button label={STEP.ctaLabel} onPress={() => router.push('/onboarding/reading-helps')} />
      }
    >
      {READER_TYPE_OPTIONS.map((option) => {
        const selected = readerType === option.id;
        const Icon = READER_TYPE_ICONS[option.id];
        return (
          <SelectRow
            key={option.id}
            title={option.title}
            subtitle={option.description}
            shape="radio"
            selected={selected}
            icon={<Icon color={selected ? colors.light.accentText : colors.light.text} />}
            onPress={() => selectReaderType(option.id)}
          />
        );
      })}
    </OnboardingScreen>
  );
}
