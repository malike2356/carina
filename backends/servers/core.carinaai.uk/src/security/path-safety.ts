import path from 'path';
import { egressFilter } from './egress-filter.js';
import {
  expandPath,
  isBlockedSystemWrite,
  isSafePath,
  resolveResourcePath,
  resolveWorkspacePath,
} from '../tools/path-utils.js';

export type PathSafetyResult =
  | { allowed: true; resolved: string }
  | { allowed: false; reason: string; code: 'PATH_TRAVERSAL' | 'SYSTEM_PATH' | 'OUTSIDE_WORKSPACE' };

export type UrlSafetyResult =
  | { allowed: true; hostname: string }
  | { allowed: false; reason: string; code: 'INVALID_URL' | 'PROTOCOL' | 'PRIVATE_HOST' | 'EGRESS_BLOCKED' };

const PRIVATE_HOST_PATTERNS: Array<(host: string) => boolean> = [
  (h) => h === 'localhost' || h === '127.0.0.1' || h === '::1',
  (h) => h.startsWith('10.'),
  (h) => h.startsWith('192.168.'),
  (h) => /^172\.(1[6-9]|2\d|3[01])\./.test(h),
  (h) => h.endsWith('.local') || h.endsWith('.internal'),
];

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return PRIVATE_HOST_PATTERNS.some((fn) => fn(h));
}

export function evaluateResolvedPathSafety(
  resolvedPath: string,
  mode: 'read' | 'write' = 'read',
  options?: { requireWorkspace?: boolean },
): PathSafetyResult {
  if (!isSafePath(resolvedPath)) {
    return {
      allowed: false,
      reason: 'path traversal or blocked system path',
      code: 'PATH_TRAVERSAL',
    };
  }
  if (mode === 'write' && isBlockedSystemWrite(resolvedPath)) {
    return {
      allowed: false,
      reason: 'writes to system paths are blocked',
      code: 'SYSTEM_PATH',
    };
  }

  const workspace = process.env.CARINA_AGENT_WORKSPACE;
  if (options?.requireWorkspace !== false && workspace) {
    const wsRoot = path.resolve(workspace);
    const target = path.resolve(resolvedPath);
    const rel = path.relative(wsRoot, target);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      return {
        allowed: false,
        reason: 'path outside agent workspace',
        code: 'OUTSIDE_WORKSPACE',
      };
    }
  }

  return { allowed: true, resolved: path.resolve(resolvedPath) };
}

export function evaluatePathSafety(
  rawPath: string,
  mode: 'read' | 'write' = 'read',
  options?: { requireWorkspace?: boolean },
): PathSafetyResult {
  const expanded = expandPath(rawPath);
  const resolved = expanded.startsWith('@resources/') || expanded.startsWith('resources://')
    ? resolveResourcePath(expanded)
    : resolveWorkspacePath(expanded);
  return evaluateResolvedPathSafety(resolved, mode, options);
}

export function evaluateUrlSafety(
  urlStr: string,
  options?: { httpsOnly?: boolean; blockPrivateHosts?: boolean; useEgressFilter?: boolean },
): UrlSafetyResult {
  const httpsOnly = options?.httpsOnly !== false;
  const blockPrivateHosts = options?.blockPrivateHosts !== false;
  const useEgressFilter = options?.useEgressFilter ?? process.env.CARINA_EGRESS_FILTER === 'true';

  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { allowed: false, reason: 'invalid URL', code: 'INVALID_URL' };
  }

  if (httpsOnly && parsed.protocol !== 'https:') {
    const devLocal =
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
    if (!devLocal) {
      return { allowed: false, reason: 'only https URLs are allowed', code: 'PROTOCOL' };
    }
  }

  const hostname = parsed.hostname.toLowerCase();
  if (blockPrivateHosts && isPrivateHost(hostname)) {
    return {
      allowed: false,
      reason: 'requests to internal or localhost addresses are blocked',
      code: 'PRIVATE_HOST',
    };
  }

  if (useEgressFilter && !egressFilter.isAllowed(urlStr)) {
    return {
      allowed: false,
      reason: `hostname '${hostname}' is not in the egress allowlist`,
      code: 'EGRESS_BLOCKED',
    };
  }

  return { allowed: true, hostname };
}
