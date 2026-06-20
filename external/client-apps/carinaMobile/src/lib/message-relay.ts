import { NativeModules, Platform } from 'react-native';

type SmsRelayNative = {
  configure: (apiUrl: string, deviceToken: string | null, apiKey: string | null) => Promise<void>;
  setSmsRelayEnabled: (enabled: boolean) => Promise<void>;
  setCallRelayEnabled: (enabled: boolean) => Promise<void>;
  setAllowedSenders: (senders: string[]) => Promise<void>;
  setPrivacyHours: (startHour: number, endHour: number) => Promise<void>;
  getSettings: () => Promise<{ smsEnabled: boolean; callEnabled: boolean }>;
  checkMissedCalls: () => Promise<void>;
};

type NotificationRelayNative = {
  configure: (apiUrl: string, deviceToken: string | null, apiKey: string | null) => Promise<void>;
  setNotificationRelayEnabled: (enabled: boolean) => Promise<void>;
  setAllowedSources: (sources: string[]) => Promise<void>;
  setPrivacyHours: (startHour: number, endHour: number) => Promise<void>;
  getSettings: () => Promise<{
    notificationEnabled: boolean;
    allowedSources: string[];
    privacyStartHour: number;
    privacyEndHour: number;
  }>;
  forwardNotification: (title: string, body: string, source: string) => Promise<void>;
};

const SmsRelayModule = NativeModules.SmsRelayModule as SmsRelayNative | undefined;
const NotificationRelayModule = NativeModules.NotificationRelayModule as
  | NotificationRelayNative
  | undefined;

export function isSmsRelayAvailable(): boolean {
  return Platform.OS === 'android' && Boolean(SmsRelayModule);
}

export function isNotificationRelayAvailable(): boolean {
  return Platform.OS === 'ios' && Boolean(NotificationRelayModule);
}

export const MessageRelay = {
  async configure(apiUrl: string, deviceToken: string | null, apiKey: string | null): Promise<void> {
    if (SmsRelayModule) {
      await SmsRelayModule.configure(apiUrl, deviceToken, apiKey);
    }
    if (NotificationRelayModule) {
      await NotificationRelayModule.configure(apiUrl, deviceToken, apiKey);
    }
  },

  async setSmsEnabled(enabled: boolean): Promise<void> {
    await SmsRelayModule?.setSmsRelayEnabled(enabled);
  },

  async setCallEnabled(enabled: boolean): Promise<void> {
    await SmsRelayModule?.setCallRelayEnabled(enabled);
  },

  async setNotificationEnabled(enabled: boolean): Promise<void> {
    await NotificationRelayModule?.setNotificationRelayEnabled(enabled);
  },

  async setAllowedSenders(senders: string[]): Promise<void> {
    await SmsRelayModule?.setAllowedSenders(senders);
    await NotificationRelayModule?.setAllowedSources(senders);
  },

  async setPrivacyHours(startHour: number, endHour: number): Promise<void> {
    await SmsRelayModule?.setPrivacyHours(startHour, endHour);
    await NotificationRelayModule?.setPrivacyHours(startHour, endHour);
  },

  async syncNativeSettings(): Promise<void> {
    if (SmsRelayModule) {
      await SmsRelayModule.getSettings();
    }
    if (NotificationRelayModule) {
      await NotificationRelayModule.getSettings();
    }
  },

  async checkMissedCalls(): Promise<void> {
    await SmsRelayModule?.checkMissedCalls();
  },

  async forwardNotification(title: string, body: string, source: string): Promise<void> {
    await NotificationRelayModule?.forwardNotification(title, body, source);
  },
};
