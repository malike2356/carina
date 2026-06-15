import { homedir, platform } from 'os';
import path from 'path';
import { CARINA_RESOURCES_DIR } from '../config/paths.js';

function blockedPrefixes(): string[] {
  if (platform() === 'win32') {
    const winDir = process.env.WINDIR ?? 'C:\\Windows';
    return [winDir, path.join(winDir, 'System32')];
  }
  return ['/etc', '/usr', '/bin', '/sys', '/proc'];
}

const BLOCKED_PREFIXES = blockedPrefixes();

export function resolveWorkspacePath(raw: string): string {
  const expanded = expandPath(raw);
  if (path.isAbsolute(expanded)) return expanded;
  const root = process.env.CARINA_AGENT_WORKSPACE;
  if (root) return path.join(root, expanded);
  return path.resolve(expanded);
}

export function resolveResourcePath(raw: string): string {
  if (raw.startsWith('@resources/') || raw.startsWith('resources://')) {
    const rel = raw.replace(/^@resources\//, '').replace(/^resources:\/\//, '');
    return path.join(CARINA_RESOURCES_DIR, rel);
  }
  return resolveWorkspacePath(raw);
}

export function expandPath(raw: string): string {
  if (raw.startsWith('~/')) {
    return path.join(homedir(), raw.slice(2));
  }
  return raw;
}

export function isSafePath(filePath: string): boolean {
  if (filePath.includes('..')) return false;
  const resolved = path.resolve(filePath);
  return !BLOCKED_PREFIXES.some((p) => resolved === p || resolved.startsWith(`${p}/`));
}

export function isBlockedSystemWrite(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  return BLOCKED_PREFIXES.some((p) => resolved === p || resolved.startsWith(`${p}/`));
}
