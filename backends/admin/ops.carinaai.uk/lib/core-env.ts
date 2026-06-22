import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));
let __opsDir = path.dirname(__moduleDir);
if (path.basename(__opsDir) === 'dist') {
  __opsDir = path.dirname(__opsDir);
}

export function coreEnvCandidates(): string[] {
  const fromEnv = process.env.CARINA_CORE_ENV_PATH?.trim();
  const candidates = [
    ...(fromEnv ? [fromEnv] : []),
    '/run/carina/core.env',
    path.resolve(__opsDir, '../core.carinaai.uk/.env.docker.runtime'),
    path.resolve(__opsDir, '../../core.carinaai.uk/.env.docker.runtime'),
    path.resolve(__opsDir, '../core.carinaai.uk/.env'),
    path.resolve(__opsDir, '../../servers/core.carinaai.uk/.env'),
    path.resolve(__opsDir, '../../core.carinaai.uk/.env'),
  ];
  return [...new Set(candidates)];
}

export function resolveCoreEnvPath(): string {
  for (const candidate of coreEnvCandidates()) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return path.resolve(__opsDir, '../core.carinaai.uk/.env');
}

export function readEnvValue(envPath: string, key: string): string | null {
  if (!fs.existsSync(envPath)) return null;
  const content = fs.readFileSync(envPath, 'utf8');
  const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
  const value = match?.[1]?.trim().replace(/^["']|["']$/g, '') ?? '';
  return value || null;
}

export function readCoreOpsToken(): string | null {
  for (const candidate of coreEnvCandidates()) {
    const token = readEnvValue(candidate, 'CARINA_OPS_TOKEN');
    if (token) return token;
  }
  return process.env.CARINA_OPS_TOKEN?.trim() || null;
}

export function coreEnvReadable(): boolean {
  return Boolean(readCoreOpsToken());
}

export function coreEnvSourceLabel(): string {
  for (const candidate of coreEnvCandidates()) {
    if (readEnvValue(candidate, 'CARINA_OPS_TOKEN')) {
      return candidate;
    }
  }
  if (process.env.CARINA_OPS_TOKEN?.trim()) {
    return 'container environment (.env.ops.runtime)';
  }
  return resolveCoreEnvPath();
}
