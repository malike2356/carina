import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueuedMessage } from '@/api/types';

const STORAGE_KEY = 'carina.offline.queue';

export async function loadOfflineQueue(): Promise<QueuedMessage[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as QueuedMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveOfflineQueue(items: QueuedMessage[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export async function enqueueOfflineMessage(text: string): Promise<QueuedMessage[]> {
  const items = await loadOfflineQueue();
  const entry: QueuedMessage = {
    id: `queued-${Date.now()}`,
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };
  const next = [...items, entry];
  await saveOfflineQueue(next);
  return next;
}

export async function dequeueOfflineMessage(id: string): Promise<QueuedMessage[]> {
  const items = await loadOfflineQueue();
  const next = items.filter((item) => item.id !== id);
  await saveOfflineQueue(next);
  return next;
}

export function isLikelyNetworkError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('network request failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('network error') ||
    lower.includes('timeout') ||
    lower.includes('aborted')
  );
}
