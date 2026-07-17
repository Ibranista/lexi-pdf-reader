import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { OnboardingScreen, READER_TYPE_ICONS } from '@/components/onboarding';
import { Button, SelectRow } from '@/components/ui';
import { colors } from '@/constants/colors';
import { READER_TYPE_IDS } from '@/constants/onboarding';
import { useOnboardingStore } from '@/stores/onboarding-store';

export default function ReaderTypeScreen() {
  const { t } = useTranslation('onboarding');
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
      title={t('steps.0.title')}
      subtitle={t('steps.0.subtitle')}
      onSkip={skip}
      footer={
        <Button label={t('steps.0.ctaLabel')} onPress={() => router.push('/onboarding/reading-helps')} />
      }
    >
      {READER_TYPE_IDS.map((id) => {
        const selected = readerType === id;
        const Icon = READER_TYPE_ICONS[id];
        return (
          <SelectRow
            key={id}
            title={t(`readerTypes.${id}.title`)}
            subtitle={t(`readerTypes.${id}.description`)}
            shape="radio"
            selected={selected}
            icon={<Icon color={selected ? colors.light.accentText : colors.light.text} />}
            onPress={() => selectReaderType(id)}
          />
        );
      })}
    </OnboardingScreen>
  );
}
