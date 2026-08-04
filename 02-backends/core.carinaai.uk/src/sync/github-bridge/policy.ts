import path from 'node:path';
import type { GithubBridgeManifest } from './types.js';
import { DEFAULT_MANIFEST } from './types.js';

const SECRET_CONTENT_PATTERNS: RegExp[] = [
  /\b(ghp|gho|ghs|ghr)_[A-Za-z0-9]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bsk-[A-Za-z0-9]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\b-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(api[_-]?key|secret|password|token)\s*[:=]\s*['"][^'"]{8,}['"]/i,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
];

function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, ':::DBLSTAR_SLASH:::')
    .replace(/\*\*/g, ':::DBLSTAR:::')
    .replace(/\*/g, '[^/]*')
    .replace(/:::DBLSTAR_SLASH:::/g, '(?:.*/)?')
    .replace(/:::DBLSTAR:::/g, '.*');
  return new RegExp(`^${escaped}$`, 'i');
}

export function normalizeRepoRelPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

export function pathMatchesAnyGlob(relPath: string, globs: string[]): boolean {
  const normalized = normalizeRepoRelPath(relPath);
  return globs.some((g) => globToRegExp(g).test(normalized));
}

export function isDeniedPath(relPath: string, manifest: GithubBridgeManifest = DEFAULT_MANIFEST): boolean {
  return pathMatchesAnyGlob(relPath, manifest.denyGlobs);
}

export function isUnderAllowedFolder(relPath: string, allowedFolders: string[]): boolean {
  const normalized = normalizeRepoRelPath(relPath);
  return allowedFolders.some((folder) => {
    const f = normalizeRepoRelPath(folder);
    if (f === normalized) return true;
    if (normalized.startsWith(`${f}/`)) return true;
    // Allow exact file mounts listed in allowedFolders (e.g. AGENTS.md)
    return path.basename(normalized) === f && !f.includes('/');
  });
}

export function isWritablePath(
  relPath: string,
  writeFolders: string[],
  manifest: GithubBridgeManifest = DEFAULT_MANIFEST,
): boolean {
  if (isDeniedPath(relPath, manifest)) return false;
  return isUnderAllowedFolder(relPath, writeFolders);
}

export function contentLooksSecret(content: string): boolean {
  if (!content) return false;
  return SECRET_CONTENT_PATTERNS.some((re) => re.test(content));
}

/** Durable memory only: reject transient chat / tool-trace style dumps. */
export function looksLikeEphemeralWorkingMemory(content: string): boolean {
  const text = content.trim();
  if (!text) return true;
  if (/^\s*\{[\s\S]*"role"\s*:\s*"(user|assistant|tool)"/i.test(text)) return true;
  if (/\btool_call\b|\btool_result\b|\bfunction_call\b/i.test(text) && text.length > 400) return true;
  if (/\b(conversation transcript|raw chat dump|session transcript)\b/i.test(text)) return true;
  return false;
}

export function shouldCommitFile(opts: {
  relPath: string;
  content: string;
  allowedWriteFolders: string[];
  manifest?: GithubBridgeManifest;
}): { ok: true } | { ok: false; reason: string } {
  const manifest = opts.manifest ?? DEFAULT_MANIFEST;
  if (isDeniedPath(opts.relPath, manifest)) {
    return { ok: false, reason: 'path denied by policy' };
  }
  if (!isWritablePath(opts.relPath, opts.allowedWriteFolders, manifest)) {
    return { ok: false, reason: 'path outside approved write folders' };
  }
  if (contentLooksSecret(opts.content)) {
    return { ok: false, reason: 'content matched secret pattern' };
  }
  if (looksLikeEphemeralWorkingMemory(opts.content)) {
    return { ok: false, reason: 'content looks like ephemeral working memory' };
  }
  return { ok: true };
}

export function defaultManifestPathInRepo(): string {
  return 'sync/manifest.json';
}
