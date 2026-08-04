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

/**
 * Load .env files without clobbering orchestration-provided secrets.
 * Order: repo `.env` (fill missing) -> `~/.carina/.env` (wins over repo) ->
 * restore any keys that were already set in the process environment (Docker/K8s/systemd win).
 */
export function loadCarinaEnv(): void {
  const preexisting = { ...process.env };

  const localEnv = path.resolve(process.cwd(), '.env');
  loadFile(localEnv, false);
  // Operator secrets in ~/.carina/.env win over repo .env when both exist.
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
