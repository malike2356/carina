import { mkdtemp, rm, readFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { appendToDailyJournal, getTodaysJournalPath, loadTodaysJournal } from './daily-journal.js';

let tmpDir: string | undefined;

afterEach(async () => {
  if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  tmpDir = undefined;
});

async function makeHome(): Promise<string> {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'carina-home-'));
  return tmpDir;
}

describe('daily journal', () => {
  it('uses the local calendar date for the journal path', async () => {
    const home = await makeHome();
    const now = new Date(2026, 0, 2, 9, 5);

    expect(getTodaysJournalPath(home, now)).toBe(path.join(home, 'memory', '2026-01-02.md'));
  });

  it('appends timestamped entries and loads today', async () => {
    const home = await makeHome();
    const now = new Date(2026, 0, 2, 9, 5);

    await appendToDailyJournal(home, 'First note', now);
    await appendToDailyJournal(home, 'Second note', now);

    const content = await readFile(getTodaysJournalPath(home, now), 'utf-8');
    expect(content).toContain('## 09:05');
    expect(content).toContain('First note');
    expect(await loadTodaysJournal(home, now)).toContain('Second note');
  });

  it('returns empty content when today has no journal', async () => {
    const home = await makeHome();

    await expect(loadTodaysJournal(home)).resolves.toBe('');
  });
});
