import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('react-native', () => ({
  NativeModules: {
    CarinaMotionModule: {
      startRecognition: vi.fn(async () => undefined),
      stopRecognition: vi.fn(async () => undefined),
      addListener: vi.fn(),
      removeListeners: vi.fn(),
    },
  },
  NativeEventEmitter: vi.fn().mockImplementation(() => ({
    addListener: vi.fn(() => ({ remove: vi.fn() })),
  })),
}));

describe('motion-activity', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('reports native availability on device builds', async () => {
    const { isMotionActivityAvailable } = await import('@/lib/motion-activity');
    expect(isMotionActivityAvailable()).toBe(true);
  });

  it('starts activity recognition', async () => {
    const { MotionActivity } = await import('@/lib/motion-activity');
    const { NativeModules } = await import('react-native');
    await MotionActivity.startRecognition();
    expect(NativeModules.CarinaMotionModule.startRecognition).toHaveBeenCalled();
  });
});
