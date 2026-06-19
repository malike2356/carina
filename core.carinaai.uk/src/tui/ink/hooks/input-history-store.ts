import fs from 'fs';
import path from 'path';
import { CARINA_HOME } from '../../../config/paths.js';

const HISTORY_FILE = path.join(CARINA_HOME, 'input-history.json');
const MAX_HISTORY = 1000;

function readHistoryFile(): string[] {
  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(String).filter(Boolean).slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

export function saveInputHistory(entries: string[]): void {
  try {
    fs.mkdirSync(CARINA_HOME, { recursive: true });
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(entries.slice(0, MAX_HISTORY), null, 2), 'utf-8');
  } catch {
    // optional persistence
  }
}

export function loadInputHistory(): string[] {
  return readHistoryFile();
}
