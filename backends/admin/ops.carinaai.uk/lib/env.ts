import { existsSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));
let __opsDir = path.dirname(__moduleDir);
if (path.basename(__opsDir) === 'dist') {
  __opsDir = path.dirname(__opsDir);
}

export const OPS_ENV_PATH = path.join(__opsDir, '.env');

export function ensureOpsEnvFile(): void {
  if (!existsSync(OPS_ENV_PATH)) {
    writeFileSync(OPS_ENV_PATH, '', { encoding: 'utf8', mode: 0o600 });
  }
}

export function setEnvVar(envPath: string, key: string, value: string): void {
  if (!existsSync(envPath)) {
    writeFileSync(envPath, '', { encoding: 'utf8', mode: 0o600 });
  }
  const content = readFileSync(envPath, 'utf8');
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  const updated = pattern.test(content)
    ? content.replace(pattern, line)
    : `${content.trimEnd()}\n${line}\n`;
  writeFileSync(envPath, updated, { encoding: 'utf8', mode: 0o600 });
  process.env[key] = value;
}
