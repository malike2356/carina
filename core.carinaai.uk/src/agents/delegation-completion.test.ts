import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  drainPendingDelegationCompletions,
  emitDelegationComplete,
  registerDelegationCompletionHandler,
} from './delegation-completion.js';

vi.mock('../webhooks/dispatcher.js', () => ({
  dispatchWebhook: vi.fn().mockResolvedValue({ delivered: 0, failed: 0, delivery_ids: [] }),
}));

describe('delegation-completion', () => {
  beforeEach(() => {
    drainPendingDelegationCompletions();
  });

  it('queues completion until a handler is registered', async () => {
    await emitDelegationComplete({
      parentSessionId: 'parent',
      subSessionId: 'parent:sub:1',
      goal: 'test',
      summary: 'done',
      mode: 'single',
      success: true,
    });
    expect(drainPendingDelegationCompletions()).toHaveLength(1);
  });

  it('delivers to handler when registered', async () => {
    const seen: string[] = [];
    registerDelegationCompletionHandler((event) => {
      seen.push(event.summary);
    });
    await emitDelegationComplete({
      parentSessionId: 'parent',
      subSessionId: 'parent:sub:2',
      goal: 'test',
      summary: 'finished',
      mode: 'single',
      success: true,
    });
    expect(seen).toEqual(['finished']);
    expect(drainPendingDelegationCompletions()).toHaveLength(0);
  });
});
