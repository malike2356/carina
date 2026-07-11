import type { ExpoConfig } from 'expo/config';

// Keep these fallbacks in sync with src/config/defaults.ts, which reads the
// same EXPO_PUBLIC_* vars at runtime (inlined into the bundle by Expo).
const CARINA_CLOUD_URL =
  process.env.EXPO_PUBLIC_CARINA_CLOUD_URL ?? 'https://app.carinaai.uk';
const SCOUT_TRUST_URL =
  process.env.EXPO_PUBLIC_SCOUT_TRUST_URL ??
  'https://console.labyrinthscout.com/api/public/trust';

const config: ExpoConfig = {
  name: 'Carina',
  slug: 'carina-mobile',
  version: '0.1.0',
  scheme: 'carina',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  // llama.rn currently unlinked on Android (see react-native.config.js).
  newArchEnabled: false,
  splash: {
    backgroundColor: '#09161e',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'uk.carinaai.mobile',
    entitlements: {
      'com.apple.security.application-groups': ['group.uk.carinaai.mobile'],
    },
    infoPlist: {
      UIBackgroundModes: ['remote-notification', 'fetch'],
      BGTaskSchedulerPermittedIdentifiers: ['com.carina.connection.refresh'],
      NSMicrophoneUsageDescription:
        'Carina listens for the wake phrase "Hey Carina" to enable hands-free assistance.',
      NSSpeechRecognitionUsageDescription:
        'Carina converts your voice to text for hands-free queries.',
      NSCameraUsageDescription:
        'Carina uses the camera to provide visual context to the AI agent.',
      NSMotionUsageDescription:
        'Carina uses motion data to understand your current activity context.',
    },
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#09161e',
    },
    package: 'uk.carinaai.mobile',
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : {}),
    permissions: [
      'RECORD_AUDIO',
      'CAMERA',
      'ACTIVITY_RECOGNITION',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_REMOTE_MESSAGING',
      'RECEIVE_BOOT_COMPLETED',
      'ACCESS_NETWORK_STATE',
      'RECEIVE_SMS',
      'READ_SMS',
      'READ_CALL_LOG',
    ],
  },
  plugins: [
    'expo-router',
    './plugins/withVoiceWake.js',
    './plugins/withCarinaConnection.js',
    './plugins/withSmsRelay.js',
    './plugins/withOptionalFirebase.js',
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
      'expo-camera',
      {
        cameraPermission: 'Carina uses the camera to scan pairing QR codes and provide visual context.',
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
    carinaCloudUrl: CARINA_CLOUD_URL,
    scoutTrustUrl: SCOUT_TRUST_URL,
    eas: {
      projectId:
        process.env.EXPO_PUBLIC_EAS_PROJECT_ID || '77e32ebf-7e0e-497b-8e58-35e4dc64b365',
    },
  },
  owner: process.env.EXPO_OWNER ?? 'lordseseme',
};

export default config;
