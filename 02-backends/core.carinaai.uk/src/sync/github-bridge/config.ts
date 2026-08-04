import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { resolveCarinaHome } from '../../config/paths.js';
import {
  DEFAULT_CONFIG,
  DEFAULT_MANIFEST,
  type GithubBridgeScopeKind,
  type GithubBridgeConfig,
  type GithubBridgeManifest,
  type GithubBridgeProduct,
} from './types.js';

function dataDir(): string {
  return path.join(resolveCarinaHome(), 'data');
}

export interface GithubBridgeScope {
  scopeKind?: GithubBridgeScopeKind;
  scopeId?: string | null;
  workspaceId?: string | null;
  userId?: string | null;
}

function normalizeScopeKind(scopeKind?: string | null): GithubBridgeScopeKind {
  if (scopeKind === 'user' || scopeKind === 'shared') return scopeKind;
  return 'workspace';
}

export function resolveGithubBridgeScope(scope?: GithubBridgeScope): {
  scopeKind: GithubBridgeScopeKind;
  scopeId: string | null;
  scopeKey: string;
} {
  const scopeKind = normalizeScopeKind(scope?.scopeKind);
  const scopeId =
    scopeKind === 'user'
      ? (scope?.scopeId?.trim() || scope?.userId?.trim() || null)
      : scopeKind === 'shared'
        ? (scope?.scopeId?.trim() || 'shared')
        : (scope?.scopeId?.trim() || scope?.workspaceId?.trim() || null);
  const keyId = scopeId || 'default';
  return { scopeKind, scopeId, scopeKey: `${scopeKind}:${keyId}` };
}

function scopeDataDir(scopeKey: string): string {
  return path.join(dataDir(), 'github-agent-sync', scopeKey);
}

export function githubBridgeConfigPath(scopeKey = 'workspace:default'): string {
  return path.join(scopeDataDir(scopeKey), 'config.json');
}

export function githubBridgeTokenPath(scopeKey = 'workspace:default'): string {
  return path.join(scopeDataDir(scopeKey), 'token');
}

export function githubBridgeIndexPath(scopeKey = 'workspace:default'): string {
  return path.join(scopeDataDir(scopeKey), 'index.json');
}

export function githubBridgeLogDir(scopeKey = 'workspace:default'): string {
  return path.join(scopeDataDir(scopeKey), 'logs');
}

export function resolveClonePath(config: GithubBridgeConfig, scopeKey = 'workspace:default'): string {
  if (config.localPath?.trim()) return path.resolve(config.localPath.trim());
  return path.join(scopeDataDir(scopeKey), 'repo');
}

function coerceProduct(value: unknown): GithubBridgeProduct {
  if (value === 'aiva' || value === 'shared' || value === 'carina') return value;
  return 'shared';
}

export function normalizeConfig(raw: Partial<GithubBridgeConfig> | null | undefined): GithubBridgeConfig {
  const base = { ...DEFAULT_CONFIG, ...(raw ?? {}) };
  return {
    ...base,
    scopeKind: normalizeScopeKind(base.scopeKind),
    scopeId:
      typeof base.scopeId === 'string'
        ? base.scopeId.trim() || null
        : base.scopeId ?? null,
    enabled: Boolean(base.enabled),
    owner: String(base.owner || DEFAULT_CONFIG.owner).trim(),
    repo: String(base.repo || DEFAULT_CONFIG.repo).trim(),
    branch: String(base.branch || DEFAULT_CONFIG.branch).trim() || 'main',
    pullIntervalMinutes: Math.max(1, Number(base.pullIntervalMinutes) || 15),
    pushIntervalMinutes: Math.max(0, Number(base.pushIntervalMinutes) || 0),
    allowedFolders: Array.isArray(base.allowedFolders) && base.allowedFolders.length
      ? base.allowedFolders.map(String)
      : [...DEFAULT_CONFIG.allowedFolders],
    humanEditsWin: base.humanEditsWin !== false,
    product: coerceProduct(base.product),
    localPath: base.localPath?.trim() || undefined,
    lastPullAt: base.lastPullAt ?? null,
    lastPushAt: base.lastPushAt ?? null,
    lastIndexAt: base.lastIndexAt ?? null,
    lastError: base.lastError ?? null,
  };
}

async function loadLegacyConfig(): Promise<GithubBridgeConfig | null> {
  try {
    const raw = JSON.parse(await fsPromises.readFile(path.join(dataDir(), 'github-agent-sync.json'), 'utf8')) as Partial<GithubBridgeConfig>;
    return normalizeConfig(raw);
  } catch {
    return null;
  }
}

export async function loadConfig(scope?: GithubBridgeScope): Promise<GithubBridgeConfig> {
  const resolved = resolveGithubBridgeScope(scope);
  try {
    const raw = JSON.parse(await fsPromises.readFile(githubBridgeConfigPath(resolved.scopeKey), 'utf8')) as Partial<GithubBridgeConfig>;
    return normalizeConfig({ ...raw, scopeKind: resolved.scopeKind, scopeId: resolved.scopeId });
  } catch {
    const legacy = await loadLegacyConfig();
    if (legacy) {
      return normalizeConfig({
        ...legacy,
        scopeKind: resolved.scopeKind,
        scopeId: resolved.scopeId,
      });
    }
    return normalizeConfig({
      scopeKind: resolved.scopeKind,
      scopeId: resolved.scopeId,
      enabled: process.env.AGENT_SYNC_GITHUB_ENABLED === 'true',
      owner: process.env.AGENT_SYNC_GITHUB_OWNER ?? DEFAULT_CONFIG.owner,
      repo: process.env.AGENT_SYNC_GITHUB_REPO ?? DEFAULT_CONFIG.repo,
      branch: process.env.AGENT_SYNC_GITHUB_BRANCH ?? DEFAULT_CONFIG.branch,
    });
  }
}

export async function saveConfig(
  patch: Partial<GithubBridgeConfig>,
  scope?: GithubBridgeScope,
): Promise<GithubBridgeConfig> {
  const current = await loadConfig(scope);
  const next = normalizeConfig({ ...current, ...patch });
  const resolved = resolveGithubBridgeScope({
    scopeKind: next.scopeKind,
    scopeId: next.scopeId,
    workspaceId: scope?.workspaceId,
    userId: scope?.userId,
  });
  await fsPromises.mkdir(scopeDataDir(resolved.scopeKey), { recursive: true });
  await fsPromises.writeFile(githubBridgeConfigPath(resolved.scopeKey), JSON.stringify(next, null, 2), { mode: 0o600 });
  return next;
}

export async function loadToken(scope?: GithubBridgeScope): Promise<string | null> {
  const resolved = resolveGithubBridgeScope(scope);
  const fromEnv = (process.env.AGENT_SYNC_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN)?.trim();
  if (fromEnv) return fromEnv;
  try {
    const token = (await fsPromises.readFile(githubBridgeTokenPath(resolved.scopeKey), 'utf8')).trim();
    return token || null;
  } catch {
    return null;
  }
}

export async function saveToken(token: string | null, scope?: GithubBridgeScope): Promise<void> {
  const resolved = resolveGithubBridgeScope(scope);
  await fsPromises.mkdir(scopeDataDir(resolved.scopeKey), { recursive: true });
  const file = githubBridgeTokenPath(resolved.scopeKey);
  if (!token?.trim()) {
    try {
      await fsPromises.unlink(file);
    } catch {
      // ignore
    }
    return;
  }
  await fsPromises.writeFile(file, `${token.trim()}\n`, { mode: 0o600 });
}

export async function hasToken(scope?: GithubBridgeScope): Promise<boolean> {
  return Boolean(await loadToken(scope));
}

export async function loadManifest(clonePath?: string): Promise<GithubBridgeManifest> {
  const candidates = [
    clonePath ? path.join(clonePath, 'sync', 'manifest.json') : null,
    path.join(resolveCarinaHome(), 'data', 'agent-sync-manifest.json'),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      const raw = JSON.parse(await fsPromises.readFile(candidate, 'utf8')) as GithubBridgeManifest;
      if (raw && typeof raw.version === 'number' && Array.isArray(raw.readFolders)) {
        return {
          ...DEFAULT_MANIFEST,
          ...raw,
          denyGlobs: raw.denyGlobs?.length ? raw.denyGlobs : DEFAULT_MANIFEST.denyGlobs,
          products: { ...DEFAULT_MANIFEST.products, ...(raw.products ?? {}) },
        };
      }
    } catch {
      // try next
    }
  }
  return DEFAULT_MANIFEST;
}

export async function writeDefaultManifestBesideClone(clonePath: string): Promise<string> {
  const target = path.join(clonePath, 'sync', 'manifest.json');
  await fsPromises.mkdir(path.dirname(target), { recursive: true });
  if (!fs.existsSync(target)) {
    await fsPromises.writeFile(target, JSON.stringify(DEFAULT_MANIFEST, null, 2), 'utf8');
  }
  return target;
}
