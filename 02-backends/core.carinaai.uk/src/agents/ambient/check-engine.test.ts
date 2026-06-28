import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../config/index.js';
import { AmbientCheckEngine } from './check-engine.js';
import {
  resetChannelMemoryStoreForTests,
  seedChannelFactForTests,
} from './channel-memory-store.js';
import {
  resetAmbientChannelSettingsForTests,
  saveAmbientChannelSettings,
  getAmbientChannelSettings,
} from './ambient-channel-settings.js';

describe('AmbientCheckEngine', () => {
  beforeEach(() => {
    config.ambient.enabled = true;
  });

  afterEach(() => {
    resetChannelMemoryStoreForTests();
    resetAmbientChannelSettingsForTests();
    vi.restoreAllMocks();
  });

  it('finds stale threads with no recent updates', async () => {
    await seedChannelFactForTests({
      channelId: 'C-stale-test',
      channelName: '#eng',
      factType: 'status_update',
      summary: 'Rollout started',
      extractedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const engine = new AmbientCheckEngine(0);
    const checks = await engine.runAmbientChecks();
    expect(checks.some((c) => c.type === 'stale_thread' && c.channelId === 'C-stale-test')).toBe(true);
  });

  it('surfaces approaching deadlines within 48 hours', async () => {
    const tomorrow = new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString();
    await seedChannelFactForTests({
      channelId: 'C-deadline-test',
      channelName: '#eng',
      factType: 'deadline',
      summary: 'Launch due tomorrow',
      metadata: { entities: { dates: [tomorrow] } },
    });

    const engine = new AmbientCheckEngine(0);
    const checks = await engine.runAmbientChecks();
    expect(checks.some((c) => c.type === 'approaching_deadline' && c.channelId === 'C-deadline-test')).toBe(true);
  });

  it('flags unresolved blockers', async () => {
    await seedChannelFactForTests({
      channelId: 'C-blocker-test',
      channelName: '#eng',
      factType: 'blocker',
      summary: 'Blocked on DNS',
      extractedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const engine = new AmbientCheckEngine(0);
    const checks = await engine.runAmbientChecks();
    expect(checks.some((c) => c.type === 'blocker_unresolved' && c.channelId === 'C-blocker-test')).toBe(true);
  });

  it('limits to 3 checks per channel per cycle', async () => {
    for (let i = 0; i < 5; i += 1) {
      await seedChannelFactForTests({
        channelId: 'C1',
        channelName: '#eng',
        factType: 'blocker',
        summary: `Blocker ${i}`,
        extractedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      });
    }
    const engine = new AmbientCheckEngine(0);
    const checks = await engine.runAmbientChecks();
    expect(checks.filter((c) => c.channelId === 'C1').length).toBeLessThanOrEqual(3);
  });

  it('respects /ambient off command', async () => {
    await seedChannelFactForTests({
      channelId: 'C1',
      channelName: '#eng',
      factType: 'blocker',
      summary: 'Blocked on DNS',
      extractedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    });

    const settings = await getAmbientChannelSettings('C1', '#eng');
    settings.ambientChecksEnabled = false;
    await saveAmbientChannelSettings(settings);

    const engine = new AmbientCheckEngine(0);
    const checks = await engine.runAmbientChecks();
    expect(checks).toEqual([]);
  });
});
