import { describe, expect, it } from 'vitest';
import {
  PLACEHOLDER_EAS_PROJECT_ID,
  evaluateNativeCapabilities,
} from './native-capabilities';

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
  });

  it('allows remote push on device builds with a real EAS project id', () => {
    const caps = evaluateNativeCapabilities({
      appOwnership: 'standalone',
      isDevice: true,
      easProjectId: '11111111-1111-4111-8111-111111111111',
      platform: 'ios',
    });

    expect(caps.remotePush.available).toBe(true);
  });

  it('blocks remote push when the placeholder EAS project id is still configured', () => {
    const caps = evaluateNativeCapabilities({
      appOwnership: 'standalone',
      isDevice: true,
      easProjectId: PLACEHOLDER_EAS_PROJECT_ID,
      platform: 'android',
    });

    expect(caps.remotePush.available).toBe(false);
    expect(caps.remotePush.reason).toMatch(/EXPO_PUBLIC_EAS_PROJECT_ID/i);
  });

  it('allows Android widget on standalone Android builds', () => {
    const caps = evaluateNativeCapabilities({
      appOwnership: 'standalone',
      isDevice: true,
      easProjectId: '11111111-1111-4111-8111-111111111111',
      platform: 'android',
    });

    expect(caps.widget.available).toBe(true);
  });
});
