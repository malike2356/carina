import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import {
  hasToken,
  loadConfig,
  loadManifest,
  loadToken,
  resolveGithubBridgeScope,
  resolveClonePath,
  saveConfig,
  saveToken,
  writeDefaultManifestBesideClone,
  type GithubBridgeScope,
} from './config.js';
import { ensureClone, listTrackedFiles, pullRebase, commitAndPush } from './git.js';
import {
  buildChunk,
  loadIndex,
  saveIndex,
  searchIndex,
  upsertRagChunks,
  type IndexedChunk,
} from './index-store.js';
import {
  isDeniedPath,
  isUnderAllowedFolder,
  shouldCommitFile,
  normalizeRepoRelPath,
} from './policy.js';
import type {
  GithubBridgeConfig,
  GithubBridgeSearchHit,
  GithubBridgeStatus,
  SyncCycleResult,
} from './types.js';
import { DEFAULT_MANIFEST } from './types.js';
import { spawn } from 'node:child_process';

async function gitDiffNames(localPath: string): Promise<string[]> {
  return new Promise((resolve) => {
    const child = spawn('git', ['diff', '--name-only', 'HEAD'], {
      cwd: localPath,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    let stdout = '';
    child.stdout.on('data', (c: Buffer) => {
      stdout += c.toString('utf8');
    });
    child.on('close', () => {
      resolve(
        stdout
          .split('\n')
          .map((line) => normalizeRepoRelPath(line.trim()))
          .filter(Boolean),
      );
    });
    child.on('error', () => resolve([]));
  });
}

async function captureHumanEdits(
  localPath: string,
  allowedFolders: string[],
): Promise<Map<string, string>> {
  const changed = await gitDiffNames(localPath);
  const preserved = new Map<string, string>();
  for (const rel of changed) {
    if (!isUnderAllowedFolder(rel, allowedFolders)) continue;
    const content = await readTextIfSmall(path.join(localPath, rel));
    if (content != null) preserved.set(rel, content);
  }
  return preserved;
}

async function restoreHumanEdits(
  localPath: string,
  preserved: Map<string, string>,
): Promise<string[]> {
  const restored: string[] = [];
  for (const [rel, content] of preserved) {
    const abs = path.join(localPath, rel);
    await fsPromises.mkdir(path.dirname(abs), { recursive: true });
    await fsPromises.writeFile(abs, content, 'utf8');
    restored.push(rel);
  }
  return restored;
}

async function walkFiles(root: string, relBase = ''): Promise<string[]> {
  const out: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = await fsPromises.readdir(path.join(root, relBase), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const rel = normalizeRepoRelPath(path.join(relBase, entry.name));
    if (entry.isDirectory()) {
      out.push(...(await walkFiles(root, rel)));
    } else if (entry.isFile()) {
      out.push(rel);
    }
  }
  return out;
}

async function readTextIfSmall(filePath: string, maxBytes = 512_000): Promise<string | null> {
  try {
    const stat = await fsPromises.stat(filePath);
    if (!stat.isFile() || stat.size > maxBytes) return null;
    return await fsPromises.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

export async function getStatus(scope?: GithubBridgeScope): Promise<GithubBridgeStatus> {
  const config = await loadConfig(scope);
  const resolved = resolveGithubBridgeScope({
    scopeKind: config.scopeKind,
    scopeId: config.scopeId,
    workspaceId: scope?.workspaceId,
    userId: scope?.userId,
  });
  const localPath = resolveClonePath(config, resolved.scopeKey);
  const index = await loadIndex(resolved);
  return {
    scopeKind: resolved.scopeKind,
    scopeId: resolved.scopeId,
    scopeKey: resolved.scopeKey,
    configured: Boolean(config.owner && config.repo),
    enabled: config.enabled,
    hasToken: await hasToken(resolved),
    repo: config.owner && config.repo ? `${config.owner}/${config.repo}` : null,
    branch: config.branch,
    localPath,
    cloneExists: fs.existsSync(path.join(localPath, '.git')),
    allowedFolders: config.allowedFolders,
    pullIntervalMinutes: config.pullIntervalMinutes,
    pushIntervalMinutes: config.pushIntervalMinutes,
    humanEditsWin: config.humanEditsWin,
    product: config.product,
    lastPullAt: config.lastPullAt ?? null,
    lastPushAt: config.lastPushAt ?? null,
    lastIndexAt: config.lastIndexAt ?? null,
    lastError: config.lastError ?? null,
    indexedChunks: index.chunks.length,
  };
}

export async function updateSettings(input: {
  scopeKind?: GithubBridgeScope['scopeKind'];
  scopeId?: string | null;
  enabled?: boolean;
  owner?: string;
  repo?: string;
  branch?: string;
  pullIntervalMinutes?: number;
  pushIntervalMinutes?: number;
  allowedFolders?: string[];
  humanEditsWin?: boolean;
  product?: GithubBridgeConfig['product'];
  localPath?: string;
  token?: string | null;
}, scope?: GithubBridgeScope): Promise<GithubBridgeStatus> {
  const resolved = resolveGithubBridgeScope({
    scopeKind: input.scopeKind ?? scope?.scopeKind,
    scopeId: input.scopeId ?? scope?.scopeId,
    workspaceId: scope?.workspaceId,
    userId: scope?.userId,
  });
  if (input.token !== undefined) {
    await saveToken(input.token, resolved);
  }
  const { token: _token, ...rest } = input;
  await saveConfig(rest, resolved);
  return getStatus(resolved);
}

export async function rebuildIndex(
  config?: GithubBridgeConfig,
  scope?: GithubBridgeScope,
): Promise<number> {
  const cfg = config ?? (await loadConfig(scope));
  const resolved = resolveGithubBridgeScope({
    scopeKind: cfg.scopeKind,
    scopeId: cfg.scopeId,
    workspaceId: scope?.workspaceId,
    userId: scope?.userId,
  });
  const localPath = resolveClonePath(cfg, resolved.scopeKey);
  const manifest = await loadManifest(localPath);
  const productMount = manifest.products[cfg.product] ?? DEFAULT_MANIFEST.products.carina;
  const folders = cfg.allowedFolders.length ? cfg.allowedFolders : productMount.mountFolders;
  const files = await walkFiles(localPath);
  const chunks: IndexedChunk[] = [];

  for (const rel of files) {
    if (isDeniedPath(rel, manifest)) continue;
    if (!isUnderAllowedFolder(rel, folders)) continue;
    const content = await readTextIfSmall(path.join(localPath, rel));
    if (content == null) continue;
    chunks.push(
      buildChunk({
        path: rel,
        content,
        product: cfg.product,
        agent: productMount.agentId,
      }),
    );
  }

  await saveIndex(chunks, resolved);
  void upsertRagChunks(chunks, resolved);
  await saveConfig({ lastIndexAt: new Date().toISOString(), lastError: null }, resolved);
  return chunks.length;
}

export async function pullNow(scope?: GithubBridgeScope): Promise<SyncCycleResult> {
  const config = await loadConfig(scope);
  const resolved = resolveGithubBridgeScope({
    scopeKind: config.scopeKind,
    scopeId: config.scopeId,
    workspaceId: scope?.workspaceId,
    userId: scope?.userId,
  });
  const token = await loadToken(resolved);
  if (!config.enabled) return { ok: false, action: 'pull', error: 'GitHub agent sync is disabled' };
  if (!token) return { ok: false, action: 'pull', error: 'Missing AGENT_SYNC_GITHUB_TOKEN / GITHUB_TOKEN' };

  const localPath = resolveClonePath(config, resolved.scopeKey);
  try {
    await ensureClone({
      owner: config.owner,
      repo: config.repo,
      branch: config.branch,
      token,
      localPath,
    });
    const preserved = config.humanEditsWin
      ? await captureHumanEdits(localPath, config.allowedFolders)
      : new Map<string, string>();
    await pullRebase({
      localPath,
      branch: config.branch,
      token,
      owner: config.owner,
      repo: config.repo,
    });
    const skippedHuman = config.humanEditsWin
      ? await restoreHumanEdits(localPath, preserved)
      : [];
    await writeDefaultManifestBesideClone(localPath);
    const indexed = await rebuildIndex(config, resolved);
    await saveConfig({ lastPullAt: new Date().toISOString(), lastError: null }, resolved);
    return { ok: true, action: 'pull', pulled: true, indexed, skippedHuman };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await saveConfig({ lastError: error }, resolved);
    return { ok: false, action: 'pull', error };
  }
}

export async function pushApprovedDurableUpdates(opts?: {
  message?: string;
  paths?: string[];
}, scope?: GithubBridgeScope): Promise<SyncCycleResult> {
  const config = await loadConfig(scope);
  const resolved = resolveGithubBridgeScope({
    scopeKind: config.scopeKind,
    scopeId: config.scopeId,
    workspaceId: scope?.workspaceId,
    userId: scope?.userId,
  });
  const token = await loadToken(resolved);
  if (!config.enabled) return { ok: false, action: 'push', error: 'GitHub agent sync is disabled' };
  if (!token) return { ok: false, action: 'push', error: 'Missing AGENT_SYNC_GITHUB_TOKEN / GITHUB_TOKEN' };

  const localPath = resolveClonePath(config, resolved.scopeKey);
  if (!fs.existsSync(path.join(localPath, '.git'))) {
    return { ok: false, action: 'push', error: 'Clone missing; pull first' };
  }

  const manifest = await loadManifest(localPath);
  const writeFolders = manifest.writeFolders;
  const candidates = opts?.paths?.length
    ? opts.paths.map(normalizeRepoRelPath)
    : await listTrackedFiles(localPath).catch(() => walkFiles(localPath));

  const committedFiles: string[] = [];
  const skippedSecrets: string[] = [];

  for (const rel of candidates) {
    const content = await readTextIfSmall(path.join(localPath, rel));
    if (content == null) continue;
    const verdict = shouldCommitFile({
      relPath: rel,
      content,
      allowedWriteFolders: writeFolders,
      manifest,
    });
    if (!verdict.ok) {
      if (verdict.reason.includes('secret')) skippedSecrets.push(rel);
      continue;
    }
    committedFiles.push(rel);
  }

  if (!committedFiles.length) {
    return {
      ok: true,
      action: 'push',
      pushed: false,
      committedFiles: [],
      skippedSecrets,
    };
  }

  try {
    // Pull first to reduce conflicts.
    await pullRebase({
      localPath,
      branch: config.branch,
      token,
      owner: config.owner,
      repo: config.repo,
    });
    const agentId = (manifest.products[config.product] ?? DEFAULT_MANIFEST.products.carina).agentId;
    const result = await commitAndPush({
      localPath,
      branch: config.branch,
      token,
      owner: config.owner,
      repo: config.repo,
      message: opts?.message?.trim() || `agent(${agentId}): durable memory sync`,
      paths: committedFiles,
    });
    await saveConfig({
      lastPushAt: result.pushed ? new Date().toISOString() : config.lastPushAt,
      lastError: null,
    }, resolved);
    return {
      ok: true,
      action: 'push',
      pushed: result.pushed,
      committedFiles: result.committed ? committedFiles : [],
      skippedSecrets,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await saveConfig({ lastError: error }, resolved);
    return { ok: false, action: 'push', error, skippedSecrets, committedFiles };
  }
}

export async function writeDurableNote(opts: {
  relativePath: string;
  content: string;
  push?: boolean;
}, scope?: GithubBridgeScope): Promise<SyncCycleResult> {
  const config = await loadConfig(scope);
  const resolved = resolveGithubBridgeScope({
    scopeKind: config.scopeKind,
    scopeId: config.scopeId,
    workspaceId: scope?.workspaceId,
    userId: scope?.userId,
  });
  const localPath = resolveClonePath(config, resolved.scopeKey);
  const manifest = await loadManifest(localPath);
  const rel = normalizeRepoRelPath(opts.relativePath);
  const verdict = shouldCommitFile({
    relPath: rel,
    content: opts.content,
    allowedWriteFolders: manifest.writeFolders,
    manifest,
  });
  if (!verdict.ok) {
    return { ok: false, action: 'push', error: verdict.reason };
  }
  const abs = path.join(localPath, rel);
  await fsPromises.mkdir(path.dirname(abs), { recursive: true });
  await fsPromises.writeFile(abs, opts.content, 'utf8');
  if (opts.push === false) {
    return { ok: true, action: 'push', pushed: false, committedFiles: [rel] };
  }
  return pushApprovedDurableUpdates({ paths: [rel] }, resolved);
}

export async function searchSharedKnowledge(
  query: string,
  limit = 8,
  filters?: { product?: string; agent?: string; pathPrefix?: string },
  scope?: GithubBridgeScope,
): Promise<GithubBridgeSearchHit[]> {
  const index = await loadIndex(scope);
  if (!index.chunks.length) {
    // Lazy index if clone already exists.
    const status = await getStatus(scope);
    if (status.cloneExists) await rebuildIndex(undefined, scope);
  }
  return searchIndex(await loadIndex(scope), query, limit, filters);
}

export async function runFullSyncCycle(scope?: GithubBridgeScope): Promise<SyncCycleResult> {
  const pull = await pullNow(scope);
  if (!pull.ok) return { ...pull, action: 'full' };
  const config = await loadConfig(scope);
  const resolved = resolveGithubBridgeScope({
    scopeKind: config.scopeKind,
    scopeId: config.scopeId,
    workspaceId: scope?.workspaceId,
    userId: scope?.userId,
  });
  if (config.pushIntervalMinutes > 0) {
    const push = await pushApprovedDurableUpdates({}, resolved);
    return {
      ok: push.ok,
      action: 'full',
      pulled: true,
      pushed: push.pushed,
      indexed: pull.indexed,
      committedFiles: push.committedFiles,
      skippedSecrets: push.skippedSecrets,
      error: push.error,
    };
  }
  return { ok: true, action: 'full', pulled: true, indexed: pull.indexed, pushed: false };
}
