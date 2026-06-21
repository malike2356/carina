import { NativeModules, NativeEventEmitter, type EmitterSubscription } from 'react-native';

const NativeModule = NativeModules.CarinaMotionModule as
  | {
      startRecognition: () => Promise<void>;
      stopRecognition: () => Promise<void>;
      addListener: (eventName: string) => void;
      removeListeners: (count: number) => void;
    }
  | undefined;

const emitter = NativeModule ? new NativeEventEmitter(NativeModule) : null;

export type ActivityType =
  | 'WALKING'
  | 'RUNNING'
  | 'STILL'
  | 'IN_VEHICLE'
  | 'ON_BICYCLE'
  | 'UNKNOWN';

export type TransitionType = 'ENTER' | 'EXIT';

export interface ActivityEvent {
  activity: ActivityType;
  transition: TransitionType;
  timestamp: number;
  confidence?: number;
}

export function isMotionActivityAvailable(): boolean {
  return Boolean(NativeModule);
}

export const MotionActivity = {
  async startRecognition(): Promise<void> {
    if (!NativeModule) {
      console.warn('[MotionActivity] Native module not available (Expo Go or simulator)');
      return;
    }
    await NativeModule.startRecognition();
  },

  async stopRecognition(): Promise<void> {
    if (!NativeModule) return;
    await NativeModule.stopRecognition();
  },

  onActivityChanged(handler: (event: ActivityEvent) => void): EmitterSubscription | null {
    return emitter?.addListener('activity_changed', handler) ?? null;
  },
};
