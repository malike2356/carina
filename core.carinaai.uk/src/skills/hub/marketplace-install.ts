import fs from 'fs/promises';
import path from 'path';
import { config } from '../../config/index.js';
import { CARINA_ENV_PATH } from '../../config/paths.js';
import { setEnvVarInFile } from '../../ops/env-file.js';
import { togglePlatformToolset, loadToolsetsConfig, saveToolsetsConfig } from '../../tools/toolset-config.js';
import {
  ensureMarketplaceLayout,
  marketplaceAssetsDir,
  removeMarketplaceInstallRecord,
  upsertMarketplaceInstallRecord,
} from './marketplace-store.js';
import { getMarketplaceEntry } from './marketplace-catalog.js';
import { parseMarketplaceEntryId } from './marketplace-types.js';
import { buildBuiltinMarketplaceEntries } from './marketplace-builtin.js';

export type MarketplaceActionResult = {
  id: string;
  action: 'install' | 'enable' | 'disable' | 'update' | 'remove';
  status: string;
  message: string;
};

const MCP_TEMPLATES: Record<string, { command: string; args: string[] }> = {
  filesystem: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem', '~'] },
  github: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] },
  'brave-search': { command: 'npx', args: ['-y', '@modelcontextprotocol/server-brave-search'] },
  postgres: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://localhost/postgres'] },
  memory: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-memory'] },
  puppeteer: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-puppeteer'] },
};

function parseActivePacks(): string[] {
  return [...config.carina.activePacks];
}

async function setActivePacks(packs: string[]): Promise<void> {
  const value = packs.join(',');
  setEnvVarInFile('ACTIVE_SKILL_PACKS', value, CARINA_ENV_PATH);
}

async function installPackEntry(slug: string, options: { baseUrl?: string; bypassEval?: boolean } = {}): Promise<string> {
  const { installPackSlug } = await import('../../cli/commands/pack/install.js');
  const result = await installPackSlug(slug, {
    baseUrl: options.baseUrl,
    bypassEval: options.bypassEval,
  });
  return result.version;
}

async function writeWorkflowTemplate(slug: string): Promise<void> {
  await ensureMarketplaceLayout();
  const file = path.join(marketplaceAssetsDir(), 'workflows', `${slug}.json`);
  const payload = {
    id: slug,
    name: slug,
    version: '1.0.0',
    trigger: { type: 'cron', expression: slug === 'morning-briefing' ? '0 7 * * *' : '0 * * * *' },
    steps: [{ action: 'agent_turn', prompt: `Run ${slug} workflow template` }],
    createdBy: 'carina-hub',
  };
  await fs.writeFile(file, JSON.stringify(payload, null, 2), { mode: 0o600 });
}

async function writeThemeTemplate(slug: string): Promise<void> {
  await ensureMarketplaceLayout();
  const file = path.join(marketplaceAssetsDir(), 'themes', `${slug}.json`);
  const dark = slug.includes('dark') || slug.includes('operator');
  const payload = {
    id: slug,
    palette: dark
      ? { bg: '#0f1419', fg: '#e7ecf3', accent: '#3d8bfd' }
      : { bg: '#ffffff', fg: '#1a1a1a', accent: '#2563eb' },
    fontFamily: 'monospace',
  };
  await fs.writeFile(file, JSON.stringify(payload, null, 2), { mode: 0o600 });
}

async function writeMcpTemplate(slug: string): Promise<void> {
  await ensureMarketplaceLayout();
  const tpl = MCP_TEMPLATES[slug];
  if (!tpl) throw new Error(`Unknown MCP template: ${slug}`);
  const file = path.join(marketplaceAssetsDir(), 'mcp', 'servers.json');
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(await fs.readFile(file, 'utf-8')) as Record<string, unknown>;
  } catch {
    existing = { servers: {} };
  }
  const servers = (existing.servers as Record<string, unknown>) ?? {};
  servers[slug] = {
    transport: 'stdio',
    command: tpl.command,
    args: tpl.args,
  };
  await fs.writeFile(file, JSON.stringify({ ...existing, servers }, null, 2), { mode: 0o600 });
}

async function writeChannelSetup(slug: string, envKeys?: string[]): Promise<void> {
  await ensureMarketplaceLayout();
  const file = path.join(marketplaceAssetsDir(), 'channels', `${slug}.md`);
  const lines = [
    `# ${slug} channel setup`,
    '',
    'Configure the following environment variables in ~/.carina/.env:',
    '',
    ...(envKeys ?? ['See carina channels setup ' + slug]).map((k) => `- ${k}`),
    '',
    'Then run: carina channels status',
  ];
  await fs.writeFile(file, lines.join('\n'), { mode: 0o600 });
}

export async function marketplaceInstall(
  id: string,
  options: { baseUrl?: string; bypassEval?: boolean; allowDangerous?: boolean } = {},
): Promise<MarketplaceActionResult> {
  const entry = await getMarketplaceEntry(id);
  if (!entry) throw new Error(`Marketplace entry not found: ${id}`);
  const { kind, slug } = parseMarketplaceEntryId(id);

  let version = entry.version;

  if (kind === 'pack') {
    version = await installPackEntry(slug, options);
  } else if (kind === 'extension') {
    const { resolveBuiltinExtensionPath } = await import('../../extensions/builtin-catalog.js');
    let source = entry.install.ref ?? slug;
    if (entry.install.source === 'builtin') {
      const builtin = resolveBuiltinExtensionPath(slug);
      if (!builtin) {
        throw new Error(`Builtin extension not found: ${slug}`);
      }
      source = builtin;
    }
    const { installExtension } = await import('../../extensions/manager.js');
    const result = await installExtension(source, { allowDangerous: options.allowDangerous });
    version = result.version;
  } else if (kind === 'workflow') {
    await writeWorkflowTemplate(slug);
  } else if (kind === 'theme') {
    await writeThemeTemplate(slug);
  } else if (kind === 'mcp') {
    await writeMcpTemplate(slug);
  } else if (kind === 'channel') {
    await writeChannelSetup(slug, entry.install.envKeys);
  } else if (kind === 'toolset') {
    const cfg = loadToolsetsConfig();
    const next = togglePlatformToolset('default', slug, true, cfg);
    await saveToolsetsConfig(next);
  }

  await upsertMarketplaceInstallRecord(id, {
    status: kind === 'pack' ? 'enabled' : 'installed',
    version,
    enabledAt: kind === 'pack' ? new Date().toISOString() : undefined,
    source: entry.install.source,
    metadata: { kind, slug },
  });

  return {
    id,
    action: 'install',
    status: 'installed',
    message: `Installed ${entry.name}@${version}`,
  };
}

export async function marketplaceEnable(id: string): Promise<MarketplaceActionResult> {
  const entry = await getMarketplaceEntry(id);
  if (!entry) throw new Error(`Marketplace entry not found: ${id}`);
  const { kind, slug } = parseMarketplaceEntryId(id);
  const now = new Date().toISOString();

  if (kind === 'pack') {
    const packs = parseActivePacks();
    if (!packs.includes(slug)) {
      packs.push(slug);
      await setActivePacks(packs);
    }
  } else if (kind === 'extension') {
    const { enableExtension } = await import('../../extensions/manager.js');
    await enableExtension(slug);
  } else if (kind === 'toolset') {
    const cfg = loadToolsetsConfig();
    const next = togglePlatformToolset('default', slug, true, cfg);
    await saveToolsetsConfig(next);
  } else if (kind === 'workflow' || kind === 'theme' || kind === 'mcp' || kind === 'channel') {
    const record = await upsertMarketplaceInstallRecord(id, {
      status: 'enabled',
      version: entry.installedVersion ?? entry.version,
      enabledAt: now,
      source: entry.install.source,
    });
    if (!record.installedAt) {
      await marketplaceInstall(id);
      await upsertMarketplaceInstallRecord(id, { status: 'enabled', version: entry.version, enabledAt: now });
    }
  } else {
    throw new Error(`Cannot enable kind: ${kind}`);
  }

  await upsertMarketplaceInstallRecord(id, {
    status: 'enabled',
    version: entry.installedVersion ?? entry.version,
    enabledAt: now,
    source: entry.install.source,
  });

  return { id, action: 'enable', status: 'enabled', message: `Enabled ${entry.name}` };
}

export async function marketplaceDisable(id: string): Promise<MarketplaceActionResult> {
  const entry = await getMarketplaceEntry(id);
  if (!entry) throw new Error(`Marketplace entry not found: ${id}`);
  const { kind, slug } = parseMarketplaceEntryId(id);
  const now = new Date().toISOString();

  if (kind === 'pack') {
    const packs = parseActivePacks().filter((p) => p !== slug);
    await setActivePacks(packs);
  } else if (kind === 'extension') {
    const { disableExtension } = await import('../../extensions/manager.js');
    await disableExtension(slug);
  } else if (kind === 'toolset') {
    const cfg = loadToolsetsConfig();
    const next = togglePlatformToolset('default', slug, false, cfg);
    await saveToolsetsConfig(next);
  }

  await upsertMarketplaceInstallRecord(id, {
    status: 'disabled',
    version: entry.installedVersion ?? entry.version,
    disabledAt: now,
    source: entry.install.source,
  });

  return { id, action: 'disable', status: 'disabled', message: `Disabled ${entry.name}` };
}

export async function marketplaceUpdate(
  id: string,
  options: { baseUrl?: string; bypassEval?: boolean } = {},
): Promise<MarketplaceActionResult> {
  const entry = await getMarketplaceEntry(id);
  if (!entry) throw new Error(`Marketplace entry not found: ${id}`);
  const wasEnabled = entry.status === 'enabled';
  await marketplaceRemove(id, { keepAssets: true });
  const result = await marketplaceInstall(id, options);
  if (wasEnabled) await marketplaceEnable(id);
  return { ...result, action: 'update', message: `Updated ${entry.name}` };
}

export async function marketplaceRemove(
  id: string,
  options: { keepAssets?: boolean } = {},
): Promise<MarketplaceActionResult> {
  const entry = await getMarketplaceEntry(id);
  if (!entry) throw new Error(`Marketplace entry not found: ${id}`);
  const { kind, slug } = parseMarketplaceEntryId(id);

  if (kind === 'pack') {
    const packs = parseActivePacks().filter((p) => p !== slug);
    await setActivePacks(packs);
  } else if (kind === 'extension') {
    const { removeExtension } = await import('../../extensions/manager.js');
    await removeExtension(slug);
  }

  if (!options.keepAssets) {
    const base = marketplaceAssetsDir();
    const targets = [
      path.join(base, 'workflows', `${slug}.json`),
      path.join(base, 'themes', `${slug}.json`),
      path.join(base, 'channels', `${slug}.md`),
    ];
    for (const target of targets) {
      await fs.rm(target, { force: true });
    }
  }

  await removeMarketplaceInstallRecord(id);

  return { id, action: 'remove', status: 'available', message: `Removed ${entry.name}` };
}

export function listBuiltinMcpSlugs(): string[] {
  return buildBuiltinMarketplaceEntries()
    .filter((entry) => entry.kind === 'mcp')
    .map((entry) => entry.slug);
}
