import { describe, expect, it } from 'vitest';
import {
  PLACEHOLDER_EAS_PROJECT_ID,
  evaluateNativeCapabilities,
  hasValidEasProjectId,
  isExpoGo,
  isPushAvailable,
  isVoiceAvailable,
  isWidgetAvailable,
} from './native-capabilities';

const deviceAndroid: Parameters<typeof evaluateNativeCapabilities>[0] = {
  appOwnership: 'standalone',
  isDevice: true,
  easProjectId: '11111111-1111-4111-8111-111111111111',
  platform: 'android',
};

describe('native capability helpers', () => {
  it('detects Expo Go', () => {
    expect(isExpoGo({ ...deviceAndroid, appOwnership: 'expo' })).toBe(true);
    expect(isExpoGo(deviceAndroid)).toBe(false);
  });

  it('validates real EAS project ids', () => {
    expect(hasValidEasProjectId(PLACEHOLDER_EAS_PROJECT_ID)).toBe(false);
    expect(hasValidEasProjectId('11111111-1111-4111-8111-111111111111')).toBe(true);
    expect(hasValidEasProjectId(null)).toBe(false);
  });
});

describe('evaluateNativeCapabilities', () => {
  it('blocks voice and remote push in Expo Go', () => {
    const caps = evaluateNativeCapabilities({
      appOwnership: 'expo',
      isDevice: true,
      easProjectId: 'real-project-id',
      platform: 'android',
      speechRecognitionAvailable: true,
    });

    expect(caps.expoGo).toBe(true);
    expect(caps.voice.available).toBe(false);
    expect(caps.remotePush.available).toBe(false);
    expect(caps.widget.available).toBe(false);
    expect(isVoiceAvailable({ appOwnership: 'expo', isDevice: true, easProjectId: 'x', platform: 'android' })).toBe(false);
  });

  it('allows remote push on device builds with a real EAS project id', () => {
    const caps = evaluateNativeCapabilities({
      appOwnership: 'standalone',
      isDevice: true,
      easProjectId: '11111111-1111-4111-8111-111111111111',
      platform: 'ios',
    });

    expect(caps.remotePush.available).toBe(true);
    expect(isPushAvailable(deviceAndroid)).toBe(true);
  });

  it('blocks remote push on simulators', () => {
    const caps = evaluateNativeCapabilities({
      ...deviceAndroid,
      isDevice: false,
    });

    expect(caps.remotePush.available).toBe(false);
    expect(caps.remotePush.reason).toMatch(/physical device/i);
  });

  it('blocks remote push when the placeholder EAS project id is still configured', () => {
    const caps = evaluateNativeCapabilities({
      ...deviceAndroid,
      easProjectId: PLACEHOLDER_EAS_PROJECT_ID,
    });

    expect(caps.remotePush.available).toBe(false);
    expect(caps.remotePush.reason).toMatch(/EXPO_PUBLIC_EAS_PROJECT_ID/i);
  });

  it('allows Android widget on standalone Android builds', () => {
    const caps = evaluateNativeCapabilities(deviceAndroid);

    expect(caps.widget.available).toBe(true);
    expect(isWidgetAvailable(deviceAndroid)).toBe(true);
  });

  it('blocks widget on iOS', () => {
    const caps = evaluateNativeCapabilities({
      ...deviceAndroid,
      platform: 'ios',
    });

    expect(caps.widget.available).toBe(false);
  });
});
