import fs from 'fs';
import dotenv from 'dotenv';
import { CARINA_ENV_PATH } from '../../config/paths.js';

export function loadLocalEnv(envPath = CARINA_ENV_PATH): void {
  if (!fs.existsSync(envPath)) return;
  const parsed = dotenv.parse(fs.readFileSync(envPath));
  for (const [key, value] of Object.entries(parsed)) {
    process.env[key] ??= value;
  }
}

export function envKeyForProvider(provider: string): string {
  return `${provider.toUpperCase()}_API_KEY`;
}
