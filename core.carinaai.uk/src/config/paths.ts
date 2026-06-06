import path from 'path';
import os from 'os';

export const CARINA_HOME = process.env.CARINA_HOME ?? path.join(os.homedir(), '.carina');
export const CARINA_ENV_PATH = path.join(CARINA_HOME, '.env');
export const CARINA_DATA_DIR = path.join(CARINA_HOME, 'data');
export const CARINA_PACKS_DIR = path.join(CARINA_HOME, 'packs');

export function packDir(name: string): string {
  return path.join(CARINA_PACKS_DIR, name);
}
