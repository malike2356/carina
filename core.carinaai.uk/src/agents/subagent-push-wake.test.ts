import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildSubagentWakeContext,
  clearSubagentWakeQueuesForTests,
  drainSubagentWakeMessages,
  pushWakeParentOnSubagentComplete,
  queueSubagentWakeMessage,
} from './subagent-push-wake.js';

vi.mock('../webhooks/dispatcher.js', () => ({
  dispatchWebhook: vi.fn().mockResolvedValue({ delivered: 0, failed: 0, delivery_ids: [] }),
}));

vi.mock('./cron-delivery-registry.js', () => ({
  getSessionDelivery: vi.fn(),
}));

vi.mock('../gateway/channels/channel-registry.js', () => ({
  channelRegistry: {
    getByName: vi.fn(),
  },
}));

describe('subagent-push-wake', () => {
  beforeEach(() => {
    clearSubagentWakeQueuesForTests();
  });

  it('queues wake messages for parent session context', () => {
    queueSubagentWakeMessage('parent', 'done');
    expect(drainSubagentWakeMessages('parent')).toEqual(['done']);
    expect(drainSubagentWakeMessages('parent')).toEqual([]);
  });

  it('formats wake context block', () => {
    const block = buildSubagentWakeContext(['Subagent completed: summary']);
    expect(block).toContain('Subagent completion wake');
    expect(block).toContain('Subagent completed: summary');
  });

  it('pushes channel message when delivery target exists', async () => {
    const { getSessionDelivery } = await import('./cron-delivery-registry.js');
    const { channelRegistry } = await import('../gateway/channels/channel-registry.js');
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    vi.mocked(getSessionDelivery).mockReturnValue({
      channel: 'telegram',
      conversationId: 'chat-1',
    });
    vi.mocked(channelRegistry.getByName).mockReturnValue({
      enabled: true,
      sendMessage,
    } as never);

    await pushWakeParentOnSubagentComplete({
      parentSessionId: 'parent',
      subSessionId: 'parent:sub:1',
      goal: 'test',
      summary: 'finished task',
      mode: 'single',
      success: true,
    });

    expect(sendMessage).toHaveBeenCalledWith('chat-1', expect.stringContaining('finished task'));
    expect(drainSubagentWakeMessages('parent')).toHaveLength(1);
  });
});
