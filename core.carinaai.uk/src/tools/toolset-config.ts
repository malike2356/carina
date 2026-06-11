import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import YAML from 'yaml';
import { CARINA_HOME } from '../config/paths.js';
import { resolveToolset, TOOLSET_MAP, TOOLSET_NAMES } from './toolset.js';

export { TOOLSET_NAMES };

export function toolsetsConfigPath(): string {
  return process.env.CARINA_TOOLSETS_FILE ?? path.join(CARINA_HOME, 'toolsets.yaml');
}

/** @deprecated use toolsetsConfigPath() */
export const TOOLSETS_PATH = toolsetsConfigPath();

export const PLATFORM_NAMES = [
  'default',
  'cli',
  'web',
  'telegram',
  'whatsapp',
  'discord',
  'slack',
  'sms',
  'signal',
  'matrix',
  'mattermost',
  'dingtalk',
  'feishu',
  'wechat',
  'imessage',
  'email',
  'homeassistant',
  'api',
  'mcp',
  'webhooks',
  'cron',
] as const;

export type PlatformName = (typeof PLATFORM_NAMES)[number];

export type ToolsetScope = {
  enabled?: string[];
  disabled?: string[];
};

export type ToolsetsConfig = {
  version?: number;
  default?: ToolsetScope;
  platforms?: Partial<Record<string, ToolsetScope>>;
  /** @deprecated legacy flat format */
  enabled?: string[];
  /** @deprecated legacy flat format */
  disabled?: string[];
};

/** Minimal toolsets for fresh installs; operators opt in to terminal, browser, messaging, etc. */
export const LEAST_PRIVILEGE_TOOLSETS = ['web', 'search', 'file', 'skills'] as const;

/** Sensible per-channel defaults when no platform override exists in config. */
export const PLATFORM_DEFAULT_TOOLSETS: Record<string, readonly string[]> = {
  default: LEAST_PRIVILEGE_TOOLSETS,
  cli: LEAST_PRIVILEGE_TOOLSETS,
  web: LEAST_PRIVILEGE_TOOLSETS,
  cron: ['terminal', 'file', 'web', 'search', 'skills', 'messaging'],
  telegram: ['messaging', 'file', 'web', 'search', 'skills', 'sync', 'media'],
  whatsapp: ['messaging', 'file', 'web', 'search', 'skills', 'sync'],
  discord: ['messaging', 'file', 'web', 'search', 'skills', 'integrations', 'sync'],
  slack: ['messaging', 'file', 'web', 'search', 'skills', 'sync'],
  sms: ['messaging', 'search'],
  signal: ['messaging', 'file', 'web', 'search'],
  matrix: ['messaging', 'file', 'web', 'search'],
  mattermost: ['messaging', 'file', 'web', 'search', 'skills'],
  dingtalk: ['messaging', 'file', 'web', 'search'],
  feishu: ['messaging', 'file', 'web', 'search', 'skills', 'integrations'],
  wechat: ['messaging', 'file', 'web', 'search'],
  imessage: ['messaging', 'file', 'web', 'search', 'media'],
  email: ['messaging', 'file', 'web', 'search', 'skills'],
  homeassistant: ['integrations', 'web', 'search', 'file'],
  api: ['web', 'file', 'search', 'skills', 'mcp'],
  mcp: ['web', 'file', 'search', 'skills', 'sync', 'media'],
  webhooks: ['web', 'messaging', 'file'],
};

function normalizePlatform(platform?: string): string {
  const key = (platform ?? 'default').toLowerCase().trim();
  return key || 'default';
}

function legacyScope(cfg: ToolsetsConfig): ToolsetScope {
  if (cfg.default) return cfg.default;
  if (cfg.enabled || cfg.disabled) {
    return { enabled: cfg.enabled, disabled: cfg.disabled };
  }
  return {};
}

export function normalizeToolsetsConfig(raw: ToolsetsConfig): ToolsetsConfig {
  const scope = legacyScope(raw);
  return {
    version: raw.version ?? 1,
    default: scope,
    platforms: raw.platforms ?? {},
  };
}

export function loadToolsetsConfig(filePath?: string): ToolsetsConfig {
  const resolved = filePath ?? toolsetsConfigPath();
  if (!fs.existsSync(resolved)) return {};
  const parsed = YAML.parse(fs.readFileSync(resolved, 'utf-8')) as ToolsetsConfig;
  return normalizeToolsetsConfig(parsed ?? {});
}

export async function saveToolsetsConfig(config: ToolsetsConfig, filePath?: string): Promise<void> {
  const resolved = filePath ?? toolsetsConfigPath();
  const normalized = normalizeToolsetsConfig(config);
  await fsp.mkdir(path.dirname(resolved), { recursive: true });
  await fsp.writeFile(resolved, YAML.stringify(normalized), { mode: 0o600 });
}

export function hasToolsetsConfig(filePath?: string): boolean {
  return fs.existsSync(filePath ?? toolsetsConfigPath());
}

export function defaultEnabledToolsets(platform?: string): string[] {
  const key = normalizePlatform(platform);
  const preset = PLATFORM_DEFAULT_TOOLSETS[key] ?? PLATFORM_DEFAULT_TOOLSETS.default;
  return [...preset];
}

export function resolvePlatformEnabledToolsets(cfg: ToolsetsConfig, platform?: string): string[] {
  const key = normalizePlatform(platform);
  const normalized = normalizeToolsetsConfig(cfg);
  const platformScope = normalized.platforms?.[key];
  if (platformScope && Array.isArray(platformScope.enabled)) {
    return [...platformScope.enabled];
  }
  if (key === 'default' && Array.isArray(normalized.default?.enabled)) {
    return [...normalized.default.enabled];
  }
  if (normalized.default?.enabled && normalized.default.enabled.length > 0) {
    return [...normalized.default.enabled];
  }
  return defaultEnabledToolsets(key);
}

export function resolvePlatformDisabledTools(cfg: ToolsetsConfig, platform?: string): Set<string> {
  const key = normalizePlatform(platform);
  const normalized = normalizeToolsetsConfig(cfg);
  const disabled = new Set<string>();
  for (const name of normalized.default?.disabled ?? []) disabled.add(name);
  for (const name of normalized.platforms?.[key]?.disabled ?? []) disabled.add(name);
  return disabled;
}

export function isToolsetName(name: string): boolean {
  return (TOOLSET_NAMES as readonly string[]).includes(name)
    || Object.prototype.hasOwnProperty.call(TOOLSET_MAP, name.toLowerCase());
}

export function normalizeAllowedToolNames(names: string[]): string[] {
  if (names.length === 0) return [];
  if (names.every(isToolsetName)) return resolveToolset(names);
  return names;
}

/**
 * Resolve tool names available to an agent turn.
 * Without toolsets.yaml, uses least-privilege platform presets (not all tools).
 */
export function resolveActiveToolNames(opts: {
  platform?: string;
  explicitAllowed?: string[];
  config?: ToolsetsConfig;
}): string[] {
  if (opts.explicitAllowed?.length) {
    return normalizeAllowedToolNames(opts.explicitAllowed);
  }

  if (!opts.config && !hasToolsetsConfig()) {
    const preset = defaultEnabledToolsets(opts.platform);
    return resolveToolset(preset);
  }
  const cfg = opts.config ?? loadToolsetsConfig();

  const enabledSets = resolvePlatformEnabledToolsets(cfg, opts.platform);
  const toolNames = resolveToolset(enabledSets);
  const disabled = resolvePlatformDisabledTools(cfg, opts.platform);
  const filtered = toolNames.filter((t) => !disabled.has(t));
  return filtered.length > 0 ? filtered : toolNames;
}

export function describePlatformToolsets(
  platform: string,
  cfg: ToolsetsConfig = loadToolsetsConfig(),
): {
  platform: string;
  enabledToolsets: string[];
  disabledTools: string[];
  toolCount: number;
  usingPreset: boolean;
} {
  const key = normalizePlatform(platform);
  const normalized = normalizeToolsetsConfig(cfg);
  const platformScope = normalized.platforms?.[key];
  const enabledToolsets = resolvePlatformEnabledToolsets(cfg, key);
  const disabledTools = [...resolvePlatformDisabledTools(cfg, key)];
  const toolCount = resolveToolset(enabledToolsets).filter((t) => !disabledTools.includes(t)).length;
  return {
    platform: key,
    enabledToolsets,
    disabledTools,
    toolCount,
    usingPreset: !platformScope?.enabled && !normalized.default?.enabled,
  };
}

export function setPlatformToolsets(
  platform: string,
  enabled: string[],
  cfg: ToolsetsConfig = loadToolsetsConfig(),
): ToolsetsConfig {
  const key = normalizePlatform(platform);
  const normalized = normalizeToolsetsConfig(cfg);
  const platforms = { ...normalized.platforms };
  platforms[key] = { ...platforms[key], enabled: [...enabled] };
  return { ...normalized, platforms };
}

export function togglePlatformToolset(
  platform: string,
  toolset: string,
  enable: boolean,
  cfg: ToolsetsConfig = loadToolsetsConfig(),
): ToolsetsConfig {
  const current = new Set(resolvePlatformEnabledToolsets(cfg, platform));
  if (enable) current.add(toolset);
  else current.delete(toolset);
  return setPlatformToolsets(platform, [...current], cfg);
}

export function setDefaultToolsets(
  enabled: string[],
  cfg: ToolsetsConfig = loadToolsetsConfig(),
): ToolsetsConfig {
  const normalized = normalizeToolsetsConfig(cfg);
  return {
    ...normalized,
    default: { ...normalized.default, enabled: [...enabled] },
  };
}

export function toggleDefaultToolset(
  toolset: string,
  enable: boolean,
  cfg: ToolsetsConfig = loadToolsetsConfig(),
): ToolsetsConfig {
  const current = new Set(resolvePlatformEnabledToolsets(cfg, 'default'));
  if (enable) current.add(toolset);
  else current.delete(toolset);
  return setDefaultToolsets([...current], cfg);
}

export function toggleDisabledTool(
  toolName: string,
  disable: boolean,
  cfg: ToolsetsConfig = loadToolsetsConfig(),
): ToolsetsConfig {
  const normalized = normalizeToolsetsConfig(cfg);
  const disabled = new Set(normalized.default?.disabled ?? []);
  if (disable) disabled.add(toolName);
  else disabled.delete(toolName);
  return {
    ...normalized,
    default: { ...normalized.default, disabled: [...disabled] },
  };
}
