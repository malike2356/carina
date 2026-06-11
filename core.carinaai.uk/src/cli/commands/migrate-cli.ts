import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import YAML from 'yaml';
import { CARINA_HOME } from '../../config/paths.js';
import { writeConfig } from '../config/loader.js';
import { DEFAULT_CLI_CONFIG } from '../config/defaults.js';

type MigrateSource = 'hermes' | 'openclaw';

const SOURCE_DIRS: Record<MigrateSource, string> = {
  hermes: path.join(os.homedir(), '.hermes'),
  openclaw: path.join(os.homedir(), '.openclaw'),
};

async function migrateOpenClawAgents(srcDir: string): Promise<void> {
  const configPath = path.join(srcDir, 'openclaw.json');
  if (!fsSync.existsSync(configPath)) return;

  const { ensureAgentsConfig, saveAgentsConfig, createAgentDefinition } = await import('../../workspaces/index.js');
  const { expandHome } = await import('../config/defaults.js');

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(await fs.readFile(configPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    return;
  }

  const agentsBlock = raw.agents as { list?: Array<Record<string, unknown>> } | undefined;
  const list = agentsBlock?.list ?? [];
  if (list.length === 0) return;

  const config = await ensureAgentsConfig(CARINA_HOME);
  config.agents = [];
  config.bindings = [];

  for (const entry of list) {
    const id = String(entry.id ?? 'main');
    await createAgentDefinition({
      id,
      name: String(entry.name ?? id),
      default: Boolean(entry.default),
      workspace: expandHome(String(entry.workspace ?? path.join(CARINA_HOME, 'workspaces', id))),
      agentDir: entry.agentDir ? expandHome(String(entry.agentDir)) : undefined,
      provider: entry.model ? String(entry.model).split('/')[0] : undefined,
      model: entry.model ? String(entry.model).split('/').slice(1).join('/') : undefined,
    }, CARINA_HOME);
    const ws = expandHome(String(entry.workspace ?? path.join(CARINA_HOME, 'workspaces', id)));
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
  await saveAgentsConfig(config, CARINA_HOME);
  console.log(`  Imported ${list.length} OpenClaw agent workspace(s)`);
}

async function copyIfExists(src: string, dest: string): Promise<boolean> {
  if (!fsSync.existsSync(src)) return false;
  const stat = await fs.stat(src);
  if (stat.isDirectory()) {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });
    for (const e of entries) {
      await copyIfExists(path.join(src, e.name), path.join(dest, e.name));
    }
  } else {
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);
  }
  return true;
}

export async function runMigrateCommand(args: string[]): Promise<void> {
  const source = (args[0] ?? 'status') as string;

  if (source === 'status') {
    for (const [name, dir] of Object.entries(SOURCE_DIRS)) {
      const exists = fsSync.existsSync(dir);
      console.log(`  ${name.padEnd(10)} ${exists ? 'found' : 'not found'}  ${dir}`);
    }
    return;
  }

  if (source !== 'hermes' && source !== 'openclaw') {
    console.error('Usage: carina migrate <status|hermes|openclaw>');
    process.exit(1);
  }

  const srcDir = SOURCE_DIRS[source];
  if (!fsSync.existsSync(srcDir)) {
    console.error(`Source not found: ${srcDir}`);
    process.exit(1);
  }

  await fs.mkdir(CARINA_HOME, { recursive: true });

  const srcConfig = path.join(srcDir, 'config.yaml');
  if (fsSync.existsSync(srcConfig)) {
    const parsed = YAML.parse(await fs.readFile(srcConfig, 'utf-8')) as Record<string, unknown>;
    const modelSection = parsed.model;
    const provider = typeof modelSection === 'object' && modelSection && 'provider' in modelSection
      ? String((modelSection as Record<string, unknown>).provider)
      : DEFAULT_CLI_CONFIG.provider;
    const model = typeof modelSection === 'object' && modelSection && 'default' in modelSection
      ? String((modelSection as Record<string, unknown>).default)
      : (typeof parsed.model === 'string' ? parsed.model : DEFAULT_CLI_CONFIG.model);

    await writeConfig({
      ...DEFAULT_CLI_CONFIG,
      provider: provider as typeof DEFAULT_CLI_CONFIG.provider,
      model,
      dataDir: CARINA_HOME,
    });
  }

  const srcEnv = path.join(srcDir, '.env');
  if (fsSync.existsSync(srcEnv)) {
    await fs.copyFile(srcEnv, path.join(CARINA_HOME, '.env'));
  }

  for (const sub of ['skills', 'memories', 'cron', 'sessions']) {
    await copyIfExists(path.join(srcDir, sub), path.join(CARINA_HOME, sub));
  }

  if (source === 'openclaw') {
    await migrateOpenClawAgents(srcDir);
  }

  console.log(`Migrated from ${source} -> ${CARINA_HOME}`);
  console.log('Run: carina doctor && carina config check');
}
