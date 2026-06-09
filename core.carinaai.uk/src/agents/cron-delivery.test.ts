import { describe, expect, it } from 'vitest';
import { parseDeliverSpec } from './cron-delivery.js';
import type { ScheduledJob } from './cron-scheduler.js';

const baseJob = {
  id: 'j1',
  name: 'test',
  schedule: '30m',
  prompt: 'hi',
  scriptPath: null,
  noAgent: false,
  deliver: 'telegram:123',
  repeatCount: null,
  runsRemaining: null,
  status: 'active' as const,
  lastRun: null,
  nextRun: null,
  contextFrom: [],
  chainAfter: [],
  enabledToolsets: [],
  workdir: null,
  originSessionId: 'sess-1',
  createdAt: new Date(),
};

describe('cron-delivery', () => {
  it('parses channel:conversation deliver specs', () => {
    const targets = parseDeliverSpec('telegram:123,discord:456', baseJob);
    expect(targets).toHaveLength(2);
    expect(targets[0].channel).toBe('telegram');
  });

  it('returns empty for origin deliver', () => {
    expect(parseDeliverSpec('origin', baseJob)).toHaveLength(0);
  });
});
