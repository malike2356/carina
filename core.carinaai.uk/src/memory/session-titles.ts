import { callAuxiliaryModel } from '../brain/auxiliary-client.js';

export async function generateSessionTitle(firstMessage: string): Promise<string> {
  const trimmed = firstMessage.trim();
  if (!trimmed) return 'New session';
  try {
    const raw = await callAuxiliaryModel(
      'titleGeneration',
      `Generate a 5-8 word title for a conversation starting with: "${trimmed.slice(0, 200)}"
Output only the title, no quotes, no punctuation at end.`,
    );
    const title = raw.trim().replace(/^["']|["']$/g, '').replace(/[.!?]+$/, '').slice(0, 60);
    return title || fallbackSessionTitle(trimmed);
  } catch {
    return fallbackSessionTitle(trimmed);
  }
}

export function fallbackSessionTitle(firstMessage: string): string {
  return firstMessage.length > 40 ? `${firstMessage.slice(0, 37)}...` : firstMessage;
}
