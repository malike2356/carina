import type { CarinaSkill } from './types.js';

function yamlQuote(value: string): string {
  if (/[:#{}[\],&*?|>!%@`"'\\]/.test(value) || value.includes('\n')) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return value;
}

function yamlArray(key: string, values: string[], indent = ''): string {
  if (values.length === 0) return `${indent}${key}: []`;
  return `${indent}${key}:\n${values.map((v) => `${indent}  - ${yamlQuote(v)}`).join('\n')}`;
}

export function serializeCarinaSkill(skill: CarinaSkill): string {
  return [
    '---',
    `name: ${yamlQuote(skill.name)}`,
    `version: ${yamlQuote(skill.version)}`,
    `description: ${yamlQuote(skill.description)}`,
    `category: ${yamlQuote(skill.category)}`,
    yamlArray('tags', skill.tags),
    yamlArray('platforms', skill.platforms),
    'source:',
    `  hub: ${yamlQuote(skill.source.hub)}`,
    `  url: ${yamlQuote(skill.source.url)}`,
    `  originalFormat: ${yamlQuote(skill.source.originalFormat)}`,
    `  convertedAt: ${yamlQuote(skill.source.convertedAt)}`,
    `  converterVersion: ${yamlQuote(skill.source.converterVersion)}`,
    'tools:',
    yamlArray('required', skill.tools.required, '  '),
    yamlArray('optional', skill.tools.optional, '  '),
    yamlArray('triggers', skill.triggers),
    'dependencies: []',
    'permissions:',
    `  network: ${skill.permissions.network}`,
    yamlArray('filesystem', skill.permissions.filesystem, '  '),
    `  shell: ${skill.permissions.shell}`,
    yamlArray('mcpTools', skill.permissions.mcpTools, '  '),
    '---',
    '',
    skill.content.trim(),
    '',
  ].join('\n');
}

export function parseCarinaSkillMarkdown(raw: string, sourcePath = ''): CarinaSkill | null {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return null;

  const metaBlock = match[1];
  const body = match[2].trim();
  const scalar: Record<string, string> = {};
  const arrays: Record<string, string[]> = {};
  const nested: Record<string, Record<string, string>> = { source: {}, permissions: {}, tools: {} };
  let section = '';
  let arrayKey = '';

  for (const line of metaBlock.split('\n')) {
    if (!line.trim()) continue;
    if (line.startsWith('source:')) {
      section = 'source';
      continue;
    }
    if (line.startsWith('permissions:')) {
      section = 'permissions';
      continue;
    }
    if (line.startsWith('tools:')) {
      section = 'tools';
      continue;
    }
    const arrayItem = line.match(/^\s+-\s+(.+)$/);
    if (arrayItem && arrayKey) {
      const bucket = section ? nested[section] : arrays;
      if (section) {
        nested[section][arrayKey] = nested[section][arrayKey]
          ? `${nested[section][arrayKey]},${arrayItem[1].replace(/^["']|["']$/g, '')}`
          : arrayItem[1].replace(/^["']|["']$/g, '');
      } else {
        (arrays[arrayKey] ??= []).push(arrayItem[1].replace(/^["']|["']$/g, ''));
      }
      continue;
    }
    const kv = line.match(/^(\s*)([^:]+):\s*(.*)$/);
    if (!kv) continue;
    const indent = kv[1].length;
    const key = kv[2].trim();
    const value = kv[3].trim().replace(/^["']|["']$/g, '');
    if (value === '' && indent >= 2) {
      arrayKey = key;
      continue;
    }
    arrayKey = '';
    if (section && indent >= 2) {
      nested[section][key] = value;
    } else {
      section = '';
      scalar[key] = value;
    }
  }

  const splitCsv = (value?: string) =>
    value ? value.split(',').map((v) => v.trim()).filter(Boolean) : [];

  const name = scalar.name ?? 'imported-skill';
  return {
    name,
    version: scalar.version ?? '1.0.0',
    description: scalar.description ?? '',
    category: scalar.category ?? 'imported-unknown',
    tags: arrays.tags ?? [],
    platforms: arrays.platforms ?? ['linux', 'macos', 'windows'],
    source: {
      hub: nested.source.hub ?? scalar.hub ?? 'unknown',
      url: nested.source.url ?? sourcePath,
      originalFormat: nested.source.originalFormat ?? 'unknown',
      convertedAt: nested.source.convertedAt ?? new Date().toISOString(),
      converterVersion: nested.source.converterVersion ?? '1.0.0',
    },
    tools: {
      required: splitCsv(nested.tools.required),
      optional: splitCsv(nested.tools.optional),
    },
    triggers: arrays.triggers ?? [],
    dependencies: [],
    permissions: {
      network: nested.permissions.network === 'true',
      filesystem: splitCsv(nested.permissions.filesystem),
      shell: nested.permissions.shell === 'true',
      mcpTools: splitCsv(nested.permissions.mcpTools),
    },
    content: body,
  };
}
