import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import YAML from 'yaml';
import { CARINA_HOME } from '../../config/paths.js';
import { writeConfig, type CarinaCliConfig } from '../../cli/config/loader.js';
import { DEFAULT_CLI_CONFIG, type ProviderName } from '../../cli/config/defaults.js';
import { copyIfExists, copyIfExistsSafe, listWouldOverwrite, mergeEnvFile } from './copy-utils.js';
import { discoverAgent, legacyAgentsManifestFilename, type AgentSignature } from './discovery.js';
import type { MigrationItem, MigrationOptions, MigrationReport, MigrationSource } from './types.js';

const REPORT_VERSION = 1;

function item(pathRel: string, status: MigrationItem['status'], detail?: string): MigrationItem {
  return { path: pathRel, status, detail };
}

function mapProviders(parsed: Record<string, unknown>): CarinaCliConfig['providers'] {
  const providers = { ...DEFAULT_CLI_CONFIG.providers };
  const raw = parsed.providers;
  if (!raw || typeof raw !== 'object') return providers;
  for (const name of Object.keys(providers) as ProviderName[]) {
    const incoming = (raw as Record<string, unknown>)[name];
    if (!incoming || typeof incoming !== 'object') continue;
    const block = incoming as Record<string, unknown>;
    providers[name] = {
      ...providers[name],
      ...(typeof block.api_key === 'string' ? { api_key: block.api_key } : {}),
      ...(typeof block.model === 'string' ? { model: block.model } : {}),
    };
  }
  return providers;
}

function finishReport(
  base: Omit<MigrationReport, 'version' | 'dryRun' | 'manualFollowUp'>,
  manualFollowUp: string[],
  dryRun: boolean,
): MigrationReport {
  return { ...base, version: REPORT_VERSION, manualFollowUp, dryRun };
}

async function importConfigYaml(
  srcDir: string,
  destDir: string,
  options: { dryRun: boolean; overwrite: boolean; mapProviderKeys: boolean },
): Promise<{ items: MigrationItem[]; manualFollowUp: string[] }> {
  const items: MigrationItem[] = [];
  const manualFollowUp: string[] = [];
  const destConfig = path.join(destDir, 'config.yaml');
  const srcConfig = path.join(srcDir, 'config.yaml');

  if (!fsSync.existsSync(srcConfig)) {
    items.push(item('config.yaml', 'skipped', 'not found in source'));
    return { items, manualFollowUp };
  }

  if (fsSync.existsSync(destConfig) && !options.overwrite) {
    items.push(item('config.yaml', 'skipped', 'dest exists; use --force to overwrite'));
    manualFollowUp.push('Merge source config.yaml manually or re-run with --force');
    return { items, manualFollowUp };
  }

  try {
    const parsed = YAML.parse(await fs.readFile(srcConfig, 'utf-8')) as Record<string, unknown>;
    const modelSection = parsed.model;
    const provider = typeof modelSection === 'object' && modelSection && 'provider' in modelSection
      ? String((modelSection as Record<string, unknown>).provider)
      : DEFAULT_CLI_CONFIG.provider;
    const model = typeof modelSection === 'object' && modelSection && 'default' in modelSection
      ? String((modelSection as Record<string, unknown>).default)
      : (typeof parsed.model === 'string' ? parsed.model : DEFAULT_CLI_CONFIG.model);
    if (!options.dryRun) {
      await writeConfig({
        ...DEFAULT_CLI_CONFIG,
        provider: provider as typeof DEFAULT_CLI_CONFIG.provider,
        model,
        dataDir: destDir,
        ...(options.mapProviderKeys ? { providers: mapProviders(parsed) } : {}),
      });
    }
    items.push(item('config.yaml', 'imported', options.mapProviderKeys ? 'provider, model, and providers mapped' : undefined));
  } catch (err) {
    items.push(item('config.yaml', 'failed', err instanceof Error ? err.message : String(err)));
  }

  return { items, manualFollowUp };
}

async function migrateLegacyAgentsManifest(srcDir: string, destDir: string, manifestName: string): Promise<MigrationItem[]> {
  const items: MigrationItem[] = [];
  const configPath = path.join(srcDir, manifestName);
  if (!fsSync.existsSync(configPath)) {
    items.push(item('agents.json', 'skipped', `${manifestName} not found`));
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
    items.push(item('agents.json', 'skipped', `no agents in ${manifestName}`));
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

async function migrateYamlMdSkills(
  srcDir: string,
  destDir: string,
  agent: AgentSignature,
  options: MigrationOptions,
): Promise<MigrationReport> {
  const startedAt = new Date().toISOString();
  const items: MigrationItem[] = [];
  const warnings: string[] = [];
  const manualFollowUp: string[] = [];
  const dryRun = Boolean(options.dryRun);
  const overwrite = Boolean(options.force);

  if (!dryRun) await fs.mkdir(destDir, { recursive: true });

  const configResult = await importConfigYaml(srcDir, destDir, {
    dryRun,
    overwrite,
    mapProviderKeys: agent.id === 'agent-type-1',
  });
  items.push(...configResult.items);
  manualFollowUp.push(...configResult.manualFollowUp);

  const envStatus = await mergeEnvFile(path.join(srcDir, '.env'), path.join(destDir, '.env'), dryRun);
  items.push(item('.env', envStatus, envStatus === 'partial' ? 'merged missing keys only' : undefined));
  if (envStatus === 'partial') {
    manualFollowUp.push('Review merged .env keys; existing Carina values were kept');
  }

  if (agent.id === 'agent-type-1') {
    const treeCopies: Array<{ src: string; dest: string; note?: string; partial?: boolean }> = [
      { src: 'skills', dest: 'packs', note: 'Source skills copied to packs/ (review pack.json)', partial: true },
      { src: 'memories', dest: 'data/memories', note: 'memory files; backend may need re-index' },
      { src: 'sessions', dest: 'sessions' },
      { src: 'profiles', dest: 'profiles', note: 'Source profiles copied; verify active-profile' },
      { src: 'cron', dest: 'data/cron' },
      { src: 'credentials.json', dest: 'credentials.json' },
      { src: 'hooks', dest: 'hooks' },
      { src: 'DREAMS.md', dest: 'DREAMS.md' },
    ];

    for (const { src, dest, note, partial } of treeCopies) {
      const srcPath = path.join(srcDir, src);
      const destPath = path.join(destDir, dest);
      if (!fsSync.existsSync(srcPath)) {
        items.push(item(dest, 'skipped'));
        continue;
      }
      const overwrites = await listWouldOverwrite(srcPath, destPath);
      if (overwrites.length > 0 && !overwrite) {
        items.push(item(dest, 'skipped', `${overwrites.length} path(s) exist; use --force`));
        manualFollowUp.push(`Source ${src} -> ${dest}: review ${overwrites.length} existing file(s) or use --force`);
        continue;
      }
      if (dryRun) {
        items.push(item(dest, partial ? 'partial' : 'imported', note ?? 'would copy'));
        continue;
      }
      const status = await copyIfExistsSafe(srcPath, destPath, overwrite);
      items.push(item(dest, partial ? 'partial' : status, note));
      if (src === 'skills') {
        warnings.push('Source skills imported as packs/; Carina pack manifests may need manual curation.');
        manualFollowUp.push('Review imported packs under packs/ and run carina packs list');
      }
      if (src === 'memories') {
        warnings.push('Memory import is file-level only; run: carina memory reindex');
        manualFollowUp.push('Run carina memory reindex if using vector memory');
      }
      if (src === 'profiles') {
        manualFollowUp.push('Run carina profile list and carina profile use <name> if needed');
      }
    }

    if (!fsSync.existsSync(path.join(srcDir, 'credentials.json'))) {
      warnings.push('No source credentials.json found; API keys may only be in .env.');
    }
  } else {
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
      const manifestName = agent.agentsManifest ?? legacyAgentsManifestFilename();
      items.push(...await migrateLegacyAgentsManifest(srcDir, destDir, manifestName));
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
      warnings.push('Source skills copied as-is; validate against Carina pack format.');
    }
  }

  return finishReport({
    source: agent.id as MigrationSource,
    sourceType: agent.id as MigrationSource,
    sourceFormat: agent.skillFormat,
    sourceDir: srcDir,
    destDir,
    startedAt,
    finishedAt: new Date().toISOString(),
    items,
    warnings,
  }, manualFollowUp, dryRun);
}

async function genericMigrate(
  srcDir: string,
  destDir: string,
  options: MigrationOptions,
): Promise<MigrationReport> {
  const startedAt = new Date().toISOString();
  const dryRun = Boolean(options.dryRun);
  const overwrite = Boolean(options.force);
  const items: MigrationItem[] = [];
  const warnings: string[] = ['Unknown agent layout; copied common paths only'];
  const manualFollowUp = ['Review imported files manually; source agent type was not recognized'];

  if (!dryRun) await fs.mkdir(destDir, { recursive: true });

  for (const sub of ['config.yaml', '.env', 'skills', 'sessions']) {
    const srcPath = path.join(srcDir, sub);
    if (!fsSync.existsSync(srcPath)) {
      items.push(item(sub, 'skipped'));
      continue;
    }
    if (dryRun) {
      items.push(item(sub, 'imported', 'would copy'));
      continue;
    }
    const destPath = path.join(destDir, sub === 'skills' ? 'packs' : sub);
    const status = await copyIfExistsSafe(srcPath, destPath, overwrite);
    items.push(item(destPath.replace(`${destDir}${path.sep}`, ''), status === 'skipped' ? 'skipped' : 'imported'));
  }

  return finishReport({
    source: 'unknown',
    sourceType: 'unknown',
    sourceFormat: 'unknown',
    sourceDir: srcDir,
    destDir,
    startedAt,
    finishedAt: new Date().toISOString(),
    items,
    warnings,
  }, manualFollowUp, dryRun);
}

export async function migrate(
  sourcePath: string,
  destPath: string,
  options: MigrationOptions = {},
): Promise<MigrationReport> {
  const agent = discoverAgent(sourcePath);

  if (!agent) {
    return genericMigrate(sourcePath, destPath, options);
  }

  switch (agent.skillFormat) {
    case 'yaml-md':
      return migrateYamlMdSkills(sourcePath, destPath, agent, options);
    case 'json-config':
    case 'markdown':
    case 'typescript':
    default:
      return genericMigrate(sourcePath, destPath, options);
  }
}

export async function migrateFromKnownHome(
  sourceType: 'agent-type-1' | 'agent-type-2',
  destPath = CARINA_HOME,
  options: MigrationOptions = {},
): Promise<MigrationReport> {
  const srcDir = options.sourceDir ?? path.join(
    (await import('os')).default.homedir(),
    sourceType === 'agent-type-1' ? '.hermes' : '.openclaw',
  );
  return migrate(srcDir, destPath, options);
}

export { REPORT_VERSION as MIGRATION_REPORT_VERSION };
