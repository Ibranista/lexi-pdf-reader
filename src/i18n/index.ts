import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import translation files
import homeEn from '@/locales/en/home.json';
import onboardingEn from '@/locales/en/onboarding.json';

const resources = {
  en: {
    home: homeEn,
    onboarding: onboardingEn,
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    defaultNS: 'home',
  });

export default i18n;
