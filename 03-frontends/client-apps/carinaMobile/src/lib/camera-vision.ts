import { NativeModules, NativeEventEmitter, type EmitterSubscription } from 'react-native';

const NativeModule = NativeModules.CarinaVisionModule as
  | {
      startCapture: (fps: number) => Promise<void>;
      stopCapture: () => Promise<void>;
      pauseCapture: () => Promise<void>;
      resumeCapture: () => Promise<void>;
      addListener: (eventName: string) => void;
      removeListeners: (count: number) => void;
    }
  | undefined;

const emitter = NativeModule ? new NativeEventEmitter(NativeModule) : null;

export interface VisionFrame {
  jpeg: string;
  timestamp: number;
}

export function isVisionCaptureAvailable(): boolean {
  return Boolean(NativeModule);
}

export const CameraVision = {
  async startCapture(fps = 2): Promise<void> {
    if (!NativeModule) {
      console.warn('[CameraVision] Native module not available (Expo Go or simulator)');
      return;
    }
    await NativeModule.startCapture(fps);
  },

  async stopCapture(): Promise<void> {
    if (!NativeModule) return;
    await NativeModule.stopCapture();
  },

  async pauseCapture(): Promise<void> {
    if (!NativeModule) return;
    await NativeModule.pauseCapture();
  },

  async resumeCapture(): Promise<void> {
    if (!NativeModule) return;
    await NativeModule.resumeCapture();
  },

  onFrame(handler: (frame: VisionFrame) => void): EmitterSubscription | null {
    return emitter?.addListener('vision_frame', handler) ?? null;
  },
};
