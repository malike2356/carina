import type { CarinaMessage } from '../types/index.js';

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

function formatForWhatsApp(text: string): string {
  return markdownTablesToBullets(text)
    .replace(/^#{1,6}\s+(.+)$/gm, (_, title: string) => title.toUpperCase())
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
}

function formatForCli(text: string): string {
  return markdownTablesToBullets(text);
}

function markdownTablesToBullets(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1] ?? '';
    if (isTableRow(line) && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(next)) {
      const headers = cells(line);
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) {
        const values = cells(lines[i]);
        out.push(`- ${headers.map((header, idx) => `${header}: ${values[idx] ?? ''}`).join('; ')}`);
        i++;
      }
      i--;
      continue;
    }
    out.push(line);
  }
  return out.join('\n');
}

function isTableRow(line: string): boolean {
  return line.trim().startsWith('|') && line.includes('|');
}

function cells(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((part) => part.trim());
}

function isRealPlatform(platform: CarinaMessage['source']): platform is RealPlatform {
  return platform === 'cli' || platform === 'telegram' || platform === 'whatsapp' || platform === 'web';
}
