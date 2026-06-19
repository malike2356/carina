import { afterEach, describe, expect, it } from 'vitest';
import { hubSyncEnabled } from './hub-sync-scheduler.js';

describe('hub-sync-scheduler', () => {
  afterEach(() => {
    delete process.env.CARINA_HUB_SYNC_ENABLED;
    delete process.env.CARINA_LOCAL_MODE;
    delete process.env.SKILLS_HUB_URL;
    delete process.env.HUB_URL;
  });

  it('is disabled in local mode', () => {
    process.env.CARINA_LOCAL_MODE = 'true';
    process.env.SKILLS_HUB_URL = 'https://hub.example.test';
    expect(hubSyncEnabled()).toBe(false);
  });

  it('is enabled when hub URL is configured', () => {
    process.env.SKILLS_HUB_URL = 'https://hub.example.test';
    expect(hubSyncEnabled()).toBe(true);
  });

  it('can be forced off', () => {
    process.env.SKILLS_HUB_URL = 'https://hub.example.test';
    process.env.CARINA_HUB_SYNC_ENABLED = 'false';
    expect(hubSyncEnabled()).toBe(false);
  });
});
