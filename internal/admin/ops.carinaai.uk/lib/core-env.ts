import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));
let __opsDir = path.dirname(__moduleDir);
if (path.basename(__opsDir) === 'dist') {
  __opsDir = path.dirname(__opsDir);
}

export function resolveCoreEnvPath(): string {
  if (process.env.CARINA_CORE_ENV_PATH?.trim()) {
    return process.env.CARINA_CORE_ENV_PATH.trim();
  }
  const sibling = path.resolve(__opsDir, '../../servers/core.carinaai.uk/.env');
  if (fs.existsSync(sibling)) return sibling;
  return '/home/malike/apps/core.carinaai.uk/.env';
}

export function readEnvValue(envPath: string, key: string): string | null {
  if (!fs.existsSync(envPath)) return null;
  const content = fs.readFileSync(envPath, 'utf8');
  const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
  const value = match?.[1]?.trim() ?? '';
  return value || null;
}

export function readCoreOpsToken(): string | null {
  return readEnvValue(resolveCoreEnvPath(), 'CARINA_OPS_TOKEN');
}

export function coreEnvReadable(): boolean {
  try {
    const envPath = resolveCoreEnvPath();
    fs.accessSync(envPath, fs.constants.R_OK);
    return Boolean(readCoreOpsToken());
  } catch {
    return false;
  }
}
