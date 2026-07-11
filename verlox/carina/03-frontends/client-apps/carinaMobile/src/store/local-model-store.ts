import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_LOCAL_MODEL_ID,
  getCatalogEntry,
  type LocalModelId,
} from '@/config/local-model';

const ENABLED_KEY = 'carina.local-model.enabled';
const AUTO_DOWNLOAD_KEY = 'carina.local-model.auto-download';
const WIFI_ONLY_KEY = 'carina.local-model.wifi-only';
const ACTIVE_ID_KEY = 'carina.local-model.active-id';

let cachedActiveId: LocalModelId | null = null;

export function getCachedActiveLocalModelId(): LocalModelId | null {
  return cachedActiveId;
}

export async function getActiveLocalModelId(): Promise<LocalModelId> {
  const raw = await AsyncStorage.getItem(ACTIVE_ID_KEY);
  if (raw && getCatalogEntry(raw)) {
    cachedActiveId = raw as LocalModelId;
    return cachedActiveId;
  }
  cachedActiveId = DEFAULT_LOCAL_MODEL_ID;
  return cachedActiveId;
}

export async function setActiveLocalModelId(id: LocalModelId): Promise<void> {
  if (!getCatalogEntry(id)) {
    throw new Error(`Unknown local model: ${id}`);
  }
  cachedActiveId = id;
  await AsyncStorage.setItem(ACTIVE_ID_KEY, id);
}

export async function isLocalModelEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(ENABLED_KEY);
  if (raw === null) return true;
  return raw === '1';
}

export async function setLocalModelEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(ENABLED_KEY, enabled ? '1' : '0');
}

export async function isAutoDownloadEnabled(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(AUTO_DOWNLOAD_KEY);
  if (raw === null) return false;
  return raw === '1';
}

export async function setAutoDownloadEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(AUTO_DOWNLOAD_KEY, enabled ? '1' : '0');
}

export async function isWifiOnlyDownload(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(WIFI_ONLY_KEY);
  if (raw === null) return true;
  return raw === '1';
}

export async function setWifiOnlyDownload(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(WIFI_ONLY_KEY, enabled ? '1' : '0');
}
