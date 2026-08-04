import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createControlService, validateKillReason } from './control.js';

function createQueryQueue(responses: Array<{ rows: Array<Record<string, unknown>> }>) {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  return {
    calls,
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      const next = responses.shift();
      if (!next) throw new Error(`Unexpected query: ${sql}`);
      return next;
    },
  };
}

describe('control service', () => {
  it('validates kill reasons', () => {
    assert.deepEqual(validateKillReason({ reason: 'policy violation' }), {
      ok: true,
      reason: 'policy violation',
    });
    assert.equal(validateKillReason({ reason: '   ' }).ok, false);
  });

  it('freezes an organization and records an audit code', async () => {
    const queryQueue = createQueryQueue([
      { rows: [{ count: '0' }] },
      { rows: [{ id: 'evt-1' }] },
      {
        rows: [{
          id: 'ctrl-1',
          organization_id: 'org-1',
          audit_code: 'K-2026-07-28-001',
          action: 'freeze_org',
          target_type: 'organization',
          target_id: 'org-1',
          channel: null,
          channel_user_ref: null,
          dashboard_user_id: null,
          reason: 'policy violation',
          confirmed: true,
          metadata: {},
          created_at: new Date('2026-07-28T10:00:00.000Z'),
        }],
      },
      {
        rows: [{
          id: 'sev-1',
          severity: 'critical',
          source: 'scout-engine',
          event_type: 'channel_control_freeze_org',
          description: 'Control action freeze_org on organization org-1: policy violation',
          metadata: {},
          ip_address: null,
          session_id: null,
          instance_id: 'org-1',
          mitigated: false,
          created_at: new Date('2026-07-28T10:00:00.000Z'),
        }],
      },
    ]);

    const published: Array<{ channel: string; payload: string }> = [];
    const broadcasted: Array<Record<string, unknown>> = [];
    const service = createControlService({
      pool: queryQueue as any,
      getRedis: () => ({
        publish: async (channel: string, payload: string) => {
          published.push({ channel, payload });
        },
      }),
      broadcastEvent: (event) => {
        broadcasted.push(event);
      },
      now: () => new Date('2026-07-28T10:00:00.000Z'),
    });

    const result = await service.freezeOrg('org-1', {
      plan: 'scout_pro',
      reason: 'policy violation',
      confirmed: true,
      actor: 'operator',
    });

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.audit_code, 'K-2026-07-28-001');
      assert.equal(result.status, 'suspended');
    }
    assert.equal(published.length, 1);
    assert.equal(published[0]?.channel, 'labyrinth:control');
    assert.equal(broadcasted.length, 1);
    assert.equal(queryQueue.calls.length, 4);
  });

  it('rejects org-wide pause when no plan is provided', async () => {
    const queryQueue = createQueryQueue([]);
    const service = createControlService({ pool: queryQueue as any, getRedis: () => null, broadcastEvent: () => {} });
    const result = await service.pauseAgent('org-1', 'agent-1', { reason: 'test' });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'plan_limit');
      assert.equal(result.status, 403);
    }
    assert.equal(queryQueue.calls.length, 0);
  });
});
