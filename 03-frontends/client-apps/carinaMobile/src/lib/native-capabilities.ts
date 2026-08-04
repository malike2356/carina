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
  isDevClient: boolean;
  isStoreBuild: boolean;
}

export function isExpoGo(ctx: NativeCapabilityContext): boolean {
  return ctx.appOwnership === 'expo';
}

export function isDevClient(ctx: NativeCapabilityContext): boolean {
  return ctx.appOwnership === 'expo' ? false : ctx.appOwnership !== 'guest';
}

export function isStoreBuild(ctx: NativeCapabilityContext): boolean {
  return ctx.appOwnership === 'standalone' || ctx.appOwnership === 'storeClient';
}

export function hasValidEasProjectId(easProjectId: string | null | undefined): boolean {
  return Boolean(easProjectId && easProjectId !== PLACEHOLDER_EAS_PROJECT_ID);
}

function voiceReason(ctx: NativeCapabilityContext): NativeFeatureStatus {
  if (isExpoGo(ctx)) {
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
  if (isExpoGo(ctx)) {
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
  if (!hasValidEasProjectId(ctx.easProjectId)) {
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
  if (isExpoGo(ctx)) {
    return {
      available: false,
      reason:
        'The home-screen widget needs a preview or production EAS build. Add it manually from the Android launcher after install.',
    };
  }
  return { available: true, reason: null };
}

export function evaluateNativeCapabilities(ctx: NativeCapabilityContext): NativeCapabilityStatus {
  const expoGo = isExpoGo(ctx);
  return {
    expoGo,
    isDevClient: isDevClient(ctx),
    isStoreBuild: isStoreBuild(ctx),
    voice: voiceReason(ctx),
    remotePush: remotePushReason(ctx),
    widget: widgetReason(ctx),
  };
}

export function isVoiceAvailable(ctx: NativeCapabilityContext): boolean {
  return evaluateNativeCapabilities(ctx).voice.available;
}

export function isPushAvailable(ctx: NativeCapabilityContext): boolean {
  return evaluateNativeCapabilities(ctx).remotePush.available;
}

export function isWidgetAvailable(ctx: NativeCapabilityContext): boolean {
  return evaluateNativeCapabilities(ctx).widget.available;
}
