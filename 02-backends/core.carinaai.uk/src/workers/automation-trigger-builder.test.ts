import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  actionNeedsApproval,
  computeNextRun,
  conditionsPass,
  cronFromSchedule,
  normalizeSchedule,
  scheduleLabelFrom,
} from './automation-trigger-schema.js';

describe('automation-trigger-schema', () => {
  it('labels structured schedules', () => {
    expect(scheduleLabelFrom({ type: 'interval', everyMinutes: 30 })).toContain('30');
    expect(scheduleLabelFrom({ type: 'daily', atHour: 9, atMinute: 0 })).toContain('09:00');
    expect(scheduleLabelFrom({ type: 'cron', cron: '0 7 * * *' })).toContain('0 7');
  });

  it('computes next interval run', () => {
    const from = new Date('2026-07-11T10:00:00.000Z');
    const next = computeNextRun({ type: 'interval', everyMinutes: 15 }, 'UTC', from);
    expect(next?.toISOString()).toBe('2026-07-11T10:15:00.000Z');
  });

  it('returns null for past once schedules', () => {
    const next = computeNextRun(
      { type: 'once', at: '2020-01-01T00:00:00.000Z' },
      'UTC',
      new Date('2026-01-01T00:00:00.000Z'),
    );
    expect(next).toBeNull();
  });

  it('builds cron from daily schedule', () => {
    expect(cronFromSchedule(normalizeSchedule({ type: 'daily', atHour: 8, atMinute: 30 }))).toBe('30 8 * * *');
  });

  it('evaluates conditions', () => {
    expect(conditionsPass([{ field: 'subject', op: 'contains', value: 'invoice' }], { subject: 'Invoice #1' })).toBe(true);
    expect(conditionsPass([{ field: 'subject', op: 'eq', value: 'x' }], { subject: 'y' })).toBe(false);
  });

  it('requires approval for risky writes', () => {
    expect(actionNeedsApproval('webhook_call', 'require_write')).toBe(true);
    expect(actionNeedsApproval('aiva_prompt', 'require_write')).toBe(false);
    expect(actionNeedsApproval('aiva_prompt', 'always')).toBe(true);
  });
});

describe('automation-run-queue leases', () => {
  const query = vi.fn();

  beforeEach(() => {
    query.mockReset();
    vi.resetModules();
    vi.doMock('../memory/db.js', () => ({ pool: { query } }));
  });

  function runRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'run-1',
      automation_id: 'auto-1',
      worker_id: 'w-1',
      workspace_id: 'ws-1',
      status: 'queued',
      trigger_kind: 'schedule',
      payload_json: {},
      result_json: null,
      approval_status: null,
      attempts: 0,
      locked_at: null,
      locked_by: null,
      duration_ms: null,
      error: null,
      usage_json: null,
      actor: 'scheduler',
      created_at: new Date(),
      finished_at: null,
      ...overrides,
    };
  }

  it('queues a due run once and claims under concurrent workers', async () => {
    query.mockImplementation(async (sql: string) => {
      if (/INSERT INTO ai_worker_automation_runs/i.test(sql)) {
        return { rows: [runRow()], rowCount: 1 };
      }
      if (/UPDATE ai_worker_automation_runs AS r/i.test(sql)) {
        return {
          rows: [runRow({ status: 'running', locked_by: 'worker-a', attempts: 1, locked_at: new Date() })],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const { enqueueAutomationRun, claimAutomationRun } = await import('./automation-run-queue.js');

    const queued = await enqueueAutomationRun({
      automationId: 'auto-1',
      workerId: 'w-1',
      workspaceId: 'ws-1',
      triggerKind: 'schedule',
    });
    expect(queued?.id).toBe('run-1');

    query.mockImplementation(async (sql: string) => {
      if (/INSERT INTO ai_worker_automation_runs/i.test(sql)) {
        throw Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
      }
      return { rows: [], rowCount: 0 };
    });
    const dup = await enqueueAutomationRun({
      automationId: 'auto-1',
      workerId: 'w-1',
      workspaceId: 'ws-1',
      triggerKind: 'schedule',
    });
    expect(dup).toBeNull();

    query.mockImplementation(async (sql: string) => {
      if (/UPDATE ai_worker_automation_runs AS r/i.test(sql)) {
        return {
          rows: [runRow({ status: 'running', locked_by: 'worker-a', attempts: 1, locked_at: new Date() })],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });
    const claimed = await claimAutomationRun('worker-a');
    expect(claimed?.status).toBe('running');
    expect(claimed?.lockedBy).toBe('worker-a');

    query.mockImplementation(async () => ({ rows: [], rowCount: 0 }));
    const missed = await claimAutomationRun('worker-b');
    expect(missed).toBeNull();
  });
});

describe('automation-action-dispatcher', () => {
  const processAivaMessage = vi.fn(async () => 'wallet-ok');

  beforeEach(() => {
    processAivaMessage.mockClear();
    vi.resetModules();
    vi.doMock('./aiva-process-message.js', () => ({ processAivaMessage }));
    vi.doMock('./provision-worker-playbook.js', () => ({
      readWorkerPlaybook: vi.fn(() => null),
    }));
    vi.doMock('./playbook-run-client.js', () => ({
      startWorkerPlaybookRun: vi.fn(),
    }));
    vi.doMock('./worker-store.js', () => ({
      getWorkerById: vi.fn(),
      logActivity: vi.fn(async () => {}),
    }));
    vi.doMock('../ingestion/social/social-post-draft-handler.js', () => ({
      isSocialPostAutomation: () => false,
      createSocialPostDraft: vi.fn(),
    }));
  });

  it('holds risky write actions for approval', async () => {
    const { dispatchAutomationAction } = await import('./automation-action-dispatcher.js');
    const result = await dispatchAutomationAction({
      workerId: 'w1',
      workspaceId: 'ws1',
      automationId: 'a1',
      automationName: 'Hook',
      automationDescription: 'call hook',
      actionType: 'webhook_call',
      action: { type: 'webhook_call', url: 'https://example.com/hook' },
      approvalMode: 'require_write',
    });
    expect(result.awaitingApproval).toBe(true);
    expect(result.ok).toBe(true);
  });

  it('routes aiva_prompt through processAivaMessage (wallet/BYOK gate)', async () => {
    const { dispatchAutomationAction } = await import('./automation-action-dispatcher.js');
    const result = await dispatchAutomationAction({
      workerId: 'w1',
      workspaceId: 'ws1',
      automationId: 'a1',
      automationName: 'Brief',
      automationDescription: 'summarize inbox',
      actionType: 'aiva_prompt',
      action: { type: 'aiva_prompt', prompt: 'summarize inbox' },
      approvalMode: 'auto',
    });
    expect(result.ok).toBe(true);
    expect(processAivaMessage).toHaveBeenCalled();
    expect(result.usage?.routed).toBe('aiva_prompt');
  });

  it('records failure diagnostics for bad webhook urls', async () => {
    const { dispatchAutomationAction } = await import('./automation-action-dispatcher.js');
    const result = await dispatchAutomationAction({
      workerId: 'w1',
      workspaceId: 'ws1',
      automationId: 'a1',
      automationName: 'Hook',
      automationDescription: 'call hook',
      actionType: 'webhook_call',
      action: { type: 'webhook_call', url: 'http://insecure.example' },
      approvalMode: 'auto',
      alreadyApproved: true,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/https/i);
  });
});
