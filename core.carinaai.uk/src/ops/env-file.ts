import fs from 'fs';
import path from 'path';
import { CARINA_ENV_PATH } from '../config/paths.js';

export function resolveWritableEnvPath(): string {
  const cwdEnv = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(cwdEnv)) return cwdEnv;
  if (fs.existsSync(CARINA_ENV_PATH)) return CARINA_ENV_PATH;
  return cwdEnv;
}

export function setEnvVarInFile(key: string, value: string, envPath = resolveWritableEnvPath()): void {
  const dir = path.dirname(envPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  const content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  const updated = pattern.test(content)
    ? content.replace(pattern, line)
    : `${content.trimEnd()}\n${line}\n`;
  fs.writeFileSync(envPath, updated, { encoding: 'utf8', mode: 0o600 });
}

export function readEnvVarFromFile(key: string, envPath = resolveWritableEnvPath()): string | null {
  if (!fs.existsSync(envPath)) return null;
  const content = fs.readFileSync(envPath, 'utf8');
  const pattern = new RegExp(`^${key}=(.*)$`, 'm');
  const match = content.match(pattern);
  return match?.[1]?.trim() ?? null;
}
