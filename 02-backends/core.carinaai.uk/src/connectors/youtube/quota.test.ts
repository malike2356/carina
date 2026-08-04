import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('youtube quota helper', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-yt-quota-'));
    vi.stubEnv('CARINA_HOME', tmpHome);
    vi.stubEnv('YOUTUBE_QUOTA_LIMIT_PER_DAY', '10000');
    vi.resetModules();
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('starts a channel at zero usage with the configured daily limit', async () => {
    const { getQuotaUsage } = await import('./quota.js');
    const usage = getQuotaUsage('channel-1');
    expect(usage.used).toBe(0);
    expect(usage.limit).toBe(10000);
    expect(usage.remaining).toBe(10000);
  });

  it('records usage and reduces remaining quota', async () => {
    const { getQuotaUsage, recordUsage } = await import('./quota.js');
    recordUsage('channel-1', 'videos.insert');
    const usage = getQuotaUsage('channel-1');
    expect(usage.used).toBe(1600);
    expect(usage.remaining).toBe(8400);
  });

  it('throws YouTubeQuotaExceededError once the daily budget is exhausted', async () => {
    const { assertQuota, recordUsage, YouTubeQuotaExceededError } = await import('./quota.js');
    for (let i = 0; i < 6; i++) recordUsage('channel-1', 'videos.insert');
    expect(() => assertQuota('channel-1', 'videos.insert')).toThrow(YouTubeQuotaExceededError);
  });

  it('canAfford reflects remaining budget accurately', async () => {
    const { canAfford, recordUsage } = await import('./quota.js');
    expect(canAfford('channel-1', 'videos.insert')).toBe(true);
    for (let i = 0; i < 6; i++) recordUsage('channel-1', 'videos.insert');
    expect(canAfford('channel-1', 'videos.insert')).toBe(false);
    expect(canAfford('channel-1', 'channels.list')).toBe(true);
  });

  it('estimates the upload schedule needed to spread a 365 day batch across the quota', async () => {
    const { estimateUploadSchedule } = await import('./quota.js');
    const schedule = estimateUploadSchedule(365, 10000);
    expect(schedule.videosPerDay).toBe(6);
    expect(schedule.totalDays).toBe(Math.ceil(365 / 6));
  });

  it('tracks quota separately per channel', async () => {
    const { getQuotaUsage, recordUsage } = await import('./quota.js');
    recordUsage('channel-1', 'videos.insert');
    const usageA = getQuotaUsage('channel-1');
    const usageB = getQuotaUsage('channel-2');
    expect(usageA.used).toBe(1600);
    expect(usageB.used).toBe(0);
  });
});
