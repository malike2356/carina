import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ChatMessage } from '@/api/types';

export const MESSAGES_PREFIX = 'carina.chat.messages.';

function storageKey(sessionId: string): string {
  return `${MESSAGES_PREFIX}${sessionId}`;
}

export async function loadChatMessages(sessionId: string): Promise<ChatMessage[]> {
  const raw = await AsyncStorage.getItem(storageKey(sessionId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ChatMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveChatMessages(sessionId: string, messages: ChatMessage[]): Promise<void> {
  await AsyncStorage.setItem(storageKey(sessionId), JSON.stringify(messages));
}

export async function clearChatMessages(sessionId: string): Promise<void> {
  await AsyncStorage.removeItem(storageKey(sessionId));
}

export async function listStoredSessionIds(): Promise<string[]> {
  const keys = await AsyncStorage.getAllKeys();
  return keys
    .filter((key) => key.startsWith(MESSAGES_PREFIX))
    .map((key) => key.slice(MESSAGES_PREFIX.length))
    .filter(Boolean);
}
