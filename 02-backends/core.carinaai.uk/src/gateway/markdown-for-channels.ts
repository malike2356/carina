export function markdownTablesToBullets(text: string): string {
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

export function stripBasicMarkdown(text: string): string {
  return text
    .replace(/^#{1,6}\s+(.+)$/gm, (_, title: string) => title.toUpperCase())
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
}

export function wrapDiscordLinks(text: string): string {
  return text.replace(/(?<!<)\bhttps?:\/\/[^\s<]+/g, (url) => `<${url}>`);
}

function isTableRow(line: string): boolean {
  return line.trim().startsWith('|') && line.includes('|');
}

function cells(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((part) => part.trim());
}
