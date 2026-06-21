import { Share } from 'react-native';
import type { ChatMessage, ChatSessionMeta } from '@/api/types';
import { formatSessionAsMarkdown } from './session-export';

export async function shareSession(
  meta: ChatSessionMeta,
  messages: ChatMessage[],
): Promise<boolean> {
  const body = formatSessionAsMarkdown(meta, messages);
  if (!body) return false;

  const result = await Share.share({
    title: `Carina: ${meta.title}`,
    message: body,
  });

  return result.action === Share.sharedAction;
}
