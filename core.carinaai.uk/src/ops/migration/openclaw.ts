import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import YAML from 'yaml';
import { CARINA_HOME } from '../../config/paths.js';
import { writeConfig } from '../../cli/config/loader.js';
import { DEFAULT_CLI_CONFIG } from '../../cli/config/defaults.js';
import type { MigrationItem, MigrationOptions, MigrationReport } from './types.js';
import { copyIfExists, copyIfExistsSafe, mergeEnvFile } from './copy-utils.js';

function item(pathRel: string, status: MigrationItem['status'], detail?: string): MigrationItem {
  return { path: pathRel, status, detail };
}

async function migrateOpenClawAgents(srcDir: string, destDir: string): Promise<MigrationItem[]> {
  const items: MigrationItem[] = [];
  const configPath = path.join(srcDir, 'openclaw.json');
  if (!fsSync.existsSync(configPath)) {
    items.push(item('agents.json', 'skipped', 'openclaw.json not found'));
    return items;
  }

  const { ensureAgentsConfig, saveAgentsConfig, createAgentDefinition } = await import('../../workspaces/index.js');
  const { expandHome } = await import('../../cli/config/defaults.js');

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(await fs.readFile(configPath, 'utf-8')) as Record<string, unknown>;
  } catch (err) {
    items.push(item('agents.json', 'failed', err instanceof Error ? err.message : String(err)));
    return items;
  }

  const agentsBlock = raw.agents as { list?: Array<Record<string, unknown>> } | undefined;
  const list = agentsBlock?.list ?? [];
  if (list.length === 0) {
    items.push(item('agents.json', 'skipped', 'no agents in openclaw.json'));
    return items;
  }

  const config = await ensureAgentsConfig(destDir);
  config.agents = [];
  config.bindings = [];

  for (const entry of list) {
    const id = String(entry.id ?? 'main');
    await createAgentDefinition({
      id,
      name: String(entry.name ?? id),
      default: Boolean(entry.default),
      workspace: expandHome(String(entry.workspace ?? path.join(destDir, 'workspaces', id))),
      agentDir: entry.agentDir ? expandHome(String(entry.agentDir)) : undefined,
      provider: entry.model ? String(entry.model).split('/')[0] : undefined,
      model: entry.model ? String(entry.model).split('/').slice(1).join('/') : undefined,
    }, destDir);
    const ws = expandHome(String(entry.workspace ?? path.join(destDir, 'workspaces', id)));
    await copyIfExists(ws, ws);
  }

  const bindings = (raw.bindings ?? []) as Array<Record<string, unknown>>;
  for (const binding of bindings) {
    const match = binding.match as Record<string, unknown> | undefined;
    if (!match) continue;
    config.bindings.push({
      agentId: String(binding.agentId ?? 'main'),
      match: {
        channel: match.channel as never,
        accountId: match.accountId ? String(match.accountId) : undefined,
        peer: match.peer as never,
        guildId: match.guildId ? String(match.guildId) : undefined,
        teamId: match.teamId ? String(match.teamId) : undefined,
      },
    });
  }
  await saveAgentsConfig(config, destDir);
  items.push(item('agents.json', 'imported', `${list.length} agent workspace(s)`));
  return items;
}

export async function migrateOpenClaw(
  srcDir: string,
  destDir = CARINA_HOME,
  options: MigrationOptions = {},
): Promise<MigrationReport> {
  const startedAt = new Date().toISOString();
  const items: MigrationItem[] = [];
  const warnings: string[] = [];
  const manualFollowUp: string[] = [];
  const dryRun = Boolean(options.dryRun);
  const overwrite = Boolean(options.force);

  if (!dryRun) await fs.mkdir(destDir, { recursive: true });

  const srcConfig = path.join(srcDir, 'config.yaml');
  if (fsSync.existsSync(srcConfig)) {
    try {
      const parsed = YAML.parse(await fs.readFile(srcConfig, 'utf-8')) as Record<string, unknown>;
      const modelSection = parsed.model;
      const provider = typeof modelSection === 'object' && modelSection && 'provider' in modelSection
        ? String((modelSection as Record<string, unknown>).provider)
        : DEFAULT_CLI_CONFIG.provider;
      const model = typeof modelSection === 'object' && modelSection && 'default' in modelSection
        ? String((modelSection as Record<string, unknown>).default)
        : (typeof parsed.model === 'string' ? parsed.model : DEFAULT_CLI_CONFIG.model);
      if (!dryRun) {
        await writeConfig({
          ...DEFAULT_CLI_CONFIG,
          provider: provider as typeof DEFAULT_CLI_CONFIG.provider,
          model,
          dataDir: destDir,
        });
      }
      items.push(item('config.yaml', 'imported'));
    } catch (err) {
      items.push(item('config.yaml', 'failed', err instanceof Error ? err.message : String(err)));
    }
  }

  const envStatus = await mergeEnvFile(path.join(srcDir, '.env'), path.join(destDir, '.env'), dryRun);
  items.push(item('.env', envStatus));

  for (const sub of ['skills', 'memories', 'cron', 'sessions']) {
    const dest = sub === 'memories' ? 'data/memories' : sub;
    if (dryRun) {
      items.push(item(dest, fsSync.existsSync(path.join(srcDir, sub)) ? 'imported' : 'skipped'));
      continue;
    }
    const status = await copyIfExistsSafe(path.join(srcDir, sub), path.join(destDir, dest), overwrite);
    items.push(item(dest, status === 'skipped' ? 'skipped' : (sub === 'skills' ? 'partial' : 'imported')));
  }

  if (!dryRun) {
    items.push(...await migrateOpenClawAgents(srcDir, destDir));
    const { importWorkspaceFiles } = await import('../../sync/agent-sync.js');
    const ws = await importWorkspaceFiles(srcDir, { overwrite });
    if (ws.imported.length > 0) {
      items.push(item('workspace-md', 'imported', ws.imported.join(', ')));
    }
    if (ws.updated.length > 0) {
      items.push(item('workspace-md', 'partial', `updated: ${ws.updated.join(', ')}`));
    }
    for (const agentDir of ['agents', 'workspaces']) {
      const srcAgents = path.join(srcDir, agentDir);
      if (!fsSync.existsSync(srcAgents)) continue;
      const entries = await fs.readdir(srcAgents, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const agentWs = path.join(srcAgents, entry.name);
        const nested = await importWorkspaceFiles(agentWs, { overwrite });
        if (nested.imported.length > 0 || nested.updated.length > 0) {
          items.push(item(
            `${agentDir}/${entry.name}/workspace-md`,
            nested.updated.length > 0 ? 'partial' : 'imported',
            [...nested.imported, ...nested.updated].join(', '),
          ));
        }
      }
    }
  }

  if (items.some((i) => i.path.includes('skills') && i.status !== 'skipped')) {
    warnings.push('OpenClaw skills copied as-is; validate against Carina pack format.');
  }

  return {
    version: 1,
    source: 'openclaw',
    sourceDir: srcDir,
    destDir,
    startedAt,
    finishedAt: new Date().toISOString(),
    items,
    warnings,
    manualFollowUp,
    dryRun,
  };
}
