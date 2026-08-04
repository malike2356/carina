import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('property channel step: script-generation', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-pc-scripts-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.stubEnv('PROPERTY_CHANNEL_MAX_VIDEOS_PER_BATCH', '10');
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('generates the configured number of videos and is idempotent on re-run', async () => {
    const { createPropertyChannelRun } = await import('../store.js');
    const { runScriptGeneration } = await import('./script-generation.js');
    const { getCalendar } = await import('../../../../content/script-generator/store.js');

    const run = createPropertyChannelRun({
      workspaceId: 'ws-1',
      niche: 'buy-to-let-investment',
      location: 'Leeds',
      publishTime: '18:30',
      channelId: 'chan-1',
    });

    const first = await runScriptGeneration(run);
    expect(first.totalGenerated).toBe(10);
    expect(first.firstSevenTitles.length).toBe(7);

    const calendarAfterFirst = getCalendar('ws-1', 'chan-1');
    expect(calendarAfterFirst.length).toBe(10);

    const second = await runScriptGeneration(run);
    expect(second.totalGenerated).toBe(10);
    expect(second.firstSevenTitles).toEqual(first.firstSevenTitles);

    const calendarAfterSecond = getCalendar('ws-1', 'chan-1');
    expect(calendarAfterSecond.length).toBe(10);
    expect(calendarAfterSecond).toEqual(calendarAfterFirst);
  });
});
