import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SessionPrefs } from '@/api/types';

const PREFS_KEY = 'carina.chat.sessions.prefs';

export async function loadAllSessionPrefs(): Promise<Record<string, SessionPrefs>> {
  const raw = await AsyncStorage.getItem(PREFS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, SessionPrefs>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function loadSessionPrefs(sessionId: string): Promise<SessionPrefs> {
  const all = await loadAllSessionPrefs();
  return all[sessionId] ?? {};
}

export async function saveSessionPrefs(
  sessionId: string,
  prefs: SessionPrefs,
): Promise<SessionPrefs> {
  const all = await loadAllSessionPrefs();
  all[sessionId] = prefs;
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(all));
  return prefs;
}

export async function removeSessionPrefs(sessionId: string): Promise<void> {
  const all = await loadAllSessionPrefs();
  delete all[sessionId];
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(all));
}
