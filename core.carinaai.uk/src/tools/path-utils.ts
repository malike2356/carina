import { homedir } from 'os';
import path from 'path';
import { CARINA_RESOURCES_DIR } from '../config/paths.js';

const BLOCKED_PREFIXES = ['/etc', '/usr', '/bin', '/sys', '/proc'];

export function resolveResourcePath(raw: string): string {
  if (raw.startsWith('@resources/') || raw.startsWith('resources://')) {
    const rel = raw.replace(/^@resources\//, '').replace(/^resources:\/\//, '');
    return path.join(CARINA_RESOURCES_DIR, rel);
  }
  return expandPath(raw);
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
