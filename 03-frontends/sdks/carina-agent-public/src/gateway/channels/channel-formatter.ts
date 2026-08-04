import type { ChannelName } from './channel-adapter.interface.js';
import { CHANNEL_CAPABILITIES } from './channel-capabilities.js';

export function formatForChannel(channel: ChannelName, text: string): string[] {
  const capabilities = CHANNEL_CAPABILITIES[channel];
  const normalized = capabilities.plainTextOnly ? stripMarkdown(text) : normalizeMarkdown(channel, text);
  return splitByLength(normalized || ' ', capabilities.maxMessageLength);
}

export function splitByLength(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let rest = text;
  while (rest.length > maxLength) {
    const boundary = Math.max(
      rest.lastIndexOf('\n', maxLength),
      rest.lastIndexOf(' ', maxLength),
    );
    const cut = boundary > Math.floor(maxLength * 0.6) ? boundary : maxLength;
    chunks.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function normalizeMarkdown(channel: ChannelName, text: string): string {
  if (channel === 'discord') {
    return text.replace(/(?<!<)\bhttps?:\/\/[^\s<]+/g, (url) => `<${url}>`);
  }
  return text;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
}
