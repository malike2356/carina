import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Carina',
  slug: 'carina-mobile',
  version: '0.1.0',
  scheme: 'carina',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  newArchEnabled: true,
  splash: {
    backgroundColor: '#09161e',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'uk.carinaai.mobile',
    infoPlist: {
      UIBackgroundModes: ['remote-notification'],
      NSSpeechRecognitionUsageDescription:
        'Carina uses speech recognition so you can dictate messages.',
      NSMicrophoneUsageDescription: 'Carina uses the microphone for voice input.',
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#09161e',
    },
    package: 'uk.carinaai.mobile',
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON,
    permissions: ['RECORD_AUDIO'],
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-notifications',
      {
        color: '#1a5f7a',
        defaultChannel: 'carina-tasks',
      },
    ],
    [
      'expo-speech-recognition',
      {
        microphonePermission: 'Allow Carina to use the microphone for voice input.',
        speechRecognitionPermission: 'Allow Carina to transcribe your speech.',
      },
    ],
    [
      'react-native-android-widget',
      {
        widgets: [
          {
            name: 'CarinaTasks',
            label: 'Carina tasks',
            minWidth: '250dp',
            minHeight: '110dp',
            targetCellWidth: 4,
            targetCellHeight: 2,
            description: 'Running and completed Carina tasks',
            updatePeriodMillis: 1800000,
          },
        ],
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? '00000000-0000-4000-8000-000000000001',
    },
  },
  owner: process.env.EXPO_OWNER ?? 'verlox',
};

export default config;
