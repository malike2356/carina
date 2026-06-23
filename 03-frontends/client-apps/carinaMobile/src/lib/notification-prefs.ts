import AsyncStorage from '@react-native-async-storage/async-storage';

const ENABLED_KEY = 'carina.notifications.enabled';
const SCOUT_KEY = 'carina.notifications.scout';
const REMOTE_KEY = 'carina.notifications.remote';

export async function loadNotificationsEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(ENABLED_KEY);
  if (raw === null) return true;
  return raw === 'true';
}

export async function saveNotificationsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(ENABLED_KEY, enabled ? 'true' : 'false');
}

export async function loadScoutAlertsEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(SCOUT_KEY);
  if (raw === null) return true;
  return raw === 'true';
}

export async function saveScoutAlertsEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(SCOUT_KEY, enabled ? 'true' : 'false');
}

export async function loadRemotePushEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(REMOTE_KEY);
  if (raw === null) return true;
  return raw === 'true';
}

export async function saveRemotePushEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(REMOTE_KEY, enabled ? 'true' : 'false');
}
