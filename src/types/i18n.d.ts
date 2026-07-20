import 'react-i18next';
import type homeEn from '@/locales/en/home.json';
import type onboardingEn from '@/locales/en/onboarding.json';

declare module 'react-i18next' {
  interface CustomTypeOptions {
    defaultNS: 'home';
    resources: {
      home: typeof homeEn;
      onboarding: typeof onboardingEn;
    };
  }
}
