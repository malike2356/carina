export const PLACEHOLDER_EAS_PROJECT_ID = '00000000-0000-4000-8000-000000000001';

export interface NativeFeatureStatus {
  available: boolean;
  reason: string | null;
}

export interface NativeCapabilityContext {
  appOwnership: string | null;
  isDevice: boolean;
  easProjectId: string | null | undefined;
  platform: 'ios' | 'android' | 'web' | string;
  speechRecognitionAvailable?: boolean;
}

export interface NativeCapabilityStatus {
  voice: NativeFeatureStatus;
  remotePush: NativeFeatureStatus;
  widget: NativeFeatureStatus;
  expoGo: boolean;
}

function voiceReason(ctx: NativeCapabilityContext): NativeFeatureStatus {
  if (ctx.appOwnership === 'expo') {
    return {
      available: false,
      reason:
        'Voice input needs an EAS development or store build. Expo Go does not include native speech recognition.',
    };
  }
  if (ctx.speechRecognitionAvailable === false) {
    return {
      available: false,
      reason: 'Speech recognition is not available on this device.',
    };
  }
  return { available: true, reason: null };
}

function remotePushReason(ctx: NativeCapabilityContext): NativeFeatureStatus {
  if (ctx.appOwnership === 'expo') {
    return {
      available: false,
      reason:
        'Remote push needs an EAS build with a real project ID. Expo Go cannot receive production push tokens.',
    };
  }
  if (!ctx.isDevice) {
    return {
      available: false,
      reason: 'Remote push requires a physical device.',
    };
  }
  if (!ctx.easProjectId || ctx.easProjectId === PLACEHOLDER_EAS_PROJECT_ID) {
    return {
      available: false,
      reason: 'Set EXPO_PUBLIC_EAS_PROJECT_ID from eas init before enabling remote push.',
    };
  }
  return { available: true, reason: null };
}

function widgetReason(ctx: NativeCapabilityContext): NativeFeatureStatus {
  if (ctx.platform !== 'android') {
    return {
      available: false,
      reason: 'The task widget is Android-only today.',
    };
  }
  if (ctx.appOwnership === 'expo') {
    return {
      available: false,
      reason: 'The home-screen widget needs an EAS build. Expo Go cannot register widgets.',
    };
  }
  return { available: true, reason: null };
}

export function evaluateNativeCapabilities(ctx: NativeCapabilityContext): NativeCapabilityStatus {
  const expoGo = ctx.appOwnership === 'expo';
  return {
    expoGo,
    voice: voiceReason(ctx),
    remotePush: remotePushReason(ctx),
    widget: widgetReason(ctx),
  };
}
