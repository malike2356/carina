import type { ChatMessage } from '@/components/chat/types';

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}

function messageLabel(role: ChatMessage['role']): string {
  return role === 'user' ? 'User' : 'Carina';
}

function renderToolCalls(message: ChatMessage): string {
  if (!message.toolCalls || message.toolCalls.length === 0) return '';
  const lines = message.toolCalls
    .map((toolCall) => {
      const input = typeof toolCall.input === 'string' ? toolCall.input : JSON.stringify(toolCall.input, null, 2);
      const output = typeof toolCall.output === 'string' ? toolCall.output : JSON.stringify(toolCall.output, null, 2);
      return [`### ${toolCall.name}`, '```json', input, '```', 'Result:', '```json', output, '```'].join('\n');
    })
    .join('\n\n');
  return `\n\n${lines}`;
}

export function buildSessionMarkdown(title: string, messages: ChatMessage[]): string {
  const lines = [`# ${title.trim() || 'Carina session'}`];

  for (const message of messages) {
    const stamp = formatTimestamp(message.createdAt);
    const role = messageLabel(message.role);
    const heading = stamp ? `## ${role} - ${stamp}` : `## ${role}`;
    lines.push(heading);
    lines.push(message.content || (message.errorMessage ?? ''));
    lines.push(renderToolCalls(message));
  }

  return `${lines.join('\n\n')}\n`;
}

export async function copySessionMarkdown(title: string, messages: ChatMessage[]): Promise<void> {
  const markdown = buildSessionMarkdown(title, messages);
  await navigator.clipboard.writeText(markdown);
}

export async function downloadSessionMarkdown(title: string, messages: ChatMessage[]): Promise<void> {
  const markdown = buildSessionMarkdown(title, messages);
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.trim().replace(/\s+/g, '-').toLowerCase() || 'carina-session'}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
