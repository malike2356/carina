import { mkdir, readFile, appendFile } from 'fs/promises';
import path from 'path';

export function getTodaysJournalPath(homeDir: string, now = new Date()): string {
  const date = formatLocalDate(now);
  return path.join(homeDir, 'memory', `${date}.md`);
}

export async function appendToDailyJournal(
  homeDir: string,
  entry: string,
  now = new Date(),
): Promise<void> {
  const journalPath = getTodaysJournalPath(homeDir, now);
  await mkdir(path.dirname(journalPath), { recursive: true });
  const timestamp = formatLocalTime(now);
  await appendFile(journalPath, `\n## ${timestamp}\n\n${entry.trim()}\n`, 'utf-8');
}

export async function loadTodaysJournal(homeDir: string, now = new Date()): Promise<string> {
  try {
    return await readFile(getTodaysJournalPath(homeDir, now), 'utf-8');
  } catch (err) {
    if (isMissingFile(err)) return '';
    throw err;
  }
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatLocalTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function isMissingFile(err: unknown): boolean {
  return typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'ENOENT';
}
