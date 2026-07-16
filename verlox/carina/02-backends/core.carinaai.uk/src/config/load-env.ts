import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { resolveCarinaHome } from './paths.js';

function carinaEnvPath(): string {
  return path.join(resolveCarinaHome(), '.env');
}

function loadFile(envPath: string, override = false): void {
  if (fs.existsSync(envPath)) {
    dotenv.config({
      path: envPath,
      override,
      quiet: process.env.CARINA_OPS_PTY === '1' || process.env.DOTENV_CONFIG_QUIET === 'true',
    });
  }
}

export function loadCarinaEnv(): void {
  const preservedKeys = [
    'DATABASE_URL',
    'SKILLS_HUB_DATABASE_URL',
    'REDIS_URL',
    'NODE_ENV',
    'HOSTED_MODE',
  ] as const;
  const preserved = Object.fromEntries(
    preservedKeys.map((key) => [key, process.env[key]]),
  ) as Record<(typeof preservedKeys)[number], string | undefined>;

  const localEnv = path.resolve(process.cwd(), '.env');
  loadFile(localEnv);
  // Operator secrets in ~/.carina/.env win over repo .env when both exist.
  loadFile(carinaEnvPath(), true);

  for (const key of preservedKeys) {
    const value = preserved[key];
    if (value !== undefined && value !== '') {
      process.env[key] = value;
    }
  }
}

export function envExists(): boolean {
  return fs.existsSync(carinaEnvPath()) || fs.existsSync(path.resolve(process.cwd(), '.env'));
}
