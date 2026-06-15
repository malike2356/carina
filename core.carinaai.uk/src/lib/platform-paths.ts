import { mkdirSync } from 'fs';
import { homedir, tmpdir } from 'os';
import { join } from 'path';
import { CARINA_HOME } from '../config/paths.js';

export const CARINA_TEMP_DIR = join(tmpdir(), 'carina');
export const CARINA_CONFIG_DIR = CARINA_HOME;
export const CARINA_LOGS_DIR = join(CARINA_HOME, 'logs');
export const CARINA_MEMORY_DIR = join(CARINA_HOME, 'memory');
export const CARINA_OUTPUT_DIR = join(CARINA_HOME, 'output');

export function tempFile(name: string): string {
  return join(CARINA_TEMP_DIR, name);
}

export function tempDir(name: string): string {
  return join(CARINA_TEMP_DIR, name);
}

export function ensurePlatformDirs(): void {
  mkdirSync(CARINA_TEMP_DIR, { recursive: true });
  mkdirSync(CARINA_CONFIG_DIR, { recursive: true });
}

/** @deprecated Use CARINA_CONFIG_DIR from config/paths instead of HOME fallbacks. */
export function defaultCarinaHome(): string {
  return join(homedir(), '.carina');
}
