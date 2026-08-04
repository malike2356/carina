import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('react-native', () => ({
  NativeModules: {
    CarinaVisionModule: {
      startCapture: vi.fn(async () => undefined),
      stopCapture: vi.fn(async () => undefined),
      pauseCapture: vi.fn(async () => undefined),
      resumeCapture: vi.fn(async () => undefined),
      addListener: vi.fn(),
      removeListeners: vi.fn(),
    },
  },
  NativeEventEmitter: vi.fn().mockImplementation(() => ({
    addListener: vi.fn(() => ({ remove: vi.fn() })),
  })),
}));

describe('camera-vision', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('reports native availability on device builds', async () => {
    const { isVisionCaptureAvailable } = await import('@/lib/camera-vision');
    expect(isVisionCaptureAvailable()).toBe(true);
  });

  it('starts capture at the requested fps', async () => {
    const { CameraVision } = await import('@/lib/camera-vision');
    const { NativeModules } = await import('react-native');
    await CameraVision.startCapture(2);
    expect(NativeModules.CarinaVisionModule.startCapture).toHaveBeenCalledWith(2);
  });
});
