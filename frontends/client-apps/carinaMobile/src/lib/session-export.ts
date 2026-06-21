import type { ChatMessage, ChatSessionMeta } from '@/api/types';
import { displaySessionTitle } from './session-registry';

export function formatSessionAsMarkdown(
  meta: ChatSessionMeta,
  messages: ChatMessage[],
): string {
  const title = displaySessionTitle(meta);
  const lines: string[] = [
    `# Carina chat: ${title}`,
    '',
    `Exported: ${new Date().toISOString()}`,
    `Session: ${meta.id}`,
    `Messages: ${messages.length}`,
    '',
  ];

  for (const message of messages) {
    if (!message.content.trim() || message.status === 'streaming') continue;
    const speaker = message.role === 'user' ? 'You' : 'Carina';
    lines.push(`## ${speaker}`, '', message.content.trim(), '');
    if (message.toolsUsed?.length) {
      lines.push(`_Tools: ${message.toolsUsed.join(', ')}_`, '');
    }
  }

  return lines.join('\n').trim();
}

export function formatSessionAsPlainText(
  meta: ChatSessionMeta,
  messages: ChatMessage[],
): string {
  const title = displaySessionTitle(meta);
  const lines: string[] = [
    `Carina chat: ${title}`,
    `Exported: ${new Date().toLocaleString()}`,
    '',
  ];

  for (const message of messages) {
    if (!message.content.trim() || message.status === 'streaming') continue;
    const speaker = message.role === 'user' ? 'You' : 'Carina';
    lines.push(`${speaker}:`, message.content.trim(), '');
  }

  return lines.join('\n').trim();
}
