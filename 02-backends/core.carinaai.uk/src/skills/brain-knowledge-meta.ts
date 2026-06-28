export interface KnowledgeSkillMeta {
  sourceFile: string;
  skillName: string;
  title: string;
  description: string;
  tags: string[];
}

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
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

function slugFromFilename(filename: string): string {
  const base = filename.replace(/\.md$/i, '');
  const withoutNumber = base.replace(/^\d+-/, '');
  return withoutNumber
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function titleFromBody(body: string, filename: string): string {
  const h1 = body.match(/^#\s+(.+)$/m);
  if (h1?.[1]) return h1[1].trim();
  return filename.replace(/\.md$/i, '').replace(/^\d+-/, '').replace(/-/g, ' ');
}

function tagsFromContent(meta: Record<string, string>, body: string, filename: string): string[] {
  const tags = new Set<string>();
  if (meta.tags) {
    for (const tag of meta.tags.split(',')) {
      const t = tag.trim().toLowerCase();
      if (t) tags.add(t);
    }
  }

  const feature = body.match(/\*\*Feature flags?:\*\*\s*([^\n]+)/i);
  if (feature?.[1]) {
    const flags = feature[1].match(/`([^`]+)`/g) ?? [];
    for (const raw of flags) {
      const t = raw.replace(/`/g, '').trim().toLowerCase();
      if (t) tags.add(t);
    }
  }

  const prefix = filename.match(/^(\d+)-/);
  if (prefix?.[1]) tags.add(`kb-${prefix[1]}`);

  if (/carina/i.test(body) || /carina/i.test(filename)) tags.add('carina');
  if (/compliance|hmo|tenancy/i.test(filename)) tags.add('compliance');
  if (/deal|calculator|yield/i.test(filename)) tags.add('deals');

  return [...tags];
}

export function parseKnowledgeMarkdownMeta(content: string, filename: string): KnowledgeSkillMeta {
  const { meta, body } = parseFrontmatter(content);
  const title = meta.title ?? titleFromBody(body, filename);
  const skillName = meta.name ?? slugFromFilename(filename);
  const description = meta.description
    ?? body.split('\n').find((line) => line.trim() && !line.startsWith('#'))?.trim()
    ?? `Knowledge: ${title}`;

  return {
    sourceFile: filename,
    skillName,
    title,
    description: description.slice(0, 240),
    tags: tagsFromContent(meta, body, filename),
  };
}
