import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CARINA_HOME } from '../config/paths.js';

export type SystemPromptFileKey =
  | 'tool_enforcement'
  | 'anti_fabrication'
  | 'turn_end_model'
  | 'memory_discipline'
  | 'execution_checklist'
  | 'feature_guidance';

const FILE_KEYS: readonly SystemPromptFileKey[] = [
  'tool_enforcement',
  'anti_fabrication',
  'turn_end_model',
  'memory_discipline',
  'execution_checklist',
  'feature_guidance',
];

export function systemPromptFilesDir(homeDir = CARINA_HOME): string {
  return path.join(homeDir, 'system');
}

export function legacyKarinaSystemDir(): string {
  return path.join(os.homedir(), '.karina', 'system');
}

function readFileIfPresent(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf8').trim();
  return content.length > 0 ? content : null;
}

export function readSystemPromptFile(
  key: SystemPromptFileKey,
  homeDir = CARINA_HOME,
): string | null {
  const primary = path.join(systemPromptFilesDir(homeDir), `${key}.md`);
  const fromCarina = readFileIfPresent(primary);
  if (fromCarina) return fromCarina;

  const legacy = path.join(legacyKarinaSystemDir(), `${key}.md`);
  return readFileIfPresent(legacy);
}

export function loadSystemPromptFileOverlay(
  key: SystemPromptFileKey,
  fallback: () => string,
  homeDir = CARINA_HOME,
): string {
  return readSystemPromptFile(key, homeDir) ?? fallback();
}

export function listPresentSystemPromptFiles(homeDir = CARINA_HOME): SystemPromptFileKey[] {
  return FILE_KEYS.filter((key) => readSystemPromptFile(key, homeDir) !== null);
}
