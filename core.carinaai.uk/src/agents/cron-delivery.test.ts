import { describe, expect, it, beforeEach } from 'vitest';
import {
  collectDeliveryTargets,
  parseDeliverSpec,
} from './cron-delivery.js';
import {
  bindSessionDelivery,
  clearDeliveryRegistryForTests,
  listFanoutTargets,
} from './cron-delivery-registry.js';
import type { ScheduledJob } from './cron-scheduler.js';

function baseJob(overrides: Partial<ScheduledJob> = {}): ScheduledJob {
  return {
    id: 'j1',
    name: 'test',
    schedule: '30m',
    prompt: 'hi',
    scriptPath: null,
    noAgent: false,
    deliver: 'origin',
    repeatCount: null,
    runsRemaining: null,
    status: 'active',
    lastRun: null,
    nextRun: null,
    contextFrom: [],
    chainAfter: [],
    enabledToolsets: [],
    workdir: null,
    originSessionId: 'sess-1',
    originChannel: null,
    originConversationId: null,
    originThreadId: null,
    deliverChannels: [],
    createdAt: new Date(),
    ...overrides,
  };
}

describe('cron-delivery', () => {
  beforeEach(() => {
    clearDeliveryRegistryForTests();
  });

  it('parses channel:conversation deliver specs', () => {
    const targets = parseDeliverSpec('telegram:123,discord:456', baseJob());
    expect(targets).toHaveLength(2);
    expect(targets[0].channel).toBe('telegram');
    expect(targets[1].conversationId).toBe('456');
  });

  it('parses telegram thread targets', () => {
    const targets = parseDeliverSpec('telegram:12345:99', baseJob());
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({
      channel: 'telegram',
      conversationId: '12345',
      threadId: '99',
    });
  });

  it('returns empty for local deliver', () => {
    expect(parseDeliverSpec('local', baseJob())).toHaveLength(0);
  });

  it('routes origin deliver to stored channel identity', () => {
    const targets = parseDeliverSpec('origin', baseJob({
      originChannel: 'telegram',
      originConversationId: '999',
      originThreadId: '1',
    }));
    expect(targets).toEqual([{
      channel: 'telegram',
      conversationId: '999',
      threadId: '1',
    }]);
  });

  it('falls back to session delivery for origin', () => {
    bindSessionDelivery('sess-1', {
      channel: 'discord',
      conversationId: 'chan-1',
    });
    const targets = parseDeliverSpec('origin', baseJob());
    expect(targets[0].channel).toBe('discord');
  });

  it('fans out to recent channel conversations for all', () => {
    bindSessionDelivery('s1', { channel: 'telegram', conversationId: '1' });
    bindSessionDelivery('s2', { channel: 'slack', conversationId: 'C123' });
    expect(listFanoutTargets()).toHaveLength(2);
    const targets = parseDeliverSpec('all', baseJob());
    expect(targets.map((t) => t.channel).sort()).toEqual(['slack', 'telegram']);
  });

  it('merges deliver mode and deliver_channels fan-out', () => {
    const targets = collectDeliveryTargets(baseJob({
      deliver: 'origin',
      originChannel: 'telegram',
      originConversationId: '1',
      deliverChannels: ['discord:456', 'slack:C789'],
    }));
    expect(targets).toHaveLength(3);
  });
});
