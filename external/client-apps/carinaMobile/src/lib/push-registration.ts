import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { registerPushToken, unregisterPushToken } from '@/api/push-client';
import {
  loadNotificationsEnabled,
  loadRemotePushEnabled,
  loadScoutAlertsEnabled,
} from './notification-prefs';
import { ensureAndroidChannel, ensureScoutAndroidChannel } from './notifications';

const TOKEN_STORAGE_KEY = 'carina.push.expoToken';

export function getEasProjectId(): string | null {
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId || projectId === '00000000-0000-4000-8000-000000000001') {
    return null;
  }
  return projectId;
}

export async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const projectId = getEasProjectId();
  if (!projectId) return null;

  await ensureAndroidChannel();
  await ensureScoutAndroidChannel();

  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') return null;

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

export async function syncPushRegistration(options: {
  baseUrl: string;
  taskAlerts: boolean;
  scoutAlerts: boolean;
  enabled: boolean;
}): Promise<string | null> {
  if (!options.enabled || options.baseUrl === '') return null;

  const token = await getExpoPushToken();
  if (!token) return null;

  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  await registerPushToken(options.baseUrl, {
    token,
    platform,
    taskAlerts: options.taskAlerts,
    scoutAlerts: options.scoutAlerts,
  });

  return token;
}

export async function clearPushRegistration(baseUrl: string, token: string): Promise<void> {
  if (!baseUrl || !token) return;
  await unregisterPushToken(baseUrl, token);
}

export async function resyncPushFromPrefs(baseUrl: string): Promise<string | null> {
  const [enabled, remote, scout] = await Promise.all([
    loadNotificationsEnabled(),
    loadRemotePushEnabled(),
    loadScoutAlertsEnabled(),
  ]);

  if (!enabled || !remote) {
    const token = await getExpoPushToken();
    if (token) {
      await clearPushRegistration(baseUrl, token);
    }
    return null;
  }

  return syncPushRegistration({
    baseUrl,
    taskAlerts: enabled,
    scoutAlerts: scout,
    enabled: true,
  });
}
