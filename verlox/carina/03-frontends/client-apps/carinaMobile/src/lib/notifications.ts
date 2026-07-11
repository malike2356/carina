import { AppState, Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import type { AgentTaskStatus, ScoutSecurityEvent } from '@/api/types';
import {
  loadNotificationsEnabled,
  loadScoutAlertsEnabled,
} from './notification-prefs';
import { buildScoutAlertContent, shouldAlertForSeverity } from './scout-alert';
import {
  buildTaskNotificationContent,
  shouldNotifyForAppState,
} from './task-notification';

const ANDROID_TASK_CHANNEL = 'carina-tasks';
const ANDROID_SCOUT_CHANNEL = 'carina-scout';

let handlerConfigured = false;

export function configureNotificationHandler(): void {
  if (handlerConfigured) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  handlerConfigured = true;
}

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_TASK_CHANNEL, {
    name: 'Carina tasks',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#1a5f7a',
  });
}

export async function ensureScoutAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_SCOUT_CHANNEL, {
    name: 'Scout security',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: '#c9a227',
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Device.isDevice) return false;

  configureNotificationHandler();
  await ensureAndroidChannel();
  await ensureScoutAndroidChannel();

  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted';
}

export async function notifyTaskFinished(
  prompt: string,
  status: Extract<AgentTaskStatus, 'completed' | 'failed'>,
): Promise<void> {
  const enabled = await loadNotificationsEnabled();
  if (!enabled) return;
  if (!shouldNotifyForAppState(AppState.currentState)) return;
  if (!Device.isDevice) return;

  const permitted = await requestNotificationPermission();
  if (!permitted) return;

  const content = buildTaskNotificationContent(prompt, status);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: content.title,
      body: content.body,
      data: { screen: 'tasks', status },
      sound: true,
    },
    trigger: null,
  });
}

export async function notifyScoutEvent(event: ScoutSecurityEvent): Promise<void> {
  const tasksEnabled = await loadNotificationsEnabled();
  const scoutEnabled = await loadScoutAlertsEnabled();
  if (!tasksEnabled && !scoutEnabled) return;
  if (!scoutEnabled) return;
  if (!shouldAlertForSeverity(event.severity)) return;
  if (!shouldNotifyForAppState(AppState.currentState)) return;
  if (!Device.isDevice) return;

  const permitted = await requestNotificationPermission();
  if (!permitted) return;

  const content = buildScoutAlertContent(event);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: content.title,
      body: content.body,
      data: { screen: 'trust', eventId: event.id },
      sound: true,
    },
    trigger: null,
  });
}
