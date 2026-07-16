import { describe, expect, it, vi } from 'vitest';
import { auditAmbientAction, buildAmbientBlocks, AmbientScheduler } from './ambient-scheduler.js';

vi.mock('../../security/scout-client.js', () => ({
  reportEvent: vi.fn().mockResolvedValue(undefined),
}));

describe('AmbientScheduler', () => {
  it('builds ambient blocks with suggested action', () => {
    const blocks = buildAmbientBlocks({
      type: 'approaching_deadline',
      priority: 'high',
      channelId: 'C1',
      channelName: '#eng',
      message: 'Due soon',
      sourceFactIds: ['f1'],
      suggestedAction: 'Check owner',
    });
    expect(JSON.stringify(blocks)).toContain('Check owner');
  });

  it('delivers checks through configured handler', async () => {
    const delivered: string[] = [];
    const scheduler = new AmbientScheduler(async (check) => {
      delivered.push(check.channelId);
    }, 0);

    vi.spyOn(scheduler['engine'], 'runAmbientChecks').mockResolvedValue([{
      type: 'stale_thread',
      priority: 'low',
      channelId: 'C1',
      channelName: '#eng',
      message: 'Follow up',
      sourceFactIds: ['f1'],
    }]);

    await scheduler.runCycle();
    expect(delivered).toEqual(['C1']);
    await auditAmbientAction({
      type: 'stale_thread',
      priority: 'low',
      channelId: 'C1',
      channelName: '#eng',
      message: 'Follow up',
      sourceFactIds: ['f1'],
    });
  });
});
