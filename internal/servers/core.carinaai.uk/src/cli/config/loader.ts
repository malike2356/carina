import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import YAML from 'yaml';
import { CARINA_HOME } from '../../config/paths.js';
import { DEFAULT_CLI_CONFIG, expandHome, type CarinaCliConfig, type ProviderName } from './defaults.js';
import { envKeyForProvider } from './env.js';
import {
  isAuxiliaryTaskName,
  type AuxiliaryModelConfig,
  type AuxiliaryModelMap,
} from '../../types/auxiliary-model.js';
import type { FailoverConfig, ProviderProfile } from '../../providers/provider-profile.js';

export const CLI_CONFIG_PATH = path.join(CARINA_HOME, 'config.yaml');
export type { CarinaCliConfig } from './defaults.js';

type PlainRecord = Record<string, unknown>;

function isRecord(value: unknown): value is PlainRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normaliseProvider(value: unknown): ProviderName {
  if (value === 'anthropic' || value === 'openai' || value === 'deepseek') return value;
  return DEFAULT_CLI_CONFIG.provider;
}

function parseAuxiliaryModelConfig(value: unknown): AuxiliaryModelConfig | undefined {
  if (!isRecord(value)) return undefined;
  const cfg: AuxiliaryModelConfig = {};
  if (typeof value.provider === 'string' && value.provider.trim()) cfg.provider = value.provider.trim();
  if (typeof value.model === 'string' && value.model.trim()) cfg.model = value.model.trim();
  if (typeof value.maxTokens === 'number' && value.maxTokens > 0) cfg.maxTokens = value.maxTokens;
  if (value.reasoningEffort === 'low' || value.reasoningEffort === 'medium' || value.reasoningEffort === 'high') {
    cfg.reasoningEffort = value.reasoningEffort;
  }
  if (typeof value.temperature === 'number') cfg.temperature = value.temperature;
  return Object.keys(cfg).length > 0 ? cfg : undefined;
}

function parseProviderProfiles(value: unknown): ProviderProfile[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const profiles: ProviderProfile[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    if (typeof entry.name !== 'string' || !entry.name.trim()) continue;
    if (typeof entry.provider !== 'string' || !entry.provider.trim()) continue;
    if (typeof entry.model !== 'string' || !entry.model.trim()) continue;
    profiles.push({
      name: entry.name.trim(),
      provider: entry.provider.trim(),
      model: entry.model.trim(),
      ...(typeof entry.apiKey === 'string' ? { apiKey: entry.apiKey } : {}),
      ...(typeof entry.baseUrl === 'string' ? { baseUrl: entry.baseUrl } : {}),
      ...(typeof entry.priority === 'number' ? { priority: entry.priority } : {}),
      ...(typeof entry.enabled === 'boolean' ? { enabled: entry.enabled } : {}),
    });
  }
  return profiles.length > 0 ? profiles : undefined;
}

function parseFailoverConfig(value: unknown): FailoverConfig | undefined {
  if (!isRecord(value)) return undefined;
  const cfg: FailoverConfig = {};
  if (typeof value.maxRetries === 'number' && value.maxRetries >= 0) cfg.maxRetries = value.maxRetries;
  if (typeof value.cooldownMs === 'number' && value.cooldownMs >= 0) cfg.cooldownMs = value.cooldownMs;
  if (typeof value.failFast === 'boolean') cfg.failFast = value.failFast;
  return Object.keys(cfg).length > 0 ? cfg : undefined;
}

function parseAuxiliaryModels(value: unknown): AuxiliaryModelMap | undefined {
  if (!isRecord(value)) return undefined;
  const map: AuxiliaryModelMap = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!isAuxiliaryTaskName(key)) continue;
    const parsed = parseAuxiliaryModelConfig(entry);
    if (parsed) map[key] = parsed;
  }
  return Object.keys(map).length > 0 ? map : undefined;
}

function parseConfig(value: unknown): CarinaCliConfig {
  const raw = isRecord(value) ? value : {};
  const rawProviders = isRecord(raw.providers) ? raw.providers : {};
  const providers = { ...DEFAULT_CLI_CONFIG.providers };

  for (const provider of Object.keys(providers) as ProviderName[]) {
    const incoming = rawProviders[provider];
    if (!isRecord(incoming)) continue;
    providers[provider] = {
      ...providers[provider],
      ...(typeof incoming.api_key === 'string' ? { api_key: incoming.api_key } : {}),
      ...(typeof incoming.model === 'string' ? { model: incoming.model } : {}),
    };
  }

  return {
    provider: normaliseProvider(raw.provider),
    model: typeof raw.model === 'string' ? raw.model : DEFAULT_CLI_CONFIG.model,
    dataDir: typeof raw.dataDir === 'string' ? raw.dataDir : DEFAULT_CLI_CONFIG.dataDir,
    scout: {
      enabled: isRecord(raw.scout) && typeof raw.scout.enabled === 'boolean'
        ? raw.scout.enabled
        : DEFAULT_CLI_CONFIG.scout.enabled,
      url: isRecord(raw.scout) && typeof raw.scout.url === 'string'
        ? raw.scout.url
        : DEFAULT_CLI_CONFIG.scout.url,
    },
    providers,
    auxiliaryModels: parseAuxiliaryModels(raw.auxiliaryModels),
    skin: typeof raw.skin === 'string' ? raw.skin : undefined,
    providerProfiles: parseProviderProfiles(raw.providerProfiles),
    failover: parseFailoverConfig(raw.failover),
  };
}

function withEnvOverrides(config: CarinaCliConfig): CarinaCliConfig {
  const provider = normaliseProvider(process.env.DEFAULT_PROVIDER ?? config.provider);
  const providers = { ...config.providers };

  for (const name of Object.keys(providers) as ProviderName[]) {
    const apiKey = process.env[envKeyForProvider(name)];
    providers[name] = {
      ...providers[name],
      ...(apiKey ? { api_key: apiKey } : {}),
    };
  }

  return {
    ...config,
    provider,
    model: process.env.DEFAULT_MODEL ?? config.model,
    dataDir: process.env.CARINA_HOME ?? config.dataDir,
    providers,
  };
}

export async function loadFromYaml(configPath = CLI_CONFIG_PATH): Promise<CarinaCliConfig> {
  if (!fsSync.existsSync(configPath)) {
    return withEnvOverrides(DEFAULT_CLI_CONFIG);
  }

  const contents = await fs.readFile(configPath, 'utf-8');
  return withEnvOverrides(parseConfig(YAML.parse(contents)));
}

export function loadFromYamlSync(configPath = CLI_CONFIG_PATH): CarinaCliConfig {
  if (!fsSync.existsSync(configPath)) {
    return withEnvOverrides(DEFAULT_CLI_CONFIG);
  }

  const contents = fsSync.readFileSync(configPath, 'utf-8');
  return withEnvOverrides(parseConfig(YAML.parse(contents)));
}

export function applyYamlConfigToEnv(configPath = CLI_CONFIG_PATH): void {
  if (!fsSync.existsSync(configPath)) return;
  const config = loadFromYamlSync(configPath);
  process.env.DEFAULT_PROVIDER ??= config.provider;
  process.env.DEFAULT_MODEL ??= config.model;
  process.env.CARINA_DATA_DIR ??= expandHome(config.dataDir);
  if (config.scout.enabled) process.env.SCOUT_ENABLED ??= 'true';
  if (config.scout.url) process.env.SCOUT_BASE_URL ??= config.scout.url;

  for (const [provider, providerConfig] of Object.entries(config.providers)) {
    if (providerConfig.api_key) {
      process.env[envKeyForProvider(provider)] ??= providerConfig.api_key;
    }
    if (providerConfig.model) {
      process.env[`${provider.toUpperCase()}_MODEL`] ??= providerConfig.model;
    }
  }
}

export async function writeConfig(config: CarinaCliConfig, configPath = CLI_CONFIG_PATH): Promise<void> {
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, YAML.stringify(config), { mode: 0o600 });
}

function getPathValue(obj: unknown, keyPath: string): unknown {
  return keyPath.split('.').reduce<unknown>((current, part) => {
    if (!isRecord(current)) return undefined;
    return current[part];
  }, obj);
}

function setPathValue(obj: PlainRecord, keyPath: string, value: unknown): void {
  const parts = keyPath.split('.').filter(Boolean);
  let current = obj;
  for (const part of parts.slice(0, -1)) {
    if (!isRecord(current[part])) current[part] = {};
    current = current[part] as PlainRecord;
  }
  current[parts.at(-1) ?? ''] = value;
}

export async function getConfigValue(keyPath: string, configPath = CLI_CONFIG_PATH): Promise<unknown> {
  const config = await loadFromYaml(configPath);
  return getPathValue(config, keyPath);
}

function parseConfigSetValue(keyPath: string, value: string): unknown {
  if (keyPath === 'scout.enabled') return value === 'true';
  return value;
}

export async function setConfigValue(keyPath: string, value: string, configPath = CLI_CONFIG_PATH): Promise<void> {
  const config = await loadFromYaml(configPath);
  const raw = config as unknown as PlainRecord;
  setPathValue(raw, keyPath, parseConfigSetValue(keyPath, value));
  await writeConfig(parseConfig(raw), configPath);
}

const SECRET_KEY_PATTERN = /(_API_KEY|_TOKEN|_SECRET|PASSWORD|_AUTH)$/i;

export function isSecretConfigKey(keyPath: string): boolean {
  const leaf = keyPath.split('.').pop() ?? keyPath;
  return SECRET_KEY_PATTERN.test(leaf) || leaf === 'api_key';
}

export async function appendEnvValue(key: string, value: string, envPath = path.join(CARINA_HOME, '.env')): Promise<void> {
  await fs.mkdir(path.dirname(envPath), { recursive: true });
  let contents = '';
  try {
    contents = await fs.readFile(envPath, 'utf-8');
  } catch {
    contents = '';
  }
  const lines = contents.split('\n').filter((line) => !line.startsWith(`${key}=`));
  lines.push(`${key}=${value}`);
  await fs.writeFile(envPath, `${lines.filter(Boolean).join('\n')}\n`, { mode: 0o600 });
}

export async function setConfigOrSecret(
  keyPath: string,
  value: string,
  configPath = CLI_CONFIG_PATH,
  envPath = path.join(CARINA_HOME, '.env'),
): Promise<'env' | 'yaml'> {
  if (isSecretConfigKey(keyPath) || /^[A-Z][A-Z0-9_]+$/.test(keyPath)) {
    const envKey = keyPath.includes('.') ? keyPath.split('.').pop()!.toUpperCase() : keyPath;
    await appendEnvValue(envKey, value, envPath);
    return 'env';
  }
  await setConfigValue(keyPath, value, configPath);
  return 'yaml';
}

export type ConfigCheckResult = { key: string; ok: boolean; detail: string };

export async function checkConfig(configPath = CLI_CONFIG_PATH): Promise<ConfigCheckResult[]> {
  const config = await loadFromYaml(configPath);
  const results: ConfigCheckResult[] = [];

  results.push({
    key: 'config.yaml',
    ok: fsSync.existsSync(configPath),
    detail: configPath,
  });

  const hasProviderKey = Object.values(config.providers).some((p) => Boolean(p.api_key));
  const hasEnvKey = Boolean(
    process.env.DEEPSEEK_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY,
  );
  results.push({
    key: 'llm.api_key',
    ok: hasProviderKey || hasEnvKey,
    detail: hasProviderKey || hasEnvKey ? 'configured' : 'missing API key',
  });

  results.push({
    key: 'model',
    ok: Boolean(config.model),
    detail: config.model || 'not set',
  });

  results.push({
    key: 'dataDir',
    ok: Boolean(config.dataDir),
    detail: expandHome(config.dataDir),
  });

  return results;
}

export async function migrateConfig(configPath = CLI_CONFIG_PATH): Promise<string[]> {
  const added: string[] = [];
  const config = await loadFromYaml(configPath);
  const raw = config as unknown as PlainRecord;

  for (const [key, value] of Object.entries(DEFAULT_CLI_CONFIG)) {
    if (getPathValue(raw, key) === undefined) {
      setPathValue(raw, key, value);
      added.push(key);
    }
  }

  if (added.length > 0) {
    await writeConfig(parseConfig(raw), configPath);
  }
  return added;
}

export async function openConfigInEditor(configPath = CLI_CONFIG_PATH): Promise<void> {
  const editor = process.env.EDITOR ?? process.env.VISUAL ?? 'nano';
  const { spawn } = await import('child_process');
  await new Promise<void>((resolve, reject) => {
    const child = spawn(editor, [configPath], { stdio: 'inherit' });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`editor exited ${code}`))));
    child.on('error', reject);
  });
}
