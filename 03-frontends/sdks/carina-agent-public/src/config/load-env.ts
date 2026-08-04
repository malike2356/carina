import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { resolveCarinaHome } from './paths.js';

function carinaEnvPath(): string {
  return path.join(resolveCarinaHome(), '.env');
}

function loadFile(envPath: string, override = false): void {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override });
  }
}

/** Load .env files; keys already set in the process environment always win. */
export function loadCarinaEnv(): void {
  const preexisting = { ...process.env };
  const localEnv = path.resolve(process.cwd(), '.env');
  loadFile(localEnv, false);
  loadFile(carinaEnvPath(), true);
  for (const [key, value] of Object.entries(preexisting)) {
    if (value !== undefined && value !== '') {
      process.env[key] = value;
    }
  }
}

export function envExists(): boolean {
  return fs.existsSync(carinaEnvPath()) || fs.existsSync(path.resolve(process.cwd(), '.env'));
}
