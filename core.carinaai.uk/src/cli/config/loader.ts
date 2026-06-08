import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import YAML from 'yaml';
import { CARINA_HOME } from '../../config/paths.js';
import { DEFAULT_CLI_CONFIG, expandHome, type CarinaCliConfig, type ProviderName } from './defaults.js';
import { envKeyForProvider } from './env.js';

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
