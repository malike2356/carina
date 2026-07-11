import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_CLOUD_URL } from '@/config/defaults';
import { generateSessionId, isUuid } from '@/lib/id';
import type { InstanceConfig, InstanceMode } from '@/api/types';

const STORAGE_KEY = 'carina.instance';

const defaultConfig: InstanceConfig = {
  mode: 'cloud',
  baseUrl: DEFAULT_CLOUD_URL,
  sessionId: '',
};

export async function loadInstanceConfig(): Promise<InstanceConfig> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...defaultConfig };
  try {
    const parsed = JSON.parse(raw) as Partial<InstanceConfig>;
    return {
      mode: parsed.mode ?? defaultConfig.mode,
      baseUrl: parsed.baseUrl ?? defaultConfig.baseUrl,
      sessionId: parsed.sessionId ?? defaultConfig.sessionId,
    };
  } catch {
    return { ...defaultConfig };
  }
}

export async function saveInstanceConfig(config: InstanceConfig): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export async function setInstanceMode(mode: InstanceMode, baseUrl: string): Promise<InstanceConfig> {
  const next: InstanceConfig = {
    mode,
    baseUrl: baseUrl.replace(/\/+$/, ''),
    sessionId: '',
  };
  await saveInstanceConfig(next);
  return next;
}

export async function setSessionId(sessionId: string): Promise<InstanceConfig> {
  const current = await loadInstanceConfig();
  const next = { ...current, sessionId };
  await saveInstanceConfig(next);
  return next;
}

export async function ensureSessionId(): Promise<InstanceConfig> {
  const current = await loadInstanceConfig();
  if (current.sessionId) {
    // Legacy mobile-* ids are invalid for cloud UUID chat_sessions; rotate once.
    if (current.mode === 'cloud' && !isUuid(current.sessionId)) {
      return setSessionId(generateSessionId());
    }
    return current;
  }
  return setSessionId(generateSessionId());
}

export async function rotateSessionId(): Promise<InstanceConfig> {
  return setSessionId(generateSessionId());
}
