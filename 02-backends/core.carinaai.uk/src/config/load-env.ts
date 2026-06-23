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
  const localEnv = path.resolve(process.cwd(), '.env');
  loadFile(carinaEnvPath());
  loadFile(localEnv, true);
}

export function envExists(): boolean {
  return fs.existsSync(carinaEnvPath()) || fs.existsSync(path.resolve(process.cwd(), '.env'));
}
