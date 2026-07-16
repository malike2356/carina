import path from 'path';
import type { CarinaSkill } from './types.js';

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'imported-skill';
}

export function nameFromFileName(fileName: string): string {
  const base = path.basename(fileName);
  const withoutExt = base.replace(/\.(cursorrules|windsurfrules|clinerules|mdc|md|yaml|yml|json|ts|js)$/i, '');
  return slugify(withoutExt);
}

export function extractFirstHeading(content: string): string | null {
  const match = content.match(/^#{1,3}\s+(.+)$/m);
  return match?.[1]?.trim() ?? null;
}

export function extractFirstParagraph(content: string): string {
  const lines = content.split('\n');
  const paragraphs: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (!line.trim()) {
      if (current.length > 0) {
        paragraphs.push(current.join(' ').trim());
        current = [];
      }
      continue;
    }
    if (line.startsWith('#')) continue;
    current.push(line.trim());
  }
  if (current.length > 0) paragraphs.push(current.join(' ').trim());
  return paragraphs.find((p) => p.length > 20) ?? paragraphs[0] ?? '';
}

export function extractTags(content: string): string[] {
  const tags = new Set<string>();
  for (const match of content.matchAll(/\*\*([^*]{2,40})\*\*/g)) {
    tags.add(slugify(match[1]));
  }
  for (const match of content.matchAll(/\b(typescript|javascript|python|rust|go|java|docker|kubernetes|postgres|redis|security|nmap|api)\b/gi)) {
    tags.add(match[1].toLowerCase());
  }
  return [...tags].slice(0, 8);
}

export function extractTriggers(content: string): string[] {
  const triggers = new Set<string>();
  for (const match of content.matchAll(/(?:when asked to|always|never|when the user wants to)\s+([^\n.]{3,60})/gi)) {
    triggers.add(match[1].trim().toLowerCase());
  }
  return [...triggers].slice(0, 6);
}

export function extractToolRequirements(content: string): string[] {
  const tools = new Set<string>();
  for (const match of content.matchAll(/```(?:bash|sh|shell)?\n([\s\S]*?)```/g)) {
    for (const line of match[1].split('\n')) {
      const cmd = line.trim().split(/\s+/)[0]?.replace(/^sudo\s+/, '');
      if (cmd && /^[a-z][a-z0-9_-]*$/i.test(cmd)) tools.add(cmd.toLowerCase());
    }
  }
  for (const match of content.matchAll(/\b(npm|pnpm|yarn|docker|git|curl|wget|python|node|npx)\b/gi)) {
    tools.add(match[1].toLowerCase());
  }
  return [...tools].slice(0, 12);
}

export function parseSimpleFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  const meta: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    meta[key] = value;
  }
  return { meta, body: match[2].trim() };
}

export function defaultPermissions(): CarinaSkill['permissions'] {
  return {
    network: false,
    filesystem: [],
    shell: false,
    mcpTools: [],
  };
}

export function buildImportedSkill(input: {
  name: string;
  description: string;
  category: string;
  hub: string;
  originalFormat: string;
  sourceUrl: string;
  converterVersion: string;
  content: string;
  tags?: string[];
  triggers?: string[];
  toolsRequired?: string[];
}): CarinaSkill {
  const name = slugify(input.name);
  return {
    name,
    version: '1.0.0',
    description: input.description || `Imported skill: ${name}`,
    category: input.category,
    tags: [...(input.tags ?? []), 'imported', input.hub].filter(Boolean),
    platforms: ['linux', 'macos', 'windows'],
    source: {
      hub: input.hub,
      url: input.sourceUrl,
      originalFormat: input.originalFormat,
      convertedAt: new Date().toISOString(),
      converterVersion: input.converterVersion,
    },
    tools: {
      required: input.toolsRequired ?? [],
      optional: [],
    },
    triggers: input.triggers?.length ? input.triggers : [name],
    dependencies: [],
    permissions: defaultPermissions(),
    content: input.content,
  };
}
