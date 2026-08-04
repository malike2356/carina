import type { ChannelName } from './channel-adapter.interface.js';
import { CHANNEL_CAPABILITIES } from './channel-capabilities.js';
import {
  markdownTablesToBullets,
  stripBasicMarkdown,
  wrapDiscordLinks,
} from '../markdown-for-channels.js';
import { markdownToTelegramReadable } from '../telegram-format.js';

export function formatForChannel(channel: ChannelName, text: string): string[] {
  const capabilities = CHANNEL_CAPABILITIES[channel];
  const normalized = capabilities.plainTextOnly
    ? stripBasicMarkdown(markdownTablesToBullets(text))
    : normalizeMarkdown(channel, text);
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
  if (channel === 'telegram') {
    return markdownToTelegramReadable(text);
  }
  const withoutTables = markdownTablesToBullets(text);
  if (channel === 'discord') {
    return wrapDiscordLinks(withoutTables);
  }
  if (channel === 'slack') {
    return withoutTables;
  }
  return text;
}
