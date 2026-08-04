import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createChannelLinkService } from './channel-links.js';

function createQueryQueue(responses: Array<{ rows: Array<Record<string, unknown>> }>) {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  return {
    calls,
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      const next = responses.shift();
      if (!next) throw new Error(`Unexpected query: ${sql}`);
      return next as any;
    },
  };
}

describe('channel link service', () => {
  it('creates and consumes a telegram link code', async () => {
    const queue = createQueryQueue([
      {
        rows: [{
          id: 'code-1',
          organization_id: 'org-1',
          dashboard_user_id: 'dash-1',
          channel: 'telegram',
          code_hash: 'hash-1',
          role: 'operator',
          expires_at: new Date('2026-07-28T10:05:00.000Z'),
          consumed_at: null,
          consumed_by: null,
          consumed_chat_ref: null,
          metadata: {},
          created_at: new Date('2026-07-28T10:00:00.000Z'),
        }],
      },
      {
        rows: [{
          id: 'code-1',
          organization_id: 'org-1',
          dashboard_user_id: 'dash-1',
          channel: 'telegram',
          code_hash: 'hash-1',
          role: 'operator',
          expires_at: new Date('2026-07-28T10:05:00.000Z'),
          consumed_at: null,
          consumed_by: null,
          consumed_chat_ref: null,
          metadata: {},
          created_at: new Date('2026-07-28T10:00:00.000Z'),
        }],
      },
      { rows: [] },
      {
        rows: [{
          id: 'link-1',
          organization_id: 'org-1',
          dashboard_user_id: 'dash-1',
          channel: 'telegram',
          channel_user_ref: '12345',
          chat_ref: 'chat-1',
          role: 'operator',
          enabled: true,
          linked_at: new Date('2026-07-28T10:00:01.000Z'),
          revoked_at: null,
          confirmed_at: new Date('2026-07-28T10:00:01.000Z'),
          control_scope: 'org',
          metadata: {},
        }],
      },
    ]);

    const service = createChannelLinkService({
      pool: queue as any,
      now: () => new Date('2026-07-28T10:00:00.000Z'),
    });

    const created = await service.createLinkCode({
      organizationId: 'org-1',
      dashboardUserId: 'dash-1',
      channel: 'telegram',
      role: 'operator',
    });

    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.channel, 'telegram');
    assert.equal(created.code.startsWith('SCOUT-T-'), true);

    const consumed = await service.consumeLinkCode({
      code: created.code,
      channel: 'telegram',
      channelUserRef: '12345',
      chatRef: 'chat-1',
      confirmedBy: 'operator-1',
    });

    assert.equal(consumed.ok, true);
    if (!consumed.ok) return;
    assert.equal(consumed.link.organization_id, 'org-1');
    assert.equal(consumed.link.channel_user_ref, '12345');
    assert.equal(queue.calls.length, 4);
  });
});
