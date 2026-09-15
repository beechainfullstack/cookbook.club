import type { ExpoConfig } from 'expo/config';
import copy from './copy.json';

const config: ExpoConfig = {
  name: copy.brand.name,
  slug: 'cookbook-club',
  version: '1.0.0',
  orientation: 'portrait',
  scheme: 'cookbook',
  userInterfaceStyle: 'light',
  ios: { supportsTablet: true, bundleIdentifier: 'club.cookbook.app' },
  android: { package: 'club.cookbook.app' },
  web: { bundler: 'metro', name: copy.brand.name },
  plugins: [
    ['expo-contacts', { contactsPermission: copy.permissions.contacts_subtitle.replace(/\{school_name\}/g, () => copy.onboarding.schoolFallback) }],
    'expo-notifications',
    'expo-secure-store',
    '@react-native-community/datetimepicker',
    'expo-font',
  ],
  extra: { eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID } },
};

export default config;
