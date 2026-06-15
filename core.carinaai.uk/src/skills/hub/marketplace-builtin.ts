import { PACK_MANIFESTS } from '../pack-manifests.js';
import { TOOLSET_MAP, TOOLSET_NAMES } from '../../tools/toolset.js';
import { getChannelStatusReports } from '../../gateway/channels/channel-status.js';
import type { MarketplaceEntry } from './marketplace-types.js';
import type { MarketplaceEntryInput } from './marketplace-validate.js';
import { marketplaceEntryId } from './marketplace-types.js';
import { normalizeMarketplaceEntry } from './marketplace-validate.js';
import { listBuiltinExtensionIds, resolveBuiltinExtensionPath } from '../../extensions/builtin-catalog.js';
import fs from 'fs';
import path from 'path';

const FEATURED_PACKS = new Set(['property-uk', 'core-engineering', 'operator-daily', 'capabilities-ops']);
const VERIFIED_PACKS = new Set(['property-uk', 'healthcare']);

const MCP_TEMPLATES: Array<{
  slug: string;
  name: string;
  description: string;
  command: string;
  args: string[];
  risk: 'low' | 'medium' | 'high';
}> = [
  {
    slug: 'filesystem',
    name: 'MCP Filesystem',
    description: 'Read and write files via @modelcontextprotocol/server-filesystem',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '~'],
    risk: 'medium',
  },
  {
    slug: 'github',
    name: 'MCP GitHub',
    description: 'GitHub issues and PRs via @modelcontextprotocol/server-github',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    risk: 'medium',
  },
  {
    slug: 'brave-search',
    name: 'MCP Brave Search',
    description: 'Web search via @modelcontextprotocol/server-brave-search',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    risk: 'low',
  },
  {
    slug: 'postgres',
    name: 'MCP Postgres',
    description: 'Read-only SQL via @modelcontextprotocol/server-postgres',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://localhost/postgres'],
    risk: 'high',
  },
  {
    slug: 'memory',
    name: 'MCP Memory',
    description: 'Persistent knowledge graph via @modelcontextprotocol/server-memory',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    risk: 'low',
  },
  {
    slug: 'puppeteer',
    name: 'MCP Puppeteer',
    description: 'Browser automation via @modelcontextprotocol/server-puppeteer',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    risk: 'high',
  },
];

const WORKFLOW_TEMPLATES = [
  {
    slug: 'morning-briefing',
    name: 'Morning briefing',
    description: 'Daily cron workflow: tasks, weather, and calendar summary',
    category: 'productivity',
  },
  {
    slug: 'inbox-triage',
    name: 'Inbox triage',
    description: 'Hourly email triage with notes-manage follow-ups',
    category: 'email',
  },
  {
    slug: 'backup-nightly',
    name: 'Nightly backup',
    description: 'Scheduled carina backup create and verify',
    category: 'ops',
  },
  {
    slug: 'kanban-heartbeat',
    name: 'Kanban heartbeat',
    description: 'Recurring kanban-heartbeat for operator queue',
    category: 'devops',
  },
  {
    slug: 'rss-digest',
    name: 'RSS digest',
    description: 'Fetch RSS feeds and post summary to a channel',
    category: 'research',
  },
  {
    slug: 'memory-consolidation',
    name: 'Memory consolidation',
    description: 'Weekly memory maintenance using operator-daily skill',
    category: 'operator',
  },
];

const THEME_TEMPLATES = [
  {
    slug: 'tui-operator',
    name: 'TUI operator dark',
    description: 'High-contrast operator terminal theme',
    category: 'tui',
  },
  {
    slug: 'tui-minimal',
    name: 'TUI minimal',
    description: 'Reduced chrome for small terminals',
    category: 'tui',
  },
  {
    slug: 'web-light',
    name: 'Web light',
    description: 'Default light web chat theme',
    category: 'web',
  },
  {
    slug: 'web-contrast',
    name: 'Web high contrast',
    description: 'Accessibility-focused web theme',
    category: 'web',
  },
];

function packEntry(name: string): MarketplaceEntryInput {
  const manifest = PACK_MANIFESTS[name]!;
  const featured = FEATURED_PACKS.has(name);
  const verified = VERIFIED_PACKS.has(name) || manifest.optional === false;
  return {
    kind: 'pack',
    slug: name,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    author: manifest.author,
    category: manifest.category,
    tags: [manifest.category ?? 'pack'],
    trust: {
      publisher: verified ? 'verified' : 'carina',
      featured,
      verified,
      validation: 'builtin',
      risk: 'low',
      evalRequired: true,
    },
    install: {
      source: manifest.npmPackage ? 'npm' : 'builtin',
      ref: name,
      npmPackage: manifest.npmPackage,
    },
    stats: { skillCount: manifest.skillCount },
    status: 'available',
  };
}

export function buildBuiltinMarketplaceEntries(): MarketplaceEntry[] {
  const entries: MarketplaceEntryInput[] = [];

  for (const name of Object.keys(PACK_MANIFESTS)) {
    entries.push(packEntry(name));
  }

  for (const setName of TOOLSET_NAMES) {
    const tools = TOOLSET_MAP[setName] ?? [];
    entries.push({
      kind: 'toolset',
      slug: setName,
      name: `${setName} toolset`,
      version: '1.0.0',
      description: `Carina ${setName} tools (${tools.length} tools)`,
      author: 'VERLOX Ltd',
      category: 'tools',
      trust: {
        publisher: 'carina',
        featured: setName === 'workspace' || setName === 'utilities' || setName === 'ops',
        verified: true,
        validation: 'builtin',
        risk: setName === 'terminal' || setName === 'browser' ? 'high' : 'low',
      },
      install: { source: 'builtin', ref: setName },
      stats: { toolCount: tools.length },
      status: 'available',
    });
  }

  for (const report of getChannelStatusReports()) {
    entries.push({
      kind: 'channel',
      slug: report.channel,
      name: `${report.channel} channel`,
      version: '1.0.0',
      description: report.reason?.split(';')[0] ?? `${report.channel} messaging adapter`,
      author: 'VERLOX Ltd',
      category: 'channels',
      trust: {
        publisher: 'carina',
        featured: ['telegram', 'discord', 'slack', 'whatsapp', 'web'].includes(report.channel),
        verified: !report.transport?.includes('stub'),
        validation: report.transport?.includes('stub') ? 'pending' : 'builtin',
        risk: report.channel === 'api' || report.channel === 'webhooks' ? 'medium' : 'low',
      },
      install: {
        source: 'builtin',
        ref: report.channel,
        envKeys: report.env.filter((k) => !k.startsWith('(')),
        webhook: report.webhook,
      },
      status: 'available',
    });
  }

  for (const tpl of MCP_TEMPLATES) {
    entries.push({
      kind: 'mcp',
      slug: tpl.slug,
      name: tpl.name,
      version: '1.0.0',
      description: tpl.description,
      author: 'Model Context Protocol',
      category: 'mcp',
      trust: {
        publisher: 'verified',
        featured: tpl.slug === 'filesystem' || tpl.slug === 'github',
        verified: true,
        validation: 'passed',
        risk: tpl.risk,
      },
      install: {
        source: 'builtin',
        ref: tpl.slug,
        envKeys: tpl.slug === 'github' ? ['GITHUB_PERSONAL_ACCESS_TOKEN'] : tpl.slug === 'brave-search' ? ['BRAVE_API_KEY'] : undefined,
      },
      status: 'available',
    });
  }

  for (const tpl of WORKFLOW_TEMPLATES) {
    entries.push({
      kind: 'workflow',
      slug: tpl.slug,
      name: tpl.name,
      version: '1.0.0',
      description: tpl.description,
      author: 'VERLOX Ltd',
      category: tpl.category,
      trust: {
        publisher: 'carina',
        featured: tpl.slug === 'morning-briefing',
        verified: true,
        validation: 'builtin',
        risk: 'low',
      },
      install: { source: 'builtin', ref: tpl.slug },
      status: 'available',
    });
  }

  for (const tpl of THEME_TEMPLATES) {
    entries.push({
      kind: 'theme',
      slug: tpl.slug,
      name: tpl.name,
      version: '1.0.0',
      description: tpl.description,
      author: 'VERLOX Ltd',
      category: tpl.category,
      trust: {
        publisher: 'carina',
        featured: tpl.slug === 'tui-operator',
        verified: true,
        validation: 'builtin',
        risk: 'low',
      },
      install: { source: 'builtin', ref: tpl.slug },
      status: 'available',
    });
  }

  for (const id of listBuiltinExtensionIds()) {
    const bundlePath = resolveBuiltinExtensionPath(id);
    if (!bundlePath) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(bundlePath, 'extension.json'), 'utf8')) as {
        name: string;
        version: string;
        description: string;
        risk?: 'low' | 'medium' | 'high';
      };
      entries.push({
        kind: 'extension',
        slug: id,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        author: 'VERLOX Ltd',
        category: 'utilities',
        tags: ['utility', 'plugin', 'extension'],
        trust: {
          publisher: 'carina',
          featured: ['active-memory', 'web-readability', 'skill-workshop', 'llm-task'].includes(id),
          verified: true,
          validation: 'builtin',
          risk: manifest.risk ?? 'low',
          evalRequired: false,
        },
        install: { source: 'builtin', ref: bundlePath },
        status: 'available',
      });
    } catch {
      // skip malformed builtin bundle
    }
  }

  return entries.map((entry) => normalizeMarketplaceEntry({
    ...entry,
    id: marketplaceEntryId(entry.kind, entry.slug),
  }));
}
