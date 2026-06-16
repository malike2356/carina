import type { CarinaMessage } from '../types/index.js';
import {
  markdownTablesToBullets,
  stripBasicMarkdown,
} from './markdown-for-channels.js';

const LIMITS: Record<RealPlatform, number> = {
  cli: 100_000,
  web: 100_000,
  telegram: 4096,
  whatsapp: 1600,
};

type RealPlatform = Extract<CarinaMessage['source'], 'cli' | 'telegram' | 'whatsapp' | 'web'>;

export function formatForPlatform(text: string, platform: CarinaMessage['source']): string | string[] {
  if (!isRealPlatform(platform)) return text;

  const normalized = platform === 'whatsapp'
    ? formatForWhatsApp(text)
    : platform === 'telegram'
      ? formatForTelegram(text)
      : platform === 'cli'
        ? formatForCli(text)
        : text;
  const chunks = splitByLength(normalized || ' ', LIMITS[platform]);
  return chunks.length === 1 ? chunks[0] : chunks;
}

export function splitByLength(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let rest = text;
  while (rest.length > maxLength) {
    const boundary = Math.max(rest.lastIndexOf('\n', maxLength), rest.lastIndexOf(' ', maxLength));
    const cut = boundary > Math.floor(maxLength * 0.6) ? boundary : maxLength;
    chunks.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function formatForTelegram(text: string): string {
  return markdownTablesToBullets(text);
}

function formatForWhatsApp(text: string): string {
  return stripBasicMarkdown(markdownTablesToBullets(text));
}

function formatForCli(text: string): string {
  return markdownTablesToBullets(text);
}

function isRealPlatform(platform: CarinaMessage['source']): platform is RealPlatform {
  return platform === 'cli' || platform === 'telegram' || platform === 'whatsapp' || platform === 'web';
}
