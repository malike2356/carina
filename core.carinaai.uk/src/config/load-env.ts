import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { CARINA_ENV_PATH } from './paths.js';

function loadFile(envPath: string, override = false): void {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override });
  }
}

export function loadCarinaEnv(): void {
  const localEnv = path.resolve(process.cwd(), '.env');
  loadFile(CARINA_ENV_PATH);
  loadFile(localEnv, true);
}

export function envExists(): boolean {
  return fs.existsSync(CARINA_ENV_PATH) || fs.existsSync(path.resolve(process.cwd(), '.env'));
}
